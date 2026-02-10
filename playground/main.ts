// SPDX-License-Identifier: AGPL-3.0-or-later

/*_,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,_

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

_,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,_*/

import * as Three from "three";
import {
  App,
  AppMode,
  Configuration,
  Mut,
  Query,
  Schedule,
  System,
  World,
} from "../src/core.ts";
import { Assets, make, Ref, Time } from "../src/lib.ts";
import {
  SyncCameraComponent,
  ThreeSceneData,
  ThreePlugin,
  Transform,
  FreeLookTarget,
  InfiniteGridMesh,
  PhysicalSky,
} from "../src/three.ts";

class Config extends Configuration {
  mode = AppMode.Dev;
}

const Player = Symbol.for("player");
const ActiveCamera = Symbol.for("active camera");

class RenderPipeline {
  canvas: Ref<HTMLCanvasElement> = make(
    document.getElementById("viewport") as HTMLCanvasElement,
  );

  renderer: Ref<Three.WebGLRenderer> = make(
    new Three.WebGLRenderer({
      canvas: this.canvas.deref(),
      antialias: true,
    }),
  );

  render(scene: Three.Scene, camera: Three.PerspectiveCamera) {
    this.renderer.deref().render(scene, camera);
  }

  resize() {
    this.renderer.tryDeref()?.setSize(window.innerWidth, window.innerHeight);
  }

  constructor() {
    this.resize = this.resize.bind(this);
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  destructor() {
    window.removeEventListener("resize", this.resize);
    this.renderer.drop();
    this.canvas.drop();
  }
}

const startupSystem = System(
  "Spawn",
  [World, RenderPipeline],
  (world, ThreeData) => {
    // spawn environment entities
    world.spawn(new InfiniteGridMesh());
    world.spawn(new PhysicalSky());
    world.spawn(new Three.AmbientLight("white", 4));

    // spawn camera
    world.spawn(
      Transform.WithPosition(0, 0, 5),
      new Three.PerspectiveCamera(75, undefined, 0.1, 1000),
      new SyncCameraComponent(ThreeData.canvas.deref()),
      new FreeLookTarget({ lookSpeed: 0.35 }),
      ActiveCamera,
    );

    // spawn meshes
    const parent = world.spawn(
      new Three.Mesh(
        new Three.BoxGeometry(1, 1, 1),
        new Three.MeshBasicMaterial({ color: "red" }),
      ),
      Transform.WithPosition(0, 0, 0),
      Player,
    );

    const child = world.spawn(
      new Three.Mesh(
        new Three.BoxGeometry(1, 1, 1),
        new Three.MeshBasicMaterial({ color: "green" }),
      ),
      Transform.WithPosition(0, 1.5, 0),
    );

    world.parent(parent, child);
  },
);

const updateSystem = System(
  "Update",
  // query all entities with a transform & the player tag
  [Time, Query(Mut(Transform), Player)],
  (time, playerMeshes) => {
    for (const [_, transform] of playerMeshes) {
      transform.deref().rotate(0, 1 * time.delta, 0);
    }
  },
);

const renderSystem = System(
  "Render",
  [World, RenderPipeline, ThreeSceneData, Query(ActiveCamera)],
  (world, renderPipeline, { scene }, activeCameraQuery) => {
    const camera = world.get(
      activeCameraQuery.singleEntity(),
      Three.PerspectiveCamera,
    );
    renderPipeline.render(scene, <Three.PerspectiveCamera>camera);
  },
);

App.WithDefaults(Config)
  .addResources(Assets, RenderPipeline)
  .addPlugins(ThreePlugin.Default)
  .addSystems(Schedule.Startup, startupSystem)
  .addSystems(Schedule.Update, updateSystem)
  .addSystems(Schedule.PostUpdate, renderSystem)
  .run();
