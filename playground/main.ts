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

import {
  App,
  AppMode,
  Configuration,
  Schedule,
  System,
  World,
} from "../src/core.ts";
import { Assets, Event, Handle } from "../src/lib.ts";
import { TextureAsset, ThreePlugin } from "../src/three.ts";
import * as Three from "three";

const SomeEvent = Event<{ value: string }>("SomeEvent");

class StaticAssets {
  texture!: Handle<Three.Texture>;
}

const startupSystem = System(
  "Startup",
  [Assets, StaticAssets],
  (assets, staticAssets) => {
    staticAssets.texture = assets.load(TextureAsset("/assets/crate.jpg"));
    staticAssets.texture.promise.then((texture) => {
      console.log(
        "Texture loaded:",
        texture.ok ? texture.value : texture.error,
      );
    });
  },
);

const updateSystem = System(
  "Update",
  [World, StaticAssets],
  (world, staticAssets) => {},
);

const cleanupSystem = System("Cleanup", [World], (world) => {});

App.WithDefaults(
  new (class extends Configuration {
    mode = AppMode.Dev;
  })(),
)
  .addResources(Assets, StaticAssets)
  .addEvents(SomeEvent)
  .addPlugins(ThreePlugin.default)
  .addSystems(Schedule.Startup, startupSystem)
  .addSystems(Schedule.Update, updateSystem)
  .addSystems(Schedule.Destroy, cleanupSystem)
  .run();
