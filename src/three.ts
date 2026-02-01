/*.--.
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
                  `...-'     dp                                `...-'*/

import * as Three from "three";
import {
  type EntityID,
  Query,
  Relationship,
  System,
  Triggerer,
  World,
} from "./core";
import type { WebGPURenderer } from "three/webgpu";
import type { Immutable, Mutable, Nullish } from "./lib";

/*_,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,_

This module is for the Three.js integration to Elysia

_,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,_*/

/**
 * Convention for flagging an entity with a sibling Camera component as the active camera.
 */
export class ActiveCameraComponent {}

export class Transform {
  static xAxis = new Three.Vector3(1, 0, 0);
  static yAxis = new Three.Vector3(0, 1, 0);
  static zAxis = new Three.Vector3(0, 0, 1);
  private static vec3 = new Three.Vector3();
  private static quat = new Three.Quaternion();

  private static chain: Three.Matrix4[] = []
  static CalculateWorldMatrix(
    world: World,
    entity: EntityID,
    input: Three.Matrix4 = new Three.Matrix4(),
  ) {
    this.chain.length = 0;
    let current: EntityID | Nullish = entity;

    while (current) {
      const rel: Immutable<Relationship> | null = world.tryGet(current, Relationship);
      const t = world.tryGet(current, Transform);
      if (t) {
        this.chain.push(t.calculateMatrix());
      }
      current = rel?.parent
    }

    input.identity();
    for (let i = this.chain.length - 1; i >= 0; --i) {
      input.multiply(this.chain[i]);
    }

    this.chain.length = 0;
    return input;
  }

  static WithPosition(x: number, y: number, z: number) {
    const t = new Transform();
    t.position.set(x, y, z);
    return t;
  }

  static WithRotation(x: number, y: number, z: number, w: number) {
    const t = new Transform();
    t.rotation.set(x, y, z, w);
    return t;
  }

  static WithScale(x: number, y: number, z: number) {
    const t = new Transform();
    t.scale.set(x, y, z);
    return t;
  }

  /** Position in local space */
  public readonly position = new Three.Vector3();

  /** Rotation in local space */
  public readonly rotation = new Three.Quaternion();

  /** Scale in local space */
  public readonly scale = new Three.Vector3(1, 1, 1);

  /**
   * The local matrix of this transform.
   *
   * This matrix is not automatically updated when pos/rot/scale is changed.
   * Use {@link calculateMatrix}.
   */
  public readonly matrix = new Three.Matrix4();

  /** Calculate the local matrix of this transform */
  calculateMatrix(): Three.Matrix4 {
    return this.matrix.compose(this.position, this.rotation, this.scale);
  }

  /**
   * Translate the transform on a given axis.
   * @param axis The normalied axis to translate on.
   * @param amount The amount to translate.
   */
  translateOnAxis(axis: Three.Vector3, amount: number): void {
    Transform.vec3.copy(axis);
    Transform.quat.copy(this.rotation);
    Transform.quat.normalize();
    Transform.vec3.applyQuaternion(Transform.quat);
    Transform.vec3.multiplyScalar(amount);
    this.position.add(Transform.vec3);
  }

  translateX(amount: number): void {
    this.translateOnAxis(Transform.xAxis, amount);
  }

  translateY(amount: number): void {
    this.translateOnAxis(Transform.yAxis, amount);
  }

  translateZ(amount: number): void {
    this.translateOnAxis(Transform.zAxis, amount);
  }

  setPosition(x: number, y: number, z: number): this {
    this.position.set(x, y, z);
    return this;
  }

  setPositionScalar(s: number): this {
    this.position.set(s, s, s);
    return this;
  }

  setRotation(x: number, y: number, z: number, w: number): this {
    this.rotation.set(x, y, z, w);
    return this;
  }

  setScale(x: number, y: number, z: number): this {
    this.scale.set(x, y, z);
    return this;
  }

  setScaleScalar(s: number): this {
    this.scale.set(s, s, s);
    return this;
  }

  clone(): Transform {
    const t = new Transform();
    this.copy(t);
    return t;
  }

  copy(source: Transform): Transform {
    this.position.copy(source.position);
    this.rotation.copy(source.rotation);
    this.scale.copy(source.scale);
    this.matrix.copy(source.matrix);
    this.worldMatrix.copy(source.worldMatrix);
    return this;
  }
}

export class ThreeData {
  scene?: Three.Scene;
  renderer?: Three.WebGLRenderer | WebGPURenderer;
  canvas?: HTMLCanvasElement | OffscreenCanvas;
}

export const transformUpdateSystem = System(
  "Three::TransformUpdateSystem",
  [World],
  (world) => {
    for (const transform of world.mutatedComponentList.ofType(Transform)) {
      const entity = world.getEntity(transform);
      if (world.willRemove(entity, Transform) || world.willDespawn(entity)) {
        continue;
      }
      // calculate world matrixes
      // update associated
    }
  },
);

// startup system
export const threeObjectSyncSystem = System(
  "Three::ObjectSyncSystem",
  [World, Triggerer],
  (world, triggerer) => {
    // transform added
    triggerer.addResponder([], () => {});

    // transform removed
    triggerer.addResponder([], () => {});

    for (const type of [Three.Mesh, Three.Object3D]) {
      // when added
      triggerer.addResponder([], () => {});

      // when removed
      triggerer.addResponder([], () => {});
    }
  },
);

/*

  Three.Renderer ??
  Canvas -> ThreeData ?
  Scene -> ThreeData ?
  Camera -> World

  render func

  update camera
  update renderer with dimensions (from canvas)
  viewport dimensions??

*/

// poststartup
export const threeRenderSystemInit = System(
  "Three::RenderSystem::Init",
  [ThreeData],
  (threeData) => {

  },
);

// postupdate
export const threeRenderSystemRender = System(
  "Three::RenderSystem::Renderer",
  [ThreeData],
  (threeData) => {},
);
