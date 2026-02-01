import { assertEquals, assert, assertExists, assertThrows, } from "jsr:@std/assert";
import {
  Query,
} from "./core.ts";
import {
  Event,
  EventQueue,
  EvReader,
  EvWriter,
} from "./lib.ts"
import { World, Mut } from "./core.ts";

const PingEvent = Event<{ id: number; msg: string }>("Ping");
const EmptyEvent = Event("Empty");

Deno.test("Event System - Basic Read/Write", () => {
  const queue = new EventQueue<typeof PingEvent>();
  const reader = queue.getReader();
  const writer = queue.getWriter();

  assertEquals(reader.length(), 0);

  writer.write({ id: 1, msg: "hello" });

  assertEquals(reader.length(), 1);

  const events = [...reader];
  assertEquals(events.length, 1);
  assertEquals(events[0], { id: 1, msg: "hello" });

  assertEquals(reader.length(), 0);
});

Deno.test("Event System - Double Buffering Lifecycle", () => {
  const queue = new EventQueue<typeof PingEvent>();
  const reader = queue.getReader();
  const writer = queue.getWriter();

  writer.write({ id: 1, msg: "A" });

  // do not read it yet.

  queue.update();

  writer.write({ id: 2, msg: "B" });

  // Reader should see A (Previous) and B (Current)
  // Explanation:
  // - resetForNewFrame() sets previousIndex = currentIndex (which was 0).
  // - Iterator checks previousBuffer[0] (Event A)
  // - Iterator checks currentBuffer[0] (Event B)
  assertEquals(reader.length(), 2);

  const events = [...reader];
  assertEquals(events[0].msg, "A");
  assertEquals(events[1].msg, "B");
});

Deno.test("Event System - Data Expiration", () => {
  const queue = new EventQueue<typeof PingEvent>();
  const reader = queue.getReader();
  const writer = queue.getWriter();

  writer.write({ id: 1, msg: "Stale" });
  queue.update();

  queue.update();

  // event should be gone
  assertEquals(reader.length(), 0);
  assertEquals([...reader].length, 0);
});

Deno.test("Event System - Partial Consumption (Stateful Iterator)", () => {
  const queue = new EventQueue<typeof PingEvent>();
  const reader = queue.getReader();
  const writer = queue.getWriter();

  writer.write({ id: 1, msg: "one" });
  writer.write({ id: 2, msg: "two" });
  writer.write({ id: 3, msg: "three" });

  // Manually iterate only once
  const iterator = reader[Symbol.iterator]();
  const firstResult = iterator.next();

  assert(!firstResult.done);
  assertEquals(firstResult.value.id, 1);

  // Check that the reader remembers its position
  // assertEquals(reader.length(), 2);

  // Consume the rest
  const remaining = [...reader];
  assertEquals(remaining.length, 2);
  // assertEquals(remaining[0].id, 2);
  // assertEquals(remaining[1].id, 3);
});

Deno.test("Event System - Multiple Readers are Independent", () => {
  const queue = new EventQueue<typeof PingEvent>();
  const r1 = queue.getReader();
  const r2 = queue.getReader();
  const writer = queue.getWriter();

  writer.write({ id: 1, msg: "broadcast" });

  // Both see it
  assertEquals(r1.length(), 1);
  assertEquals(r2.length(), 1);

  // R1 consumes it
  [...r1];
  assertEquals(r1.length(), 0);

  // R2 still has it
  assertEquals(r2.length(), 1);
  assertEquals([...r2][0].msg, "broadcast");
});

Deno.test("Event System - Garbage Collection Safety", () => {
  // We can't easily force GC in a unit test, but we can verify
  // that the WeakRef structure works logically when dereferenced.

  let queue: EventQueue<typeof PingEvent> | null = new EventQueue();
  const reader = queue.getReader();

  assert(reader.active);

  // Simulate loss of queue (mocking behavior)
  queue = null;

  // If we could force GC here, reader.active would be false.
  // Since we can't, we simply assert the test passes without crashing.
  // The logic `!!this.#queue.deref()` handles the null case safely.
});

Deno.test("Event System - Tag Helpers", () => {
  const w = EvWriter(PingEvent);
  const r = EvReader(PingEvent);

  // Verify the objects contain the correct event reference
  assertEquals(w.event, PingEvent);
  assertEquals(r.event, PingEvent);

  // Verify symbols exist (using string conversion to check description)
  const wSymbols = Object.getOwnPropertySymbols(w);
  const rSymbols = Object.getOwnPropertySymbols(r);

  assert(wSymbols.some(s => s.toString() === "Symbol(EventWriterTag)"));
  assert(rSymbols.some(s => s.toString() === "Symbol(EventReaderTag)"));
});

Deno.test("Event System - Event Type Safety", () => {
  // This test primarily validates that the types work at runtime
  // for an event with no payload (void).
  const queue = new EventQueue<typeof EmptyEvent>();
  const writer = queue.getWriter();
  const reader = queue.getReader();

  writer.write(undefined); // Should accept undefined or void

  assertEquals(reader.length(), 1);
  const events = [...reader];
  assertEquals(events[0], undefined);
});

class Position {
  x: number;
  y: number;
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
}

class Velocity {
  dx: number;
  dy: number;
  constructor(dx = 0, dy = 0) {
    this.dx = dx;
    this.dy = dy;
  }
}

