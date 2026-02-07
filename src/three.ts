// SPDX-License-Identifier: AGPL-3.0-or-later

/*_,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,_

                                              .--.
                                               `.  \
                                                 \  \
                                                  .  \
                                                  :   .
                                                  |    .
                                                  |    :
                                                  |    |
  ..._  ___                                       |    |
 `."".`''''""--..___                              |    |
 ,-\  \             ""-...__         _____________/    |
 / ` " '                    `""""""""                  .
 \                                                      L
 (>                                                      \
/                                                         \
\_    ___..---.                                            L
  `--'         '.                                           \
                 .                                           \_
                _/`.                                           `.._
             .'     -.                                             `.
            /     __.-Y     /''''''-...___,...--------.._            |
           /   _."    |    /                ' .      \   '---..._    |
          /   /      /    /                _,. '    ,/           |   |
          \_,'     _.'   /              /''     _,-'            _|   |
                  '     /               `-----''               /     |
                  `...-'     dp                                `...-'

Copyright (C) 2026 Benton Boychuk-Chorney

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

This module is for the Three.js integration to Elysia

_,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,_*/

import * as Three from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/Addons";
import {
  App,
  ComponentInserted,
  ComponentRemovalScheduled,
  type EntityID,
  Input,
  Mut,
  Mutated,
  Plugin,
  Query,
  Relationship,
  Schedule,
  System,
  World,
} from "./core";
import {
  assertNumber,
  Time,
  KeyCodes,
  MouseCodes,
  Triggerer,
  type AssetLoader,
  type Immutable,
  type Mutable,
  type Nullish,
} from "./lib";

/*  .o88b.  .d8b.  .88b  d88. d88888b d8888b.  .d8b.  */
/* d8P  Y8 d8' `8b 88'YbdP`88 88'     88  `8D d8' `8b */
/* 8P      88ooo88 88  88  88 88ooooo 88oobY' 88ooo88 */
/* 8b      88~~~88 88  88  88 88~~~~~ 88`8b   88~~~88 */
/* Y8b  d8 88   88 88  88  88 88.     88 `88. 88   88 */
/*  `Y88P' YP   YP YP  YP  YP Y88888P 88   YD YP   YP */

/**
 * Marker component that designates a camera entity as the active camera.
 * Attach this to an entity with a camera component to indicate it should
 * be used for rendering.
 */
export class ActiveCameraComponent {}

/**
 * Component that synchronizes a camera's projection properties with a canvas element.
 * When attached to an entity alongside a camera component, the system will automatically
 * update the camera's aspect ratio or frustum to match the canvas dimensions.
 *
 * The canvas reference is stored as a `WeakRef` to avoid preventing garbage collection.
 */
export class SyncCameraComponent {
  /** Returns the referenced canvas element, or `undefined` if it has been garbage collected or unset. */
  get canvas(): HTMLCanvasElement | OffscreenCanvas | undefined {
    return this.#canvas?.deref();
  }

  /** Sets the canvas element to sync with. Pass `undefined` to clear the reference. */
  set canvas(value: HTMLCanvasElement | OffscreenCanvas | undefined) {
    if (value) {
      this.#canvas = new WeakRef(value);
    } else {
      this.#canvas = undefined;
    }
  }

  /**
   * Creates a new SyncCameraComponent.
   * @param canvas - The canvas element whose dimensions the camera should be synchronized with.
   */
  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    this.#canvas = new WeakRef(canvas);
  }

  #canvas?: WeakRef<HTMLCanvasElement | OffscreenCanvas>;
}

/**
 * System that synchronizes camera projection properties with the associated canvas dimensions.
 *
 * - For {@link Three.PerspectiveCamera}: updates the `aspect` ratio based on canvas width/height.
 * - For {@link Three.OrthographicCamera}: adjusts the `left` and `right` frustum bounds
 *   to maintain the correct aspect ratio while preserving the vertical frustum height and horizontal center.
 *
 * Both camera types have their projection matrices recalculated after updates.
 *
 * Requires entities to have both a {@link SyncCameraComponent} and a camera component attached.
 */
export const threeCanvasSyncSystem = System(
  "Three::CanvasSyncSystem",
  [
    Query(SyncCameraComponent, Mut(Three.PerspectiveCamera)),
    Query(SyncCameraComponent, Mut(Three.OrthographicCamera)),
  ],
  (perspectiveCameras, orthoCameras) => {
    for (const [_, { canvas }, cameraMut] of perspectiveCameras) {
      if (canvas) {
        const camera = cameraMut.deref();
        camera.aspect = canvas.width / canvas.height;
        camera.updateProjectionMatrix();
      }
    }

    for (const [_, { canvas }, cameraMut] of orthoCameras) {
      if (canvas) {
        const camera = cameraMut.deref();
        const aspect = canvas.width / canvas.height;
        const frustumHeight = camera.top - camera.bottom;
        const frustumWidth = frustumHeight * aspect;
        const centerX = (camera.left + camera.right) / 2;
        camera.left = centerX - frustumWidth / 2;
        camera.right = centerX + frustumWidth / 2;
        camera.updateProjectionMatrix();
      }
    }
  },
);

/*  .d8b.  .d8888. .d8888. d88888b d888888b */
/* d8' `8b 88'  YP 88'  YP 88'     `~~88~~' */
/* 88ooo88 `8bo.   `8bo.   88ooooo    88    */
/* 88~~~88   `Y8b.   `Y8b. 88~~~~~    88    */
/* 88   88 db   8D db   8D 88.        88    */
/* YP   YP `8888Y' `8888Y' Y88888P    YP    */

