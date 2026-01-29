import { assertEquals, assertExists, assertThrows } from "jsr:@std/assert";
import { CompositeMap } from "./lib.ts";
import { ObjectPool } from "./lib.ts";

interface ObjectPool_TestObject {
  id: number;
  value: string;
  resetCount: number;
}

interface ObjectPool_Counter {
  count: number;
}

Deno.test("ObjectPool - basic construction with initial size", () => {
  const pool = new ObjectPool<ObjectPool_TestObject>({
    initialSize: 5,
    createObject: (index) => ({ id: index, value: "", resetCount: 0 }),
  });

  assertEquals(pool.size, 5);
  assertEquals(pool.sizeOfReserve, 5);
  assertEquals(pool.sizeOfActive, 0);
});

Deno.test("ObjectPool - construction with resetObject", () => {
  let resetCallCount = 0;
  const pool = new ObjectPool<ObjectPool_TestObject>({
    initialSize: 3,
    createObject: (index) => ({ id: index, value: "", resetCount: 0 }),
    resetObject: (obj) => {
      obj.value = "reset";
      obj.resetCount++;
      resetCallCount++;
    },
  });

  // resetObject should be called during initialization
  assertEquals(resetCallCount, 3);
  assertEquals(pool.size, 3);
});

Deno.test("ObjectPool - alloc returns objects from pool", () => {
  const pool = new ObjectPool<ObjectPool_TestObject>({
    initialSize: 3,
    createObject: (index) => ({ id: index, value: "", resetCount: 0 }),
  });

  const obj1 = pool.alloc();
  assertExists(obj1);
  assertEquals(pool.sizeOfActive, 1);
  assertEquals(pool.sizeOfReserve, 2);
  assertEquals(pool.size, 3);

  const obj2 = pool.alloc();
  assertExists(obj2);
  assertEquals(pool.sizeOfActive, 2);
  assertEquals(pool.sizeOfReserve, 1);
  assertEquals(pool.size, 3);
});

Deno.test("ObjectPool - alloc grows pool when exhausted (default strategy)", () => {
  const pool = new ObjectPool<ObjectPool_TestObject>({
    initialSize: 2,
    createObject: (index) => ({ id: index, value: "", resetCount: 0 }),
  });

  pool.alloc();
  pool.alloc();
  assertEquals(pool.size, 2);
  assertEquals(pool.sizeOfReserve, 0);

  // This should trigger growth (default: currentSize * 2 = 2 * 2 = 4)
  const obj3 = pool.alloc();
  assertExists(obj3);
  assertEquals(pool.size, 6); // 2 original + 4 new
  assertEquals(pool.sizeOfActive, 3);
  assertEquals(pool.sizeOfReserve, 3);
});

Deno.test("ObjectPool - custom growth strategy", () => {
  const pool = new ObjectPool<ObjectPool_TestObject>({
    initialSize: 2,
    createObject: (index) => ({ id: index, value: "", resetCount: 0 }),
    growthStrategy: (currentSize) => currentSize + 1, // Linear growth
  });

  pool.alloc();
  pool.alloc();
  assertEquals(pool.size, 2);

  // Trigger growth with custom strategy
  pool.alloc();
  assertEquals(pool.size, 5); // 2 + (2 + 1)
  assertEquals(pool.sizeOfActive, 3);
  assertEquals(pool.sizeOfReserve, 2);
});

Deno.test("ObjectPool - free returns object to pool", () => {
  const pool = new ObjectPool<ObjectPool_TestObject>({
    initialSize: 3,
    createObject: (index) => ({ id: index, value: "", resetCount: 0 }),
  });

  const obj = pool.alloc();
  assertEquals(pool.sizeOfActive, 1);
  assertEquals(pool.sizeOfReserve, 2);

  pool.free(obj);
  assertEquals(pool.sizeOfActive, 0);
  assertEquals(pool.sizeOfReserve, 3);
  assertEquals(pool.size, 3);
});

