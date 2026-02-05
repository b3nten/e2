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
  Clock,
  EvReader,
  Mut,
  Query,
  Schedule,
  System,
  World,
  Event,
  EvWriter,
  Triggerer,
  EntitySpawned,
  ComponentInserted,
  Configuration,
  AppMode,
  Resources,
  Assets,
} from "../src/core.ts";

const TestEvent = Event<string>("testEvent");

class Foo {
  lol = 1;
}
class Bar {}

const assets = new Assets();

const fooAsset = (value: string) => ({
  path: "Foo",
  load: () => {
    return new Promise((r) => setTimeout(() => r(value), 500));
  },
});

const handle = assets.load(fooAsset("COOL!"));

await handle.promise.then((x) => {
  if (x.ok) {
    console.log(x.value);
  } else {
    console.log("WTF");
  }
});

// App.WithDefaults(class extends Configuration { mode = AppMode.Dev })
//   .addEvents(TestEvent)
//   .addSystems(
//     Schedule.Startup,
//     System("Init", [World, Triggerer], (w, t) => {
//       t.addResponder([EntitySpawned], (es) => {
//         console.log(es)
//       })
//       t.addResponder([ComponentInserted, Foo], (es, f) => {
//         console.log(es, f)
//       })
//       w.spawn(new Foo());
//       w.spawn(new Bar(), new Foo());
//     }),
//   )
//   .addSystems(
//     Schedule.Update,
//     System("Test", [Clock, World, Query(Bar, Mut(Foo))], (c, w, query) => {
//       // for (const [entity, bar, foo] of query) {
//       //   // console.log(entity, foo.deref());
//       //   if (foo.ref.lol < 5) {
//       //     foo.deref().lol++;
//       //   }
//       // }
//     }),
//   )
//   .addSystems(
//     Schedule.WorldFlush,
//     System("Test", [Clock, World, Query(Bar, Mut(Foo)), Resources], (c, w, query, res) => {
//       console.log(w.changedComponents.get(Foo));
//     }),
//   )
//   .run();