const textureLoader = new Three.TextureLoader();

export type TextureAsset = AssetLoader<Three.Texture>;

/**
 * Creates a {@link TextureAsset} that asynchronously loads a texture from the specified path.
 *
 * Uses a shared {@link Three.TextureLoader} instance for efficient loading.
 * The returned asset loader handles disposal of the texture when it is no longer needed.
 *
 * @param path - The URL or file path of the texture to load.
 * @returns An {@link AssetLoader} for a {@link Three.Texture}.
 */
export const TextureAsset = (path: string): AssetLoader<Three.Texture> => ({
  path,
  load: async () => {
    return textureLoader.loadAsync(path);
  },
  destroy: (asset) => {
    asset.dispose();
  },
});

const gltfLoader = new GLTFLoader();

export type GLTFAsset = AssetLoader<GLTF>;

/**
 * Creates a {@link GLTFAsset} that asynchronously loads a glTF model from the specified path.
 *
 * Uses a shared {@link GLTFLoader} instance for efficient loading.
 * The returned asset loader handles deep disposal of the model when it is no longer needed,
 * traversing all scenes in the GLTF and disposing of every geometry and material
 * (including material arrays) found on each object.
 *
 * @param path - The URL or file path of the glTF model to load.
 * @returns An {@link AssetLoader} for a {@link GLTF}.
 */
export const GLTFAsset = (path: string): AssetLoader<GLTF> => ({
  path,
  load: async () => {
    return gltfLoader.loadAsync(path);
  },
  destroy: (asset) => {
    asset.scenes.forEach((scene) => {
      scene.traverse((obj) => {
        if ((<any>obj).geometry) {
          (<any>obj).geometry.dispose();
        }
        if ((<any>obj).material) {
          const mat = (<any>obj).material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose());
          } else {
            mat.dispose();
          }
        }
      });
    });
  },
});

/* d888888b d8888b.  .d8b.  d8b   db .d8888. */
/* `~~88~~' 88  `8D d8' `8b 888o  88 88'  YP */
/*    88    88oobY' 88ooo88 88V8o 88 `8bo.   */
/*    88    88`8b   88~~~88 88 V8o88   `Y8b. */
/*    88    88 `88. 88   88 88  V888 db   8D */
/*    YP    88   YD YP   YP VP   V8P `8888Y' */

/**
 * Represents a local-space transformation consisting of position, rotation, and scale.
 *
 * Provides utility methods for translating, rotating, scaling, and querying
 * directional vectors relative to the transform. Also supports computing
 * local and world matrices, point transformation, and hierarchy-aware
 * world matrix calculation via {@link CalculateWorldMatrix}.
 *
 * Static axis constants and scratch objects are shared across all instances
 * to minimise per-frame allocations.
 */
export class Transform {
  /** Unit vector along the positive X axis. */
  static xAxis = new Three.Vector3(1, 0, 0);
  /** Unit vector along the positive Y axis. */
  static yAxis = new Three.Vector3(0, 1, 0);
  /** Unit vector along the positive Z axis. */
  static zAxis = new Three.Vector3(0, 0, 1);

  /** @internal Scratch Vector3 used to avoid per-call allocations. */
  private static vec3 = new Three.Vector3();
  /** @internal Scratch Quaternion used to avoid per-call allocations. */
  private static quat = new Three.Quaternion();
  /** @internal Scratch Euler used to avoid per-call allocations. */
  private static euler = new Three.Euler();
  /** @internal Scratch Vector3 used by {@link lookAt}. */
  private static targetVec = new Three.Vector3();
  /** @internal Scratch Matrix4 used by various methods to avoid allocations. */
  private static matrixDummy = new Three.Matrix4();

  /** @internal Temporary array used by {@link CalculateWorldMatrix} to collect ancestor matrices. */
  private static chain: Three.Matrix4[] = [];

  /**
   * Computes the world matrix for a given entity by walking up its
   * {@link Relationship} hierarchy, composing every ancestor's local
   * matrix from root to leaf.
   *
   * @param world  - The ECS {@link World} to query for components.
   * @param entity - The entity whose world matrix should be calculated.
   * @param input  - An optional pre-allocated {@link Three.Matrix4} to write
   *                 the result into. A new matrix is created if omitted.
   * @returns The computed world matrix (same reference as `input` when provided).
   */
  static CalculateWorldMatrix(
    world: World,
    entity: EntityID,
    input: Three.Matrix4 = new Three.Matrix4(),
  ) {
    this.chain.length = 0;
    let current: EntityID | Nullish = entity;

    while (current) {
      const rel: Immutable<Relationship> | null = world.tryGet(
        current,
        Relationship,
      );
      const t = world.tryGet(current, Transform);
      if (t) {
        this.chain.push(t.calculateMatrix());
      }
      current = rel?.parent;
    }

    input.identity();
    for (let i = this.chain.length - 1; i >= 0; --i) {
      input.multiply(this.chain[i]);
    }

    this.chain.length = 0;
    return input;
  }

  /**
   * Creates a new {@link Transform} with the given position.
   * @param x - X coordinate.
   * @param y - Y coordinate.
   * @param z - Z coordinate.
   * @returns A new Transform instance positioned at (x, y, z).
   */
  static WithPosition(x: number, y: number, z: number) {
    const t = new Transform();
    t.position.set(x, y, z);
    return t;
  }