Deno.test("ObjectPool - free calls resetObject", () => {
  const pool = new ObjectPool<ObjectPool_TestObject>({
    initialSize: 2,
    createObject: (index) => ({ id: index, value: "", resetCount: 0 }),
    resetObject: (obj) => {
      obj.value = "reset";
      obj.resetCount++;
    },
  });

  const obj = pool.alloc();
  obj.value = "modified";
  const initialResetCount = obj.resetCount;

  pool.free(obj);
  assertEquals(obj.value, "reset");
  assertEquals(obj.resetCount, initialResetCount + 1);
});

Deno.test("ObjectPool - free ignores objects not in active set", () => {
  const pool = new ObjectPool<ObjectPool_TestObject>({
    initialSize: 2,
    createObject: (index) => ({ id: index, value: "", resetCount: 0 }),
  });

  const externalObj: ObjectPool_TestObject = { id: 999, value: "external", resetCount: 0 };

  // Should not throw or affect pool
  pool.free(externalObj);
  assertEquals(pool.sizeOfActive, 0);
  assertEquals(pool.sizeOfReserve, 2);
  assertEquals(pool.size, 2);
});

Deno.test("ObjectPool - free same object twice (idempotent)", () => {
  const pool = new ObjectPool<ObjectPool_TestObject>({
    initialSize: 2,
    createObject: (index) => ({ id: index, value: "", resetCount: 0 }),
    resetObject: (obj) => obj.resetCount++,
  });

  const obj = pool.alloc();
  const resetCountAfterAlloc = obj.resetCount;

  pool.free(obj);
  assertEquals(obj.resetCount, resetCountAfterAlloc + 1);

  // Free again - should have no effect
  pool.free(obj);
  assertEquals(obj.resetCount, resetCountAfterAlloc + 1);
  assertEquals(pool.sizeOfActive, 0);
});

Deno.test("ObjectPool - freeAll returns all active objects", () => {
  const pool = new ObjectPool<ObjectPool_TestObject>({
    initialSize: 5,
    createObject: (index) => ({ id: index, value: "", resetCount: 0 }),
  });

  pool.alloc();
  pool.alloc();
  pool.alloc();
  assertEquals(pool.sizeOfActive, 3);
  assertEquals(pool.sizeOfReserve, 2);

  pool.freeAll();
  assertEquals(pool.sizeOfActive, 0);
  assertEquals(pool.sizeOfReserve, 5);
  assertEquals(pool.size, 5);
});

Deno.test("ObjectPool - freeAll calls resetObject on all objects", () => {
  const pool = new ObjectPool<ObjectPool_TestObject>({
    initialSize: 3,
    createObject: (index) => ({ id: index, value: "", resetCount: 0 }),
    resetObject: (obj) => {
      obj.value = "reset";
      obj.resetCount++;
    },
  });

  const obj1 = pool.alloc();
  const obj2 = pool.alloc();

  obj1.value = "modified1";
  obj2.value = "modified2";

  const resetCount1 = obj1.resetCount;
  const resetCount2 = obj2.resetCount;

  pool.freeAll();

  assertEquals(obj1.value, "reset");
  assertEquals(obj2.value, "reset");
  assertEquals(obj1.resetCount, resetCount1 + 1);
  assertEquals(obj2.resetCount, resetCount2 + 1);
});

Deno.test("ObjectPool - freeAll with no active objects", () => {
  const pool = new ObjectPool<ObjectPool_TestObject>({
    initialSize: 3,
    createObject: (index) => ({ id: index, value: "", resetCount: 0 }),
  });

  pool.freeAll(); // Should not throw
  assertEquals(pool.sizeOfActive, 0);
  assertEquals(pool.sizeOfReserve, 3);
});

Deno.test("ObjectPool - reuse freed objects", () => {
  const pool = new ObjectPool<ObjectPool_TestObject>({
    initialSize: 2,
    createObject: (index) => ({ id: index, value: "", resetCount: 0 }),
  });

  const obj1 = pool.alloc();
  const obj1Id = obj1.id;
  pool.free(obj1);

  const obj2 = pool.alloc();
  // Should get the same object back
  assertEquals(obj2.id, obj1Id);
  assertEquals(pool.size, 2); // No growth occurred
});

