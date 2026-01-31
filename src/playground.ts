/*  /\___/\
   /       \
  l  u   u  l
--l----*----l--
   \   w   /     - Meow!
     ======
   /       \ __
   l        l\ \
   l        l/ /   -Audrey Ming Hwang-
   l  l l   l /
   \ ml lm /_*/

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
  AssetManager,
} from "./core.ts";

const TestEvent = Event<string>("testEvent");

class Foo {
  lol = 1;
}
class Bar { }

const assets = new AssetManager

const fooAsset = (value: string) => ({
  path: "Foo",
  load: () => {
    return new Promise(r => setTimeout(() => r(value), 500))
  }
})

const handle = assets.load(fooAsset("WTF"))

await handle.promise.then(x => {
  if (x.ok) {
    console.log(x.value)
  } else {
    console.log("WTF")
  }
})

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