  /**
   * Creates a new {@link Transform} with the given quaternion rotation.
   * @param x - X component of the quaternion.
   * @param y - Y component of the quaternion.
   * @param z - Z component of the quaternion.
   * @param w - W component of the quaternion.
   * @returns A new Transform instance with the specified rotation.
   */
  static WithRotation(x: number, y: number, z: number, w: number) {
    const t = new Transform();
    t.rotation.set(x, y, z, w);
    return t;
  }

  /**
   * Creates a new {@link Transform} with the given scale.
   * @param x - Scale along the X axis.
   * @param y - Scale along the Y axis.
   * @param z - Scale along the Z axis.
   * @returns A new Transform instance with the specified scale.
   */
  static WithScale(x: number, y: number, z: number) {
    const t = new Transform();
    t.scale.set(x, y, z);
    return t;
  }

  /** Position in local space. */
  public readonly position = new Three.Vector3();

  /** Rotation in local space, stored as a quaternion. */
  public readonly rotation = new Three.Quaternion();

  /** Scale in local space. Defaults to (1, 1, 1). */
  public readonly scale = new Three.Vector3(1, 1, 1);

  /**
   * The local matrix of this transform.
   *
   * This matrix is **not** automatically updated when position, rotation, or
   * scale is changed. Call {@link calculateMatrix} to recompute it.
   */
  public readonly matrix = new Three.Matrix4();

  /**
   * The world matrix of this transform.
   *
   * Updated by the transform propagation system via
   * {@link CalculateWorldMatrix}. Should generally be treated as read-only
   * outside of that system.
   */
  public readonly worldMatrix = new Three.Matrix4();

  /**
   * Recomputes and returns the local matrix by composing
   * {@link position}, {@link rotation}, and {@link scale}.
   * @returns The updated local {@link matrix}.
   */
  calculateMatrix(): Three.Matrix4 {
    return this.matrix.compose(this.position, this.rotation, this.scale);
  }

  /**
   * Translates the transform by a given offset in **world-aligned** axes
   * (does not account for rotation).
   * @param x - Amount to translate on the X axis.
   * @param y - Amount to translate on the Y axis.
   * @param z - Amount to translate on the Z axis.
   * @returns `this` for chaining.
   */
  translate(x: number, y: number, z: number): this {
    this.position.x += x;
    this.position.y += y;
    this.position.z += z;
    return this;
  }

  /**
   * Translates the transform along a given axis, rotated into local space.
   * @param axis - The **normalized** axis to translate along.
   * @param amount - The distance to translate.
   * @returns `this` for chaining.
   */
  translateOnAxis(axis: Three.Vector3, amount: number): this {
    Transform.vec3.copy(axis);
    Transform.quat.copy(this.rotation);
    Transform.quat.normalize();
    Transform.vec3.applyQuaternion(Transform.quat);
    Transform.vec3.multiplyScalar(amount);
    this.position.add(Transform.vec3);
    return this;
  }

  /**
   * Translates the transform along its local X axis.
   * @param amount - The distance to translate.
   * @returns `this` for chaining.
   */
  translateX(amount: number): this {
    this.translateOnAxis(Transform.xAxis, amount);
    return this;
  }

  /**
   * Translates the transform along its local Y axis.
   * @param amount - The distance to translate.
   * @returns `this` for chaining.
   */
  translateY(amount: number): this {
    this.translateOnAxis(Transform.yAxis, amount);
    return this;
  }

  /**
   * Translates the transform along its local Z axis.
   * @param amount - The distance to translate.
   * @returns `this` for chaining.
   */
  translateZ(amount: number): this {
    this.translateOnAxis(Transform.zAxis, amount);
    return this;
  }

  /**
   * Sets the position to the specified coordinates.
   * @param x - X coordinate.
   * @param y - Y coordinate.
   * @param z - Z coordinate.
   * @returns `this` for chaining.
   */
  setPosition(x: number, y: number, z: number): this {
    this.position.set(x, y, z);
    return this;
  }

  /**
   * Sets all three position components to the same scalar value.
   * @param s - The scalar value applied to X, Y, and Z.
   * @returns `this` for chaining.
   */
  setPositionScalar(s: number): this {
    this.position.set(s, s, s);
    return this;
  }

  /**
   * Sets the rotation quaternion directly.
   * @param x - X component of the quaternion.
   * @param y - Y component of the quaternion.
   * @param z - Z component of the quaternion.
   * @param w - W component of the quaternion.
   * @returns `this` for chaining.
   */
  setRotation(x: number, y: number, z: number, w: number): this {
    this.rotation.set(x, y, z, w);
    return this;
  }

  /**
   * Sets the rotation using Euler angles (in radians) with XYZ order.
   * Replaces the current rotation entirely.
   * @param x - Rotation around the X axis in radians.
   * @param y - Rotation around the Y axis in radians.
   * @param z - Rotation around the Z axis in radians.
   * @returns `this` for chaining.
   */
  setRotationEuler(x: number, y: number, z: number): this {
    Transform.euler.set(x, y, z, "XYZ");
    this.rotation.setFromEuler(Transform.euler);
    return this;
  }

  /**
   * Sets the rotation from an existing {@link Three.Euler} instance.
   * Replaces the current rotation entirely.
   * @param euler - The Euler angles to apply.
   * @returns `this` for chaining.
   */
  setRotationFromEuler(euler: Three.Euler): this {
    this.rotation.setFromEuler(euler);
    return this;
  }