Deno.test("ObjectPool - complex lifecycle", () => {
  const pool = new ObjectPool<ObjectPool_Counter>({
    initialSize: 2,
    createObject: (index) => ({ count: 0 }),
    resetObject: (obj) => { obj.count = 0; },
  });

  // Allocate all
  const obj1 = pool.alloc();
  const obj2 = pool.alloc();
  obj1.count = 10;
  obj2.count = 20;

  assertEquals(pool.sizeOfActive, 2);
  assertEquals(pool.sizeOfReserve, 0);

  // Free one
  pool.free(obj1);
  assertEquals(obj1.count, 0); // Reset
  assertEquals(pool.sizeOfActive, 1);
  assertEquals(pool.sizeOfReserve, 1);

  // Allocate again (should reuse obj1)
  const obj3 = pool.alloc();
  assertEquals(obj3.count, 0);
  assertEquals(pool.sizeOfActive, 2);

  // Free all
  pool.freeAll();
  assertEquals(obj2.count, 0); // Reset
  assertEquals(pool.sizeOfActive, 0);
  assertEquals(pool.sizeOfReserve, 2);
});

Deno.test("ObjectPool - zero initial size", () => {
  const pool = new ObjectPool<ObjectPool_TestObject>({
    initialSize: 0,
    createObject: (index) => ({ id: index, value: "", resetCount: 0 }),
  });

  assertEquals(pool.size, 1);
  assertEquals(pool.sizeOfReserve, 1);
  assertEquals(pool.sizeOfActive, 0);

  const obj = pool.alloc();
  assertExists(obj);
  assertEquals(pool.size, 1);
});

Deno.test("ObjectPool - large pool operations", () => {
  const pool = new ObjectPool<ObjectPool_Counter>({
    initialSize: 100,
    createObject: (index) => ({ count: index }),
  });

  const objects: ObjectPool_Counter[] = [];

  // Allocate 100 objects
  for (let i = 0; i < 100; i++) {
    objects.push(pool.alloc());
  }

  assertEquals(pool.sizeOfActive, 100);
  assertEquals(pool.sizeOfReserve, 0);

  // Free all at once
  pool.freeAll();
  assertEquals(pool.sizeOfActive, 0);
  assertEquals(pool.sizeOfReserve, 100);

  // Allocate again
  for (let i = 0; i < 50; i++) {
    pool.alloc();
  }
  assertEquals(pool.sizeOfActive, 50);
  assertEquals(pool.sizeOfReserve, 50);
});

Deno.test("ObjectPool - without resetObject", () => {
  const pool = new ObjectPool<ObjectPool_Counter>({
    initialSize: 2,
    createObject: (index) => ({ count: 0 }),
  });

  const obj = pool.alloc();
  obj.count = 42;

  pool.free(obj);

  // Without resetObject, the state persists
  const obj2 = pool.alloc();
  assertEquals(obj2.count, 42);
});

Deno.test("ObjectPool - method binding", () => {
  const pool = new ObjectPool<ObjectPool_Counter>({
    initialSize: 2,
    createObject: (index) => ({ count: index }),
  });

  // Test that methods are bound correctly
  const { alloc, free, freeAll } = pool;

  const obj = alloc();
  assertExists(obj);
  assertEquals(pool.sizeOfActive, 1);

  free(obj);
  assertEquals(pool.sizeOfActive, 0);

  alloc();
  freeAll();
  assertEquals(pool.sizeOfActive, 0);
});

Deno.test("ObjectPool - growth with custom strategy that returns 0", () => {
  const pool = new ObjectPool<ObjectPool_Counter>({
    initialSize: 1,
    createObject: (index) => ({ count: index }),
    growthStrategy: () => 0, // Bad strategy
  });

  pool.alloc();
  pool.alloc(); // should still grow by one
  assertEquals(pool.size, 2)
});

