# Elysiatech

Elysiatech is an application framework and game engine with a Three.js integration
that uses an Entity Component System (ECS) to manage state and behavior.

It also provides a robust standard library (`lib.ts`) for asset loading, input management,
event handling, data structures, type utilities, and more.

## Philosophy

Elysiatech is designed to be modular and extensible. The entire library is a small
collection of source modules with very few dependencies. It does not use NPM — users
are encouraged to include the source files directly, enabling full customization and
ease of integration. Documentation lives directly in the source files.

## Quick Start

```ts
import { App, Schedule, System, Query, Mut, Plugin, World, Event, Configuration, AppMode } from "./src/core.ts";
import { Time, EvReader } from "./src/lib.ts";

// Create a custom config for app
class CustomConfig extends Configuration {
  mode = AppMode.Dev
}

// Define components — plain classes
class Position { constructor(public x = 0, public y = 0) {} }
class Velocity { constructor(public dx = 0, public dy = 0) {} }

// Define an event
const HitBoundary = Event<{ entity: number }>("HitBoundary");

// Define systems
const spawnEntities = System("SpawnEntities", [World], (world) => {
  world.spawn(new Position(0, 0), new Velocity(2, 1));
  world.spawn(new Position(5, 5), new Velocity(-1, 3));
});

const movementSystem = System(
  "Movement",
  [Query(Mut(Position), Velocity), Time],
  (query, time) => {
    for (const [entity, mutPos, vel] of query) {
      const pos = mutPos.deref();
      pos.x += vel.dx * time.delta;
      pos.y += vel.dy * time.delta;
    }
  }
);

// Run the app
App.WithDefaults(CustomConfig)
  .addSystems(Schedule.Startup, spawnEntities)
  .addSystems(Schedule.Update, movementSystem)
  .addEvents(HitBoundary)
  .run();
```

## Concepts

### App

The `App` is the central orchestrator. It manages plugins, systems, resources, and
events across a strict lifecycle: **Configure → Run → Destroy**. Use `App.WithDefaults()`
to get an app with the core resources and systems pre-registered.

### Entity Component System (ECS)

The `World` manages entities and their components. Entities are lightweight numeric IDs.
Components are plain class instances attached to entities. Despawns and component removals
are **deferred** until the world is flushed, ensuring safe mid-frame iteration.

The World also tracks component mutations across frames for change detection.

### Systems

Systems are the primary unit of behavior. Each system declares its dependencies — queries,
resources, event readers/writers — and receives them as arguments at runtime. Create them
with the `System()` function and register them on a schedule with `addSystems()`.

### Queries

Queries iterate over entities matching a set of components. They support three access modes:

- **Immutable** — `Query(Position, Velocity)` yields readonly references.
- **Mutable** — `Query(Mut(Position))` yields `MutRef` wrappers. Call `.deref()` to write and trigger change detection, or `.ref` to read without marking as changed.
- **Change-filtered** — `Query(Mutated(Position))` yields only entities whose component changed this frame.

### Resources

Resources are singleton objects that hold global state. Register them with `addResources()`
and declare them in a system's args to receive the instance. Built-in resources include
`Time`, `World`, `Triggerer`, and `Input`.

### Events

Events enable decoupled inter-system communication via double-buffered queues. Define an
event with `Event()`, register it with `addEvents()`, then use `EvReader()` and `EvWriter()`
in system args to consume or produce events. Events persist for two frames, then expire.

### Plugins

Plugins are named functions that receive an `App` and call configuration methods on it,
providing a way to modularize and share setup logic.

### Scheduling

The `Schedule` enum defines when systems execute:

| Phase | Schedules | Runs |
|-------|-----------|------|
| **Startup** | `PreStartup` → `Startup` → `PostStartup` | Once, on `app.run()` |
| **Update** | `PreUpdate` → `Update` → `PostUpdate` → `WorldFlush` → `EventUpdate` → `UpdateFinished` | Every frame |
| **Error** | `StartupError` | Once, if a startup schedule throws |
| **Teardown** | `Destroy` | Once, on `app.destroy()` |

### Triggerer

The `Triggerer` broadcasts entity and component lifecycle events (`ComponentInserted`,
`ComponentRemovalScheduled`, `EntitySpawned`, `EntityDespawnScheduled`). Systems can
register responders to react to these — for example, the built-in relationship system
uses it to cascade despawns from parent to child entities.

### Input

The `Input` resource provides unified keyboard, mouse, and gamepad state tracking.
It is registered automatically by `App.defaultsPlugin`.

### Relationships

The `Relationship` component enables parent-child entity hierarchies with cycle detection
and automatic cleanup on despawn. Registered automatically by `App.defaultsPlugin`.

## Modules

| File | Description |
|------|-------------|
| `src/core.ts` | App, ECS (World, queries, systems, events, plugins, scheduling), Input, Relationships. Detailed documentation is in the module header and JSDoc comments. |
| `src/lib.ts` | Standard library — type utilities, assertions, type guards, containers (`SparseSet`, `AutoMap`, `ObjectPool`, `CompositeMap`), logging, math helpers, time management, event queues, `Triggerer`, `RefRegistry`, `ResourceManager`, asset loading, and input codes. |
| `src/three.ts` | Three.js integration — scene management, rendering, and 3D-specific components and systems. |

## License

This project is licensed under the **AGPL-3.0-or-later**.

Commercial licenses are available from the copyright holder.
