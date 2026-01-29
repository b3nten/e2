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
} from "./core.ts";

const TestEvent = Event<string>("testEvent");

class Foo {
  lol = 1;
}
class Bar {}

App.WithDefaults()
  .addEvents(TestEvent)
  .addSystems(
    Schedule.Startup,
    System("Init", [World], (w) => {
      w.spawn(new Foo());
      w.spawn(new Bar(), new Foo());
    }),
  )
  .addSystems(
    Schedule.Update,
    System("Test", [Clock, World, Query(Bar, Mut(Foo))], (c, w, query) => {
      for (const [entity, bar, foo] of query) {
        // console.log(entity, foo.deref());
        if (foo.ref.lol < 5) {
          foo.deref().lol++;
        }
      }
    }),
  )
  .addSystems(
    Schedule.WorldFlush,
    System("Test", [Clock, World, Query(Bar, Mut(Foo))], (c, w, query) => {
      console.log(w.changedComponents.get(Foo));
    }),
  )
  .run();