Deno.test("ObjectPool - createObject receives correct indices", () => {
  const indices: number[] = [];
  const pool = new ObjectPool<ObjectPool_Counter>({
    initialSize: 3,
    createObject: (index) => {
      indices.push(index);
      return { count: index };
    },
  });

  assertEquals(indices, [0, 1, 2]);

  // Trigger growth (default: 3 * 2 = 6 objects)
  pool.alloc();
  pool.alloc();
  pool.alloc();
  pool.alloc(); // This triggers growth

  // Should create objects with indices 3, 4, 5, 6, 7, 8
  assertEquals(indices, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
});

Deno.test("CompositeMap - basic set and get", () => {
  const map = new CompositeMap<string>();

  map.set(["a", "b"], "value1");
  assertEquals(map.get(["a", "b"]), "value1");
  assertEquals(map.get(["a", "c"]), undefined);
  assertEquals(map.get(["a"]), undefined);
});

Deno.test("CompositeMap - has method", () => {
  const map = new CompositeMap<number>();

  map.set(["x", "y", "z"], 42);
  assertEquals(map.has(["x", "y", "z"]), true);
  assertEquals(map.has(["x", "y"]), false);
  assertEquals(map.has(["x"]), false);
  assertEquals(map.has(["a"]), false);
});

Deno.test("CompositeMap - delete method", () => {
  const map = new CompositeMap<string>();

  map.set(["a", "b"], "value1");
  assertEquals(map.has(["a", "b"]), true);

  map.delete(["a", "b"]);
  assertEquals(map.has(["a", "b"]), false);
  assertEquals(map.get(["a", "b"]), undefined);

  // Delete non-existent key
  assertEquals(map.delete(["x", "y"]), false);
});

Deno.test("CompositeMap - clear method", () => {
  const map = new CompositeMap<string>();

  map.set(["a", "b"], "value1");
  map.set(["c", "d"], "value2");
  map.clear();

  assertEquals(map.has(["a", "b"]), false);
  assertEquals(map.has(["c", "d"]), false);
});

Deno.test("CompositeMap - entries iterator", () => {
  const map = new CompositeMap<string>();

  map.set(["a", "b"], "value1");
  map.set(["a", "c"], "value2");
  map.set(["d"], "value3");

  const entries = Array.from(map.entries());
  assertEquals(entries.length, 3);

  // Check that all entries are present
  const entriesMap = new Map(entries.map(([k, v]) => [JSON.stringify(k), v]));
  assertEquals(entriesMap.get(JSON.stringify(["a", "b"])), "value1");
  assertEquals(entriesMap.get(JSON.stringify(["a", "c"])), "value2");
  assertEquals(entriesMap.get(JSON.stringify(["d"])), "value3");
});

Deno.test("CompositeMap - keys iterator", () => {
  const map = new CompositeMap<string>();

  map.set(["a", "b"], "value1");
  map.set(["a", "c"], "value2");
  map.set(["d"], "value3");

  const keys = Array.from(map.keys());
  assertEquals(keys.length, 3);

  const keysSet = new Set(keys.map(k => JSON.stringify(k)));
  assertEquals(keysSet.has(JSON.stringify(["a", "b"])), true);
  assertEquals(keysSet.has(JSON.stringify(["a", "c"])), true);
  assertEquals(keysSet.has(JSON.stringify(["d"])), true);
});

Deno.test("CompositeMap - Symbol.iterator", () => {
  const map = new CompositeMap<string>();

  map.set(["a", "b"], "value1");
  map.set(["c"], "value2");

  const entries = Array.from(map);
  assertEquals(entries.length, 2);

  // Test for...of
  let count = 0;
  for (const [key, value] of map) {
    assertExists(key);
    assertExists(value);
    count++;
  }
  assertEquals(count, 2);
});

Deno.test("CompositeMap - forEach", () => {
  const map = new CompositeMap<string>();

  map.set(["a", "b"], "value1");
  map.set(["c"], "value2");

  const collected: Array<[any[], string]> = [];
  map.forEach((value, key, m) => {
    assertEquals(m, map);
    collected.push([key, value]);
  });

  assertEquals(collected.length, 2);
});

Deno.test("CompositeMap - overwrite existing value", () => {
  const map = new CompositeMap<string>();

  map.set(["a", "b"], "value1");
  assertEquals(map.get(["a", "b"]), "value1");

  map.set(["a", "b"], "value2");
  assertEquals(map.get(["a", "b"]), "value2");
});

Deno.test("CompositeMap - empty key array", () => {
  const map = new CompositeMap<string>();

  map.set([], "root");
  assertEquals(map.get([]), "root");
  assertEquals(map.has([]), true);
});

Deno.test("CompositeMap - shared prefixes", () => {
  const map = new CompositeMap<number>();

  map.set(["user", "123", "name"], 1);
  map.set(["user", "123", "email"], 2);
  map.set(["user", "456", "name"], 3);

  assertEquals(map.get(["user", "123", "name"]), 1);
  assertEquals(map.get(["user", "123", "email"]), 2);
  assertEquals(map.get(["user", "456", "name"]), 3);
  assertEquals(map.get(["user", "123"]), undefined);
  assertEquals(map.has(["user", "123"]), false);
});

Deno.test("CompositeMap - mixed key types", () => {
  const map = new CompositeMap<string>();

  map.set(["string", 123, true, null], "mixed");
  assertEquals(map.get(["string", 123, true, null]), "mixed");
  assertEquals(map.has(["string", 123, true, null]), true);
});

Deno.test("CompositeMap - delete doesn't affect other keys", () => {
  const map = new CompositeMap<string>();

  map.set(["a", "b", "c"], "value1");
  map.set(["a", "b", "d"], "value2");

  map.delete(["a", "b", "c"]);

  assertEquals(map.has(["a", "b", "c"]), false);
  assertEquals(map.has(["a", "b", "d"]), true);
  assertEquals(map.get(["a", "b", "d"]), "value2");
});

Deno.test("CompositeMap - iteration ignores deleted entries", () => {
  const map = new CompositeMap<string>();

  map.set(["a"], "value1");
  map.set(["b"], "value2");
  map.set(["c"], "value3");

  map.delete(["b"]);

  const entries = Array.from(map.entries());
  assertEquals(entries.length, 2);

  const values = entries.map(([, v]) => v);
  assertEquals(values.includes("value1"), true);
  assertEquals(values.includes("value2"), false);
  assertEquals(values.includes("value3"), true);
});

Deno.test("CompositeMap - chaining set calls", () => {
  const map = new CompositeMap<string>();

  map
    .set(["a"], "value1")
    .set(["b"], "value2")
    .set(["c"], "value3");

  assertEquals(map.get(["a"]), "value1");
  assertEquals(map.get(["b"]), "value2");
  assertEquals(map.get(["c"]), "value3");
});

import { SparseSet } from "./lib.ts";

Deno.test("SparseSet - initial state", () => {
  const set = new SparseSet<string>();
  assertEquals(set.size, 0);
  assertEquals(set.first, undefined);
});

Deno.test("SparseSet - add single component", () => {
  const set = new SparseSet<string>();
  const added = set.add(1, "component1");

  assertEquals(added, true);
  assertEquals(set.size, 1);
  assertEquals(set.get(1), "component1");
  assertEquals(set.has(1), true);
  assertEquals(set.first, "component1");
});

Deno.test("SparseSet - add multiple components", () => {
  const set = new SparseSet<number>();

  set.add(0, 100);
  set.add(5, 200);
  set.add(10, 300);

  assertEquals(set.size, 3);
  assertEquals(set.get(0), 100);
  assertEquals(set.get(5), 200);
  assertEquals(set.get(10), 300);
  assertEquals(set.first, 100);
});

Deno.test("SparseSet - add duplicate entity returns false", () => {
  const set = new SparseSet<string>();

  const firstAdd = set.add(1, "first");
  const secondAdd = set.add(1, "second");

  assertEquals(firstAdd, true);
  assertEquals(secondAdd, false);
  assertEquals(set.size, 1);
  assertEquals(set.get(1), "first");
});

Deno.test("SparseSet - has returns correct values", () => {
  const set = new SparseSet<string>();

  assertEquals(set.has(0), false);

  set.add(0, "test");
  assertEquals(set.has(0), true);
  assertEquals(set.has(1), false);
});

Deno.test("SparseSet - get non-existent entity returns undefined", () => {
  const set = new SparseSet<string>();

  assertEquals(set.get(0), undefined);
  assertEquals(set.get(999), undefined);
});

Deno.test("SparseSet - remove entity", () => {
  const set = new SparseSet<string>();

  set.add(1, "test");
  assertEquals(set.has(1), true);

  set.remove(1);
  assertEquals(set.has(1), false);
  assertEquals(set.size, 0);
  assertEquals(set.get(1), undefined);
});

Deno.test("SparseSet - remove non-existent entity does nothing", () => {
  const set = new SparseSet<string>();

  set.add(1, "test");
  set.remove(999); // Should not throw

  assertEquals(set.size, 1);
  assertEquals(set.has(1), true);
});

Deno.test("SparseSet - remove middle element maintains order", () => {
  const set = new SparseSet<string>();

  set.add(0, "a");
  set.add(1, "b");
  set.add(2, "c");

  set.remove(1);

  assertEquals(set.size, 2);
  assertEquals(set.has(0), true);
  assertEquals(set.has(1), false);
  assertEquals(set.has(2), true);
  assertEquals(set.get(0), "a");
  assertEquals(set.get(2), "c");
});

Deno.test("SparseSet - remove last element", () => {
  const set = new SparseSet<string>();

  set.add(0, "a");
  set.add(1, "b");
  set.add(2, "c");

  set.remove(2);

  assertEquals(set.size, 2);
  assertEquals(set.has(2), false);
  assertEquals(set.get(0), "a");
  assertEquals(set.get(1), "b");
});

Deno.test("SparseSet - remove first element", () => {
  const set = new SparseSet<string>();

  set.add(0, "a");
  set.add(1, "b");
  set.add(2, "c");

  set.remove(0);

  assertEquals(set.size, 2);
  assertEquals(set.has(0), false);
  assertEquals(set.first, "c"); // Last element moved to first position
});

Deno.test("SparseSet - clear removes all elements", () => {
  const set = new SparseSet<string>();

  set.add(0, "a");
  set.add(1, "b");
  set.add(2, "c");

  set.clear();

  assertEquals(set.size, 0);
  assertEquals(set.has(0), false);
  assertEquals(set.has(1), false);
  assertEquals(set.has(2), false);
  assertEquals(set.first, undefined);
});

Deno.test("SparseSet - clear on empty set", () => {
  const set = new SparseSet<string>();

  set.clear(); // Should not throw

  assertEquals(set.size, 0);
});

Deno.test("SparseSet - iterator yields all entries", () => {
  const set = new SparseSet<string>();

  set.add(5, "five");
  set.add(10, "ten");
  set.add(15, "fifteen");

  const entries = Array.from(set);

  assertEquals(entries.length, 3);
  assertEquals(entries[0], [5, "five"]);
  assertEquals(entries[1], [10, "ten"]);
  assertEquals(entries[2], [15, "fifteen"]);
});

Deno.test("SparseSet - iterator on empty set", () => {
  const set = new SparseSet<string>();

  const entries = Array.from(set);

  assertEquals(entries.length, 0);
});

Deno.test("SparseSet - iterator after removals", () => {
  const set = new SparseSet<string>();

  set.add(0, "a");
  set.add(1, "b");
  set.add(2, "c");
  set.add(3, "d");

  set.remove(1);
  set.remove(3);

  const entries = Array.from(set);

  assertEquals(entries.length, 2);
  // Order may change due to swap-remove
  const entities = entries.map(([entity]) => entity);
  assertEquals(entities.includes(0), true);
  assertEquals(entities.includes(2), true);
});

Deno.test("SparseSet - works with complex types", () => {
  interface Component {
    x: number;
    y: number;
    name: string;
  }

  const set = new SparseSet<Component>();

  set.add(1, { x: 10, y: 20, name: "first" });
  set.add(2, { x: 30, y: 40, name: "second" });

  const comp1 = set.get(1);
  const comp2 = set.get(2);

  assertExists(comp1);
  assertExists(comp2);
  assertEquals(comp1.x, 10);
  assertEquals(comp1.y, 20);
  assertEquals(comp1.name, "first");
  assertEquals(comp2.x, 30);
  assertEquals(comp2.y, 40);
  assertEquals(comp2.name, "second");
});

Deno.test("SparseSet - handles sparse entity IDs", () => {
  const set = new SparseSet<string>();

  set.add(0, "zero");
  set.add(100, "hundred");
  set.add(1000, "thousand");

  assertEquals(set.size, 3);
  assertEquals(set.get(0), "zero");
  assertEquals(set.get(100), "hundred");
  assertEquals(set.get(1000), "thousand");
  assertEquals(set.get(50), undefined);
  assertEquals(set.get(500), undefined);
});

Deno.test("SparseSet - add, remove, add same entity", () => {
  const set = new SparseSet<string>();

  set.add(1, "first");
  assertEquals(set.get(1), "first");

  set.remove(1);
  assertEquals(set.has(1), false);

  set.add(1, "second");
  assertEquals(set.get(1), "second");
  assertEquals(set.size, 1);
});

Deno.test("SparseSet - first updates correctly", () => {
  const set = new SparseSet<string>();

  assertEquals(set.first, undefined);

  set.add(1, "first");
  assertEquals(set.first, "first");

  set.add(2, "second");
  assertEquals(set.first, "first"); // Still the first added

  set.remove(1);
  assertEquals(set.first, "second"); // After swap-remove, last becomes first

  set.clear();
  assertEquals(set.first, undefined);
});

Deno.test("SparseSet - stress test with many entities", () => {
  const set = new SparseSet<number>();
  const entityCount = 1000;

  // Add many entities
  for (let i = 0; i < entityCount; i++) {
    set.add(i, i * 10);
  }

  assertEquals(set.size, entityCount);

  // Verify all entities
  for (let i = 0; i < entityCount; i++) {
    assertEquals(set.has(i), true);
    assertEquals(set.get(i), i * 10);
  }

  // Remove even entities
  for (let i = 0; i < entityCount; i += 2) {
    set.remove(i);
  }

  assertEquals(set.size, entityCount / 2);

  // Verify odd entities still exist
  for (let i = 1; i < entityCount; i += 2) {
    assertEquals(set.has(i), true);
    assertEquals(set.get(i), i * 10);
  }

  // Verify even entities are removed
  for (let i = 0; i < entityCount; i += 2) {
    assertEquals(set.has(i), false);
  }
});

Deno.test("SparseSet - entity 0 is valid", () => {
  const set = new SparseSet<string>();

  set.add(0, "zero");

  assertEquals(set.has(0), true);
  assertEquals(set.get(0), "zero");
  assertEquals(set.size, 1);
});

Deno.test("SparseSet - iteration order matches dense array", () => {
  const set = new SparseSet<string>();

  set.add(5, "e5");
  set.add(3, "e3");
  set.add(7, "e7");
  set.add(1, "e1");

  const entries = Array.from(set);

  // Order should be insertion order
  assertEquals(entries[0][0], 5);
  assertEquals(entries[1][0], 3);
  assertEquals(entries[2][0], 7);
  assertEquals(entries[3][0], 1);
});

Deno.test("SparseSet - remove all elements one by one", () => {
  const set = new SparseSet<string>();

  set.add(1, "a");
  set.add(2, "b");
  set.add(3, "c");

  set.remove(1);
  assertEquals(set.size, 2);

  set.remove(2);
  assertEquals(set.size, 1);

  set.remove(3);
  assertEquals(set.size, 0);
  assertEquals(set.first, undefined);

  // Should be able to add again
  set.add(4, "d");
  assertEquals(set.size, 1);
  assertEquals(set.get(4), "d");
});
