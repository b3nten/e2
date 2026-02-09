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
  Relationship,
  Schedule,
  System,
  World,
} from "../src/core.ts";
import { Assets, Time, type Immutable, type Mutable } from "../src/lib.ts";
import {
  SyncCameraComponent,
  SceneData,
  ThreePlugin,
  Transform,
  FreeLookTarget,
  InfiniteGridMesh,
  PhysicalSky,
} from "../src/three.ts";

class Config extends Configuration {
  mode = AppMode.Dev;
}

const player = Symbol.for("player");
const activeCamera = Symbol.for("activeCamera");

class RenderPipeline {
  canvas = document.getElementById("viewport") as HTMLCanvasElement;

  renderer = new Three.WebGLRenderer({
    canvas: this.canvas,
    antialias: true,
  });

  render(scene: Three.Scene, camera: Three.Camera) {
    this.renderer.render(scene, camera);
  }
}

const startupSystem = System(
  "Startup",
  [World, RenderPipeline],
  (world, ThreeData) => {
    world.spawn(new InfiniteGridMesh());
    world.spawn(new PhysicalSky());
    world.spawn(new Three.AmbientLight("white", 4));

    world.spawn(
      Transform.WithPosition(0, 0, 5),
      new Three.PerspectiveCamera(75, 16 / 9, 0.1, 1000),
      new SyncCameraComponent(ThreeData.canvas),
      new FreeLookTarget(),
      activeCamera,
    );

    const parent = world.spawn(
      new Three.Mesh(
        new Three.BoxGeometry(1, 1, 1),
        new Three.MeshBasicMaterial({ color: "red" }),
      ),
      Transform.WithPosition(0, 0, 0),
      player,
    );

    const child = world.spawn(
      new Three.Mesh(
        new Three.BoxGeometry(1, 1, 1),
        new Three.MeshBasicMaterial({ color: "green" }),
      ),
      Transform.WithPosition(0, 1, 0),
    );

    Relationship.Parent(world, parent, child);
  },
);

const updateSystem = System(
  "Update",
  [Time, Query(Mut(Transform), Symbol.for("player"), Three.Mesh)],
  (time, meshes) => {
    for (const [entity, transform, player, mesh] of meshes) {
      transform.deref().rotate(0, 1 * time.delta, 0);
    }
  },
);

const renderSystem = System(
  "RenderSystem",
  [World, RenderPipeline, SceneData, Query(activeCamera)],
  (world, renderPipeline, { scene }, cameraQuery) => {
    let camera: Immutable<Three.Camera> | null = null;

    const first = cameraQuery.iter().next();
    if (!first.done) {
      const [entity] = first.value;
      camera =
        world.tryGet(entity, Three.PerspectiveCamera) ??
        world.tryGet(entity, Three.OrthographicCamera);
    }

    if (!camera) {
      console.warn("No active camera found for Three render system");
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    renderPipeline.canvas.width = width;
    renderPipeline.canvas.height = height;
    renderPipeline.renderer.setSize(width, height, false);

    renderPipeline.render(scene, <Mutable<Three.Camera>>camera);
  },
);

App.WithDefaults(Config)
  .addResources(Assets, RenderPipeline)
  .addPlugins(ThreePlugin.Default)
  .addSystems(Schedule.Startup, startupSystem)
  .addSystems(Schedule.Update, updateSystem)
  .addSystems(Schedule.PostUpdate, renderSystem)
  .run();