  /**
   * Rotates the transform around the X, Y, and Z axes (in local space).
   * This **adds** to the current rotation rather than replacing it.
   * @param x - Rotation around the X axis in radians.
   * @param y - Rotation around the Y axis in radians.
   * @param z - Rotation around the Z axis in radians.
   */
  rotate(x: number, y: number, z: number): void {
    Transform.euler.set(x, y, z, "XYZ");
    Transform.quat.setFromEuler(Transform.euler);
    this.rotation.multiply(Transform.quat); // Multiply appends rotation in local space
  }

  /**
   * Rotates the transform around a specific normalized axis vector.
   * This **adds** to the current rotation rather than replacing it.
   * @param axis - The normalized axis to rotate around.
   * @param angle - The rotation angle in radians.
   */
  rotateOnAxis(axis: Three.Vector3, angle: number): void {
    Transform.quat.setFromAxisAngle(axis, angle);
    this.rotation.multiply(Transform.quat);
  }

  /**
   * Sets the scale to the specified values.
   * @param x - Scale along the X axis.
   * @param y - Scale along the Y axis.
   * @param z - Scale along the Z axis.
   * @returns `this` for chaining.
   */
  setScale(x: number, y: number, z: number): this {
    this.scale.set(x, y, z);
    return this;
  }

  /**
   * Sets all three scale components to the same scalar value.
   * @param s - The uniform scale value.
   * @returns `this` for chaining.
   */
  setScaleScalar(s: number): this {
    this.scale.set(s, s, s);
    return this;
  }

  /**
   * Returns the forward direction (positive Z) relative to the current rotation.
   * Useful for moving "forward" in the direction the entity is facing.
   * @param out - An optional vector to write the result into. A new vector is created if omitted.
   * @returns The forward direction vector.
   */
  getForward(out: Three.Vector3 = new Three.Vector3()): Three.Vector3 {
    return out.set(0, 0, 1).applyQuaternion(this.rotation);
  }

  /**
   * Returns the right direction (positive X) relative to the current rotation.
   * Useful for strafing movement.
   * @param out - An optional vector to write the result into. A new vector is created if omitted.
   * @returns The right direction vector.
   */
  getRight(out: Three.Vector3 = new Three.Vector3()): Three.Vector3 {
    return out.set(1, 0, 0).applyQuaternion(this.rotation);
  }

  /**
   * Returns the up direction (positive Y) relative to the current rotation.
   * @param out - An optional vector to write the result into. A new vector is created if omitted.
   * @returns The up direction vector.
   */
  getUp(out: Three.Vector3 = new Three.Vector3()): Three.Vector3 {
    return out.set(0, 1, 0).applyQuaternion(this.rotation);
  }

  /**
   * Rotates the transform so that it faces the given target point.
   *
   * The target is assumed to be in the same coordinate space as
   * {@link position}. If the target is in world space, convert it to local
   * space first or ensure this transform is a root object.
   *
   * @param target - The point in local/parent space to look at.
   */
  lookAt(target: Three.Vector3): void {
    Transform.targetVec.subVectors(target, this.position).normalize();
    Transform.matrixDummy.lookAt(this.position, target, Transform.yAxis);
    this.rotation.setFromRotationMatrix(Transform.matrixDummy);
  }

  /**
   * Transforms a point from local space to parent space using the
   * current position, rotation, and scale.
   *
   * **Note:** The input vector is mutated in place.
   *
   * @param point - The point to transform (e.g., `new Vector3(0, 0, 5)`).
   * @returns The same vector, now expressed in parent space.
   */
  transformPoint(point: Three.Vector3): Three.Vector3 {
    this.calculateMatrix();
    return point.applyMatrix4(this.matrix);
  }

  /**
   * Inverse of {@link transformPoint}. Converts a point expressed relative
   * to the parent into the local space of this transform.
   *
   * **Note:** The input vector is mutated in place.
   *
   * @param point - The point to inverse-transform.
   * @returns The same vector, now expressed in local space.
   */
  inverseTransformPoint(point: Three.Vector3): Three.Vector3 {
    this.calculateMatrix();
    Transform.matrixDummy.copy(this.matrix).invert();
    return point.applyMatrix4(Transform.matrixDummy);
  }

  /**
   * Creates an independent deep copy of this transform, including
   * position, rotation, scale, local matrix, and world matrix.
   * @returns A new {@link Transform} with identical values.
   */
  clone(): Transform {
    const t = new Transform();
    this.copy(t);
    return t;
  }

  /**
   * Copies all properties from another transform into this one.
   * @param source - The transform to copy values from.
   * @returns `this` for chaining.
   */
  copy(source: Transform): Transform {
    this.position.copy(source.position);
    this.rotation.copy(source.rotation);
    this.scale.copy(source.scale);
    this.matrix.copy(source.matrix);
    this.worldMatrix.copy(<Mutable<Three.Matrix4>>source.worldMatrix);
    return this;
  }
}

/*  d888b  d8888b. d888888b d8888b. */
/* 88' Y8b 88  `8D   `88'   88  `8D */
/* 88      88oobY'    88    88   88 */
/* 88  ooo 88`8b      88    88   88 */
/* 88. ~8~ 88 `88.   .88.   88  .8D */
/*  Y888P  88   YD Y888888P Y8888D' */