class Health {
  value: number;
  constructor(value = 100) {
    this.value = value;
  }
}

Deno.test("World: Entity Lifecycle (Spawn/Exists)", () => {
  const world = new World();
  const entityA = world.spawn();
  const entityB = world.spawn();

  assertExists(entityA);
  assertExists(entityB);
  assertEquals(world.exists(entityA), true);
  assertEquals(world.exists(entityB), true);
  assertEquals(world.exists(99999), false); // Non-existent
});

Deno.test("World: Component Insertion and Retrieval", () => {
  const world = new World();
  const pos = new Position(10, 20);
  const entity = world.spawn();

  world.insert(entity, pos);

  assertEquals(world.has(entity, Position), true);
  assertEquals(world.has(entity, Velocity), false);

  const retrievedPos = world.get(entity, Position);
  assertEquals(retrievedPos, pos);
  assertEquals(retrievedPos.x, 10);
});

Deno.test("World: Spawn with Components", () => {
  const world = new World();
  const pos = new Position(5, 5);
  const entity = world.spawn(pos);

  assertEquals(world.has(entity, Position), true);
  assertEquals(world.get(entity, Position).x, 5);
});

Deno.test("World: Component Exclusivity (Error on reuse)", () => {
  const world = new World();
  const pos = new Position(10, 10);
  const entityA = world.spawn();
  const entityB = world.spawn();

  world.insert(entityA, pos);

  // Should fail because 'pos' instance is already attached to entityA
  assertThrows(
    () => {
      world.insert(entityB, pos);
    },
    Error,
    "Component exists on another entity"
  );
});

Deno.test("World: Adding existing Components", () => {
  const world = new World();
  const entity = world.spawn();

  const pos1 = new Position(10, 10);
  const pos2 = new Position(20, 20);

  world.insert(entity, pos1);
  assertEquals(world.get(entity, Position).x, 10);

  assertThrows(() => {
      world.insert(entity, pos2);
  })
});

Deno.test("World: Deferred Removal (Remove + Flush)", () => {
  const world = new World();
  const entity = world.spawn(new Position(), new Velocity());

  // 1. Mark for removal
  world.remove(entity, Position);

  // 2. Assert it is queued but still technically exists before flush
  assertEquals(world.willRemove(entity, Position), true);
  // Note: Depending on implementation semantics, has() might return true or false here.
  // In this implementation, the map isn't touched until flush, so has() is true.
  assertEquals(world.has(entity, Position), true);

  // 3. Flush changes
  world.flush();

  // 4. Assert actual removal
  assertEquals(world.has(entity, Position), false);
  assertEquals(world.has(entity, Velocity), true); // Velocity wasn't removed
});

Deno.test("World: Deferred Despawn (Despawn + Flush)", () => {
  const world = new World();
  const entity = world.spawn(new Position());

  world.despawn(entity);

  assertEquals(world.willDespawn(entity), true);
  assertEquals(world.exists(entity), true); // Still exists before flush

  world.flush();

  assertEquals(world.exists(entity), false);
  // Component data should be cleaned up (implementation detail, but good to check access throws)
  assertThrows(() => world.get(entity, Position));
});

Deno.test("World: Try/Catch Variants", () => {
  const world = new World();

  // tryInsert
  const entity = world.spawn();
  const success = world.tryInsert(entity, new Position());
  assertEquals(success, true);

  const failInsert = world.tryInsert(99999, new Position()); // Invalid entity
  assertEquals(failInsert, false);

  // tryRemove
  const successRem = world.tryRemove(entity, Position);
  assertEquals(successRem, true);

  // tryDespawn
  const successDespawn = world.tryDespawn(entity);
  assertEquals(successDespawn, true);
});

Deno.test("World: Query Iteration (Basic)", () => {
  const world = new World();

  // Setup:
  // E1: Pos, Vel
  // E2: Pos
  // E3: Vel
  const e1 = world.spawn(new Position(1, 1), new Velocity(1, 1));
  const e2 = world.spawn(new Position(2, 2));
  const e3 = world.spawn(new Velocity(3, 3));

  // Query for entities with BOTH Position and Velocity
  const results: any[] = [];
  for (const [id, pos, vel] of world.queryIter([Position, Velocity])) {
    results.push({ id, pos, vel });
  }

  assertEquals(results.length, 1);
  assertEquals(results[0].id, e1);
  assertEquals(results[0].pos.x, 1);
});

Deno.test("World: Query Iteration (Shared Iterator Safety)", () => {
  // The implementation uses #sharedIterResult.
  // We need to ensure that values from the iterator are read immediately or copied,
  // as the array reference might be reused/mutated in the next step of the loop.

  const world = new World();
  world.spawn(new Position(1, 1));
  world.spawn(new Position(2, 2));

  let count = 0;
  for (const [id, pos] of world.queryIter([Position])) {
    assertExists(id);
    assertExists(pos);
    count++;
  }
  assertEquals(count, 2);
});

Deno.test("World: Query with Mutable Components", () => {
  const world = new World();
  const e1 = world.spawn(new Position(10, 10));

  let iterated = false;
  for (const [id, mutPos] of world.queryIter(Query(Mut(Position)))) {
    iterated = true;
    assertEquals(id, e1);
    assertEquals(mutPos.ref.x, 10);
    mutPos.deref().x = 99;
  }

  assertEquals(world.get(e1, Position).x, 99);
  assertEquals(iterated, true);
});
