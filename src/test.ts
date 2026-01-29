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

import { App, Clock, EvReader, Mut, Query, Schedule, System, World, Event, EvWriter } from "./core.ts";

const TestEvent = Event<string>("testEvent")

class Foo{ lol = 1}
class Bar{ }

let a = 0;
let b = 0;

new App()
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
      }
    }),
    System("EventWriter", [EvWriter(TestEvent)], (events) => {
      events.write("eventWriter " + a++)
    }),
    System("EventReader", [EvReader(TestEvent)], (events) => {
      for (const e of events) {
        console.log("EventReader reading", e)
      }
    }),
    System("EventReaderWriter", [EvReader(TestEvent), EvWriter(TestEvent)], (events, te) => {
      for (const e of events) {
        console.log("EventReaderWriter reading", e)
      }
      te.write("eventReaderWriter " + b++)
    }),
  )
  .run();