/**
 * A mesh that renders an infinite grid pattern extending outward from the camera.
 *
 * The grid follows the camera and fades out at a configurable distance, creating
 * the illusion of an endless plane. Two grid sizes can be specified to create
 * major and minor grid lines.
 *
 * @example
 * ```ts
 * // Create a grid on the XZ plane with default settings
 * const grid = new InfiniteGridMesh();
 *
 * // Create a custom grid with larger cells and different color
 * const customGrid = new InfiniteGridMesh(
 *   5,                              // Minor grid size
 *   25,                             // Major grid size
 *   new Three.Color("#3366ff"),    // Grid color
 *   8000,                           // View distance
 *   "xzy"                           // Axes (XZ plane with Y up)
 * );
 * ```
 */
export class InfiniteGridMesh extends Three.Mesh {
  /**
   * Creates a new infinite grid mesh.
   *
   * @param size1 - The spacing of the minor grid lines. Default is `1`.
   * @param size2 - The spacing of the major grid lines. Default is `10`.
   * @param color - The color of the grid lines. Default is light gray (`#e5e5e5`).
   * @param distance - The maximum view distance before the grid fades to transparent. Default is `4000`.
   * @param axes - A three-character string defining the grid plane and up axis.
   *               The first two characters define the plane axes, the third is the up axis.
   *               Default is `"xzy"` (grid on XZ plane, Y up).
   */
  constructor(
    size1 = 1,
    size2 = 10,
    color: Three.Color = new Three.Color("#e5e5e5"),
    distance = 4000,
    axes = "xzy",
  ) {
    const planeAxes = axes.substring(0, 2);
    const geometry = new Three.PlaneGeometry(2, 2, 1, 1);
    const material = new Three.ShaderMaterial({
      side: Three.DoubleSide,
      uniforms: {
        uSize1: {
          value: size1,
        },
        uSize2: {
          value: size2,
        },
        uColor: {
          value: color,
        },
        uDistance: {
          value: distance,
        },
      },
      transparent: true,
      vertexShader: `
								varying vec3 worldPosition;
						uniform float uDistance;

						void main() {
										vec3 pos = position.${axes} * uDistance;
										pos.${planeAxes} += cameraPosition.${planeAxes};
										worldPosition = pos;
										gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
								}
						`,
      fragmentShader: `
								varying vec3 worldPosition;
								uniform float uSize1;
								uniform float uSize2;
								uniform vec3 uColor;
								uniform float uDistance;

								float getGrid(float size) {
									vec2 r = worldPosition.${planeAxes} / size;
										vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
										float line = min(grid.x, grid.y);
										return 1.0 - min(line, 1.0);
								}

								void main() {
										float d = 1.0 - min(distance(cameraPosition.${planeAxes}, worldPosition.${planeAxes}) / uDistance, 1.0);

										float g1 = getGrid(uSize1);
										float g2 = getGrid(uSize2);

										gl_FragColor = vec4(uColor.rgb, mix(g2, g1, g1) * pow(d, 3.0));
										gl_FragColor.a = mix(0.5 * gl_FragColor.a, gl_FragColor.a, g2);

										if ( gl_FragColor.a <= 0.0 ) discard;
								}
						`,
    });
    super(geometry, material);
    this.frustumCulled = false;
  }
}

/* d8888b. d8888b. d888888b .88b  d88. */
/* 88  `8D 88  `8D   `88'   88'YbdP`88 */
/* 88oodD' 88oobY'    88    88  88  88 */
/* 88~~~   88`8b      88    88  88  88 */
/* 88      88 `88.   .88.   88  88  88 */
/* 88      88   YD Y888888P YP  YP  YP */

const cubeGeometry = new Three.BoxGeometry(1, 1, 1);
const sphereGeometry = new Three.SphereGeometry(0.5, 32, 16);
const planeGeometry = new Three.PlaneGeometry(1, 1);
const cylinderGeometry = new Three.CylinderGeometry(0.5, 0.5, 1, 32);
const coneGeometry = new Three.ConeGeometry(0.5, 1, 32);
const torusGeometry = new Three.TorusGeometry(0.5, 0.2, 16, 100);

export class PrimitiveCube extends Three.Mesh {
  constructor(
    args: {
      color?: Three.ColorRepresentation;
      material?: Three.Material;
    } = {},
  ) {
    const material =
      args.material ??
      new Three.MeshStandardMaterial({ color: args.color ?? 0xffffff });

    super(cubeGeometry, material);
  }
}

export class PrimitiveSphere extends Three.Mesh {
  constructor(
    args: {
      color?: Three.ColorRepresentation;
      material?: Three.Material;
    } = {},
  ) {
    const material =
      args.material ??
      new Three.MeshStandardMaterial({ color: args.color ?? 0xffffff });

    super(sphereGeometry, material);
  }
}

export class PrimitivePlane extends Three.Mesh {
  constructor(
    args: {
      color?: Three.ColorRepresentation;
      material?: Three.Material;
    } = {},
  ) {
    const material =
      args.material ??
      new Three.MeshStandardMaterial({ color: args.color ?? 0xffffff });

    super(planeGeometry, material);
  }
}

export class PrimitiveCylinder extends Three.Mesh {
  constructor(
    args: {
      color?: Three.ColorRepresentation;
      material?: Three.Material;
    } = {},
  ) {
    const material =
      args.material ??
      new Three.MeshStandardMaterial({ color: args.color ?? 0xffffff });

    super(cylinderGeometry, material);
  }
}

export class PrimitiveCone extends Three.Mesh {
  constructor(
    args: {
      color?: Three.ColorRepresentation;
      material?: Three.Material;
    } = {},
  ) {
    const material =
      args.material ??
      new Three.MeshStandardMaterial({ color: args.color ?? 0xffffff });

    super(coneGeometry, material);
  }
}

export class PrimitiveTorus extends Three.Mesh {
  constructor(
    args: {
      color?: Three.ColorRepresentation;
      material?: Three.Material;
    } = {},
  ) {
    const material =
      args.material ??
      new Three.MeshStandardMaterial({ color: args.color ?? 0xffffff });

    super(torusGeometry, material);
  }
}

/* db       .d88b.   .d88b.  db   dD */
/* 88      .8P  Y8. .8P  Y8. 88 ,8P' */
/* 88      88    88 88    88 88,8P   */
/* 88      88    88 88    88 88`8b   */
/* 88booo. `8b  d8' `8b  d8' 88 `88. */
/* Y88888P  `Y88P'   `Y88P'  YP   YD */

/**
 * Component that enables free-look camera controls for an entity with a {@link Transform}.
 *
 * Provides first-person-style camera movement with mouse-look and WASD controls.
 * The associated system reads {@link Input} and updates both rotation (via mouse delta)
 * and position (via keyboard input) each frame.
 *
 * @remarks
 * This component is typically paired with a {@link Transform} and a camera component.
 *
 * @example
 * ```ts
 * world.spawn(
 *   new Three.PerspectiveCamera(75, 16/9, 0.1, 1000),
 *   new Transform(),
 *   new FreeLookTarget(0.5, 20, 3)
 * );
 * ```
 */
export class FreeLookTarget {
  /**
   * Creates a new FreeLookTarget component.
   *
   * @param lookSpeed - Sensitivity multiplier for mouse look rotation. Default is `0.3`.
   * @param moveSpeed - Base movement speed in units per second. Default is `15`.
   * @param sprintMultiplier - Multiplier applied to movement speed when sprinting (holding Shift). Default is `5`.
   */
  constructor(
    public lookSpeed: number = 0.3,
    public moveSpeed: number = 15,
    public sprintMultiplier: number = 5,
  ) {}

  /** Current velocity vector applied to the transform each frame. */
  velocity = new Three.Vector3();

  /** Current rotation in Euler angles (YXZ order). Updated by mouse input and applied to the transform. */
  rotation = new Three.Euler(0, 0, 0, "YXZ");
}

export const threeFreelookSystem = System(
  "Three::FreeLookSystem",
  [Input, Time, Query(Mut(FreeLookTarget), Mut(Transform))],
  (input, time, freeLookQuery) => {
    const delta = time.delta;

    let press = 0;
    if (input.pressed(KeyCodes.W) || input.pressed(KeyCodes.ArrowUp))
      press |= 1 << 0; // FORWARD
    if (input.pressed(KeyCodes.A) || input.pressed(KeyCodes.ArrowLeft))
      press |= 1 << 1; // LEFT
    if (input.pressed(KeyCodes.D) || input.pressed(KeyCodes.ArrowRight))
      press |= 1 << 2; // RIGHT
    if (input.pressed(KeyCodes.S) || input.pressed(KeyCodes.ArrowDown))
      press |= 1 << 3; // BACK
    if (input.pressed(KeyCodes.Space)) press |= 1 << 4; // UP
    if (input.pressed(KeyCodes.ControlLeft)) press |= 1 << 5; // DOWN
    if (input.pressed(KeyCodes.ShiftLeft)) press |= 1 << 6; // SPRINT

    for (const [_, freeLookMut, transformMut] of freeLookQuery) {
      const freeLook = freeLookMut.deref();
      const transform = transformMut.deref();

      if (input.pressed(MouseCodes.Left)) {
        const mX = input.mouseDeltaX ?? 0;
        const mY = input.mouseDeltaY ?? 0;

        freeLook.rotation.y -= mX * freeLook.lookSpeed * delta;
        freeLook.rotation.x -= mY * freeLook.lookSpeed * delta;
        freeLook.rotation.x = Math.max(-60, Math.min(60, freeLook.rotation.x)); // Clamp

        freeLook.rotation.z = 0;
        transform.rotation.setFromEuler(freeLook.rotation);
      }

      let actualMoveSpeed = delta * freeLook.moveSpeed;
      if (press & (1 << 6)) actualMoveSpeed *= freeLook.sprintMultiplier;

      if (press & (1 << 0)) freeLook.velocity.z = -actualMoveSpeed;
      else if (press & (1 << 3)) freeLook.velocity.z = actualMoveSpeed;
      else freeLook.velocity.z = 0;

      if (press & (1 << 1)) freeLook.velocity.x = -actualMoveSpeed;
      else if (press & (1 << 2)) freeLook.velocity.x = actualMoveSpeed;
      else freeLook.velocity.x = 0;

      if (press & (1 << 4)) freeLook.velocity.y = actualMoveSpeed;
      else if (press & (1 << 5)) freeLook.velocity.y = -actualMoveSpeed;
      else freeLook.velocity.y = 0;

      const veloLen = freeLook.velocity.length();

      if (veloLen > freeLook.moveSpeed) {
        freeLook.velocity
          .divideScalar(veloLen)
          .multiplyScalar(freeLook.moveSpeed);
      }

      transform.translateX(freeLook.velocity.x);
      transform.translateY(freeLook.velocity.y);
      transform.translateZ(freeLook.velocity.z);
    }
  },
).enforceSchedules(Schedule.PreUpdate, Schedule.Update, Schedule.PostUpdate);

/* .d8888. db   dD db    db */
/* 88'  YP 88 ,8P' `8b  d8' */
/* `8bo.   88,8P    `8bd8'  */
/*   `Y8b. 88`8b      88    */
/* db   8D 88 `88.    88    */
/* `8888Y' YP   YD    YP    */

import { Sky } from "three/examples/jsm/objects/Sky.js";

/**
 * A skybox that uses physically-based rendering for realistic atmospheric scattering.
 * This is a wrapper around Three.js's Sky implementation with additional controls.
 */
export class PhysicalSky extends Three.Object3D {
  transformless = true;

  /**
   * The turbidity of the atmosphere.
   * Controls the amount of haze or clarity in the sky.
   * Higher values create a more hazy or polluted appearance.
   */
  get turbidity(): number {
    return this.material.uniforms.turbidity.value;
  }

  set turbidity(v: number) {
    this.material.uniforms.turbidity.value = v;
  }

  /**
   * The rayleigh scattering coefficient.
   * Controls the amount of blue light scattered in the atmosphere.
   * Higher values create a more blue sky.
   */
  get rayleigh(): number {
    return this.material.uniforms.rayleigh.value;
  }

  set rayleigh(v: number) {
    this.material.uniforms.rayleigh.value = v;
  }

  /**
   * The mie scattering coefficient.
   * Controls the amount of haze and scattering from particles in the atmosphere.
   * Higher values create a more hazy or foggy appearance.
   */
  get mieCoefficient(): number {
    return this.material.uniforms.mieCoefficient.value;
  }

  set mieCoefficient(v: number) {
    this.material.uniforms.mieCoefficient.value = v;
  }

  /**
   * The mie directional g factor.
   * Controls the anisotropy of the mie scattering.
   * A value of 0 means isotropic scattering, while a value of 1 means forward scattering.
   */
  get mieDirectionalG(): number {
    return this.material.uniforms.mieDirectionalG.value;
  }

  set mieDirectionalG(v: number) {
    this.material.uniforms.mieDirectionalG.value = v;
  }

  /**
   * The elevation of the sun in degrees.
   * Controls how high the sun is in the sky.
   * 0 is on the horizon, 90 is directly overhead.
   */
  get elevation(): number {
    return this.#elevation;
  }

  set elevation(v: number) {
    this.#elevation = v;
    this.updateSunPosition();
  }

  /**
   * The azimuth of the sun in degrees.
   * Controls the direction the sun is facing.
   * 0 is north, 90 is east, 180 is south, 270 is west.
   */
  get azimuth(): number {
    return this.#azimuth;
  }

  set azimuth(v: number) {
    this.#azimuth = v;
    this.updateSunPosition();
  }

  get material() {
    return this.object3d.material as Three.ShaderMaterial;
  }

  constructor() {
    super();
    this.object3d.scale.setScalar(450000);
    this.add(this.object3d);
    this.updateSunPosition();
    this.object3d.updateMatrixWorld();
  }

  private updateSunPosition() {
    const phi = Three.MathUtils.degToRad(90 - this.#elevation);
    const theta = Three.MathUtils.degToRad(this.#azimuth);
    this.#sunPosition.setFromSphericalCoords(20, phi, theta);
    this.material.uniforms.sunPosition.value.copy(this.#sunPosition);
    this.object3d.material.needsUpdate = true;
    this.object3d.matrixWorldNeedsUpdate = true;
  }

  object3d = new Sky();
  #sunPosition = new Three.Vector3();
  #elevation = 2;
  #azimuth = 180;
}

/* d8888b. d88888b d8888b. db    db  d888b  */
/* 88  `8D 88'     88  `8D 88    88 88' Y8b */
/* 88   88 88ooooo 88oooY' 88    88 88      */
/* 88   88 88~~~~~ 88~~~b. 88    88 88  ooo */
/* 88  .8D 88.     88   8D 88b  d88 88. ~8~ */
/* Y8888D' Y88888P Y8888P' ~Y8888P'  Y888P  */

class DebugSystemState {}

export const debugSystemInit = System(
  "Three::DebugSystemInit",
  [World],
  () => {},
).enforceSchedules(Schedule.PreStartup, Schedule.Startup, Schedule.PostStartup);

export const debugRenderSystem = System(
  "Three::DebugSystemRender",
  [World],
  () => {},
);

/* .d8888.  .o88b. d88888b d8b   db d88888b */
/* 88'  YP d8P  Y8 88'     888o  88 88'     */
/* `8bo.   8P      88ooooo 88V8o 88 88ooooo */
/*   `Y8b. 8b      88~~~~~ 88 V8o88 88~~~~~ */
/* db   8D Y8b  d8 88.     88  V888 88.     */
/* `8888Y'  `Y88P' Y88888P VP   V8P Y88888P */

class Object3DPool {
  #storage = new Set<Three.Object3D>();

  add(object3d: Three.Object3D) {
    this.#storage.add(object3d);
  }

  delete(object3d: Three.Object3D) {
    this.#storage.delete(object3d);
  }

  [Symbol.iterator]() {
    return this.#storage.values();
  }

  destroy() {
    this.#storage.clear();
  }
}

/**
 * Container for Three.js scene data, including the root node and a list of all Three.js objects in the scene.
 */
export class SceneData {
  readonly scene = new Three.Scene();
  readonly object3dPool = new Object3DPool();
}

/* d8888b. db      db    db  d888b  d888888b d8b   db */
/* 88  `8D 88      88    88 88' Y8b   `88'   888o  88 */
/* 88oodD' 88      88    88 88         88    88V8o 88 */
/* 88~~~   88      88    88 88  ooo    88    88 V8o88 */
/* 88      88booo. 88b  d88 88. ~8~   .88.   88  V888 */
/* 88      Y88888P ~Y8888P'  Y888P  Y888888P VP   V8P */

const cachedMatrixAutoUpdate = Symbol.for(
  "Three::ObjectSyncSystem::cachedMatrixAutoUpdate",
);

const cachedMatrixWorldAutoUpdate = Symbol.for(
  "Three::ObjectSyncSystem::cachedMatrixWorldAutoUpdate",
);

export const threeObjectSyncSystem = System(
  "Three::ObjectSyncSystem",
  [World, Triggerer, SceneData],
  (world, triggerer, threeData) => {
    // Insert component in scene
    triggerer.addResponder(
      [ComponentInserted, Three.Object3D],
      (_, object3d) => {
        const entity = world.getEntity(object3d);
        assertNumber(entity, "EntityID expected for Three object sync");

        (<any>object3d)[cachedMatrixAutoUpdate] = object3d.matrixAutoUpdate;
        (<any>object3d)[cachedMatrixWorldAutoUpdate] =
          object3d.matrixWorldAutoUpdate;

        object3d.matrixAutoUpdate = false;
        object3d.matrixWorldAutoUpdate = false;

        threeData.object3dPool.add(object3d);

        threeData.scene!.add(object3d);
      },
    );

    // Remove component from scene
    triggerer.addResponder(
      [ComponentRemovalScheduled, Three.Object3D],
      (_, object3d) => {
        const entity = world.getEntity(object3d);
        assertNumber(entity, "EntityID expected for Three object sync");

        object3d.matrixAutoUpdate = (<any>object3d)[cachedMatrixAutoUpdate];
        object3d.matrixWorldAutoUpdate = (<any>object3d)[
          cachedMatrixWorldAutoUpdate
        ];

        threeData.object3dPool.delete(object3d);

        threeData.scene!.remove(object3d);
      },
    );
  },
).enforceSchedules(Schedule.PreStartup, Schedule.Startup, Schedule.PostStartup);

export const threeTransformPropagationSystem = System(
  "Three::TransformPropagationSystem",
  [World, SceneData, Query(Mutated(Transform))],
  (world, threeData, transforms) => {
    // update mutated transforms
    for (const [entity, transform] of transforms) {
      Transform.CalculateWorldMatrix(world, entity, transform.worldMatrix);
    }

    for (const object3d of threeData.object3dPool) {
      const entity = world.getEntity(object3d);
      if (!entity) continue;

      // can short-circuit if there's a direct transform
      const transform = world.tryGet(entity, Transform);
      if (transform) {
        object3d.matrixWorld.copy(<Three.Matrix4>transform.worldMatrix);
        continue;
      }

      // otherwise, need to find the closest parent with a transform
      let parent = world.tryGet(entity, Relationship)?.parent;
      while (parent) {
        const parentTransform = world.tryGet(parent, Transform);
        if (parentTransform) {
          object3d.matrixWorld.copy(<Three.Matrix4>parentTransform.worldMatrix);
          break;
        }
        parent = world.tryGet(parent, Relationship)?.parent;
      }

      // no transform found in hierarchy, set to identity
      object3d.matrixWorld.identity();
    }
  },
).enforceSchedules(Schedule.PostUpdate, Schedule.WorldFlush);

/**
 * Plugin bundle for integrating Three.js the ECS.
 *
 * Provides two pre-configured plugin presets and direct access to the
 * individual systems and resources for custom setups:
 *
 * - **Default** – Registers all Three.js resources and systems, including
 *   object syncing, free-look camera controls, canvas/camera synchronization,
 *   and transform propagation.
 * - **Minimal** – Registers only the essential resources and systems needed
 *   for object syncing and transform propagation, omitting non-required systems.
 */
export const ThreePlugin = {
  Default: Plugin("ThreeDefaults", (app: App) => {
    app
      .addResources(SceneData, Object3DPool)
      .addSystems(Schedule.PreStartup, threeObjectSyncSystem)
      .addSystems(Schedule.PreUpdate, threeFreelookSystem)
      .addSystems(Schedule.Update, threeCanvasSyncSystem)
      .addSystems(Schedule.WorldFlush, threeTransformPropagationSystem);
  }),
  Minimal: Plugin("ThreeMinimal", (app: App) => {
    app
      .addResources(SceneData, Object3DPool)
      .addSystems(Schedule.PreStartup, threeObjectSyncSystem)
      .addSystems(Schedule.WorldFlush, threeTransformPropagationSystem);
  }),
  Systems: {
    ObjectSyncSystem: threeObjectSyncSystem,
    CanvasSyncSystem: threeCanvasSyncSystem,
    FreeLookSystem: threeFreelookSystem,
    TransformPropagationSystem: threeTransformPropagationSystem,
  },
  Resources: {
    SceneData,
    Object3DPool,
  },
};
