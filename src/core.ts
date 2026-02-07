// SPDX-License-Identifier: AGPL-3.0-or-later

/* Copyright (C) 2026 Benton Boychuk-Chorney

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>. */

/*_,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,_

           ,
            \`-._           __
             \\  `-..____,.'  `.
              :`.         /    \`.
              :  )       :      : \
               ;'        '   ;  |  :
               )..      .. .:.`.;  :
              /::...  .:::...   ` ;
              ; _ '    __        /:\
              `:o>   /\o_>      ;:. `.
             `-`.__ ;   __..--- /:.   \
             === \_/   ;=====_.':.     ;
              ,/'`--'...`--....        ;
                   ;                    ;
                 .'                      ;
               .'                        ;
             .'     ..     ,      .       ;
            :       ::..  /      ;::.     |
           /      `.;::.  |       ;:..    ;
          :         |:.   :       ;:.    ;
          :         ::     ;:..   |.    ;
           :       :;      :::....|     |
           /\     ,/ \      ;:::::;     ;
         .:. \:..|    :     ; '.--|     ;
        ::.  :''  `-.,,;     ;'   ;     ;
     .-'. _.'\      / `;      \,__:      \
     `---'    `----'   ;      /    \,.,,,/
                        `----`              fsc

Elysiatech is a application framework & game engine with a Three.js integration that
uses an entity component system (ECS) to manage state and behavior. In also
provides a robust library for handling asset loading, input management, event handling,
useful data structures, types, utility functions and more (found in lib.ts).

Elysiatech is designed to be modular and extensible -- the entire library is a small
collection of modules with very few dependencies, and can be easily integrated into projects
with minimal setup. It does not use NPM, rather users are encouraged to include the source
files directly which enables customization and ease of integration. The documention lives
directly in the source files.

# App

The App is the entrypoint to an Elysiatech application. It orchestrates the full
lifecycle: registering plugins, systems, resources, and events during configuration,
then running startup schedules and entering the main update loop.

    const app = App.WithDefaults()
      .addPlugins(myPlugin)
      .addSystems(Schedule.Update, movementSystem)
      .addEvents(CollisionEvent)
      .run();

An App follows a strict lifecycle: Configure → Run → Destroy.
Once destroyed, it cannot be restarted.

# Resources

Resources are singleton objects that hold global state. They are registered with
`addResources()` and automatically instantiated. Systems declare resource dependencies
by including the resource's constructor in their args, and receive the singleton
instance at runtime.

Built-in resources (provided by App.defaultsPlugin): Time, Triggerer, World, Input.

    class GameSettings { difficulty = 1; volume = 0.8; }

    const app = App.WithDefaults()
      .addResources(GameSettings)
      .addSystems(Schedule.Update, System("ReadSettings", [GameSettings], (settings) => {
        // settings is the singleton GameSettings instance
      }));

# Systems

Systems are the primary unit of behavior. Each system has a name, a list of
dependencies (queries, resources, event readers/writers), and a callback that
operates on those dependencies. Create them with the System() function.

    const gravitySystem = System(
      "Gravity",
      [Query(Mut(Velocity)), Time],
      (query, time) => {
        for (const [entity, vel] of query) {
          vel.deref().dy -= 9.8 * time.delta;
        }
      }
    );

Systems can enforce which schedules they are allowed to run on via
`.enforceSchedules()`, and can be restricted to specific app modes
(Debug, Dev, Prod) via `.modes()`.

# Events

Events enable decoupled communication between systems using double-buffered
event queues. Define an event type with Event(), register it with addEvents(),
then use EvReader() and EvWriter() in system args to consume or produce events.

Events persist for two frames (the frame they are written and one additional
frame), then expire automatically.

    const DamageEvent = Event<{ target: number; amount: number }>("Damage");

    const damageSystem = System(
      "ApplyDamage",
      [EvReader(DamageEvent), World],
      (reader, world) => {
        for (const event of reader) {
          const hp = world.getMut(event.target, Health);
          hp.value -= event.amount;
        }
      }
    );

    app.addEvents(DamageEvent);

# Plugins

Plugins are functions that receive an App instance and call configuration methods
on it, providing a way to modularize and share setup logic. Create them with
Plugin(name, fn).

    const PhysicsPlugin = Plugin("Physics", (app) => {
      app.addResources(PhysicsConfig)
         .addSystems(Schedule.Update, gravitySystem, collisionSystem)
         .addEvents(CollisionEvent);
    });

    App.WithDefaults().addPlugins(PhysicsPlugin).run();

# Scheduling

Schedules determine when systems execute. The Schedule enum defines the
application lifecycle phases:

  Startup (runs once):
    PreStartup → Startup → PostStartup

  Update (runs every frame, in order):
    PreUpdate → Update → PostUpdate → WorldFlush → EventUpdate → UpdateFinished

  Error / Teardown:
    StartupError (runs if a startup schedule throws)
    Destroy (runs once when app.destroy() is called)

Most game logic belongs on Schedule.Update. Input polling runs on PreUpdate.
Deferred entity despawns and component removals are applied after WorldFlush.

# Triggerer

The Triggerer is a resource that broadcasts entity and component lifecycle events,
such as ComponentInserted, ComponentRemovalScheduled, EntitySpawned, and
EntityDespawnScheduled. Systems can register responders via the Triggerer to react
to these events — for example, the built-in relationship system uses it to
cascade despawns from parent to child entities.

See the Triggerer and Trigger classes in lib.ts for full documentation.

# Entity Component System (ECS)

The World class is the central data structure of the ECS. It manages entities
(lightweight numeric IDs) and their associated components (plain class instances).

  - Spawn entities:        world.spawn(new Position(0, 0), new Velocity(1, 1))
  - Insert components:     world.insert(entity, new Health(100))
  - Read components:       world.get(entity, Position)      // Immutable<Position>
  - Mutate components:     world.getMut(entity, Position)    // marks as changed
  - Despawn/remove:        world.despawn(entity)             // deferred until flush

Despawns and component removals are deferred — they are queued and only applied
when world.flush() is called (during the WorldFlush schedule). This ensures
systems can safely iterate without invalidating state mid-frame.

The World also tracks component mutations across frames. Components accessed via
getMut() or Mut() in queries are marked as changed, and can be filtered with
Mutated() queries. See the World class documentation for full details.

# Queries

Queries let systems iterate over entities that have a specific set of components.
Define them with Query() and include them in a system's args to receive a
QueryIterator.

    // Basic immutable query
    const renderSystem = System("Render", [Query(Position, Sprite)], (query) => {
      for (const [entity, pos, sprite] of query) {
        draw(sprite, pos.x, pos.y);
      }
    });

    // Mutable query — use Mut() and call .deref() to write
    const moveSystem = System("Move", [Query(Mut(Position), Velocity)], (query) => {
      for (const [entity, mutPos, vel] of query) {
        const pos = mutPos.deref(); // marks Position as changed
        pos.x += vel.dx;
      }
    });

    // Change-filtered query — only yields entities whose component changed this frame
    const changedSystem = System("OnChange", [Query(Mutated(Position))], (query) => {
      for (const [entity, pos] of query) { // ... }
    });

QueryIterator also provides forEach(), first(), entities(), and components()
helpers. See the QueryIterator class for full documentation.

# Input & Relationships

The Input resource provides unified keyboard, mouse, and gamepad state tracking,
and the Relationship component enables parent-child entity hierarchies. Both are
registered automatically by App.defaultsPlugin. See the Input and Relationship
class documentation for details.

# Example

    // --- Define components ---
    class Position { constructor(public x = 0, public y = 0) {} }
    class Velocity { constructor(public dx = 0, public dy = 0) {} }

    // --- Define events ---
    const HitWallEvent = Event<{ entity: number }>("HitWall");

    // --- Define systems ---
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

    // --- Define a plugin ---
    const GamePlugin = Plugin("Game", (app) => {
      app
        .addSystems(Schedule.Startup, spawnEntities)
        .addSystems(Schedule.Update, movementSystem)
        .addEvents(HitWallEvent);
    });

    // --- Run the app ---
    App.WithDefaults(CustomConfig)
      .addSystems(Schedule.Startup, spawnEntities)
      .addSystems(Schedule.Update, movementSystem)
      .addEvents(HitBoundary)
      .run();

_,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,_*/

import {
  type Immutable,
  type InstanceOf,
  assertInstanceOf,
  AutoMap,
  ConstructorOf,
  Event,
  EventQueue,
  EventReader,
  eventReaderTag,
  EventWriter,
  eventWriterTag,
  isConstructor,
  logColors,
  Logger,
  LogLevel,
  mustExist,
  noop,
  RefRegistry,
  SparseSet,
  Triggerer,
  Time,
  ResourceManager,
  KeyCode,
  KeyCodeRegistry,
  MouseCode,
  MouseCodeRegistry,
  GamepadButton,
} from "./lib.ts";

// F_schedule
/* .d8888.  .o88b. db   db d88888b d8888b. db    db db      d88888b  */
/* 88'  YP d8P  Y8 88   88 88'     88  `8D 88    88 88      88'      */
/* `8bo.   8P      88ooo88 88ooooo 88   88 88    88 88      88ooooo  */
/*   `Y8b. 8b      88~~~88 88~~~~~ 88   88 88    88 88      88~~~~~  */
/* db   8D Y8b  d8 88   88 88.     88  .8D 88b  d88 88booo. 88.      */
/* `8888Y'  `Y88P' YP   YP Y88888P Y8888D' ~Y8888P' Y88888P Y88888P  */

/**
 * Defines the execution phases (schedules) of the application lifecycle.
 *
 * Schedules determine when systems run. Startup schedules execute once during
 * initialization, while update schedules run each frame in a specific order.
 * The app also provides error handling and teardown schedules.
 */
export enum Schedule {
  /**
   * Runs once before {@link Startup}, for early initialization tasks.
   */
  PreStartup = "PreStartup",

  /**
   * Runs once during app startup, after {@link PreStartup} and before {@link PostStartup}.
   * Most useful for application-level initialization logic.
   */
  Startup = "Startup",

  /**
   * Runs once after {@link Startup}, for initialization tasks that depend on startup systems.
   */
  PostStartup = "PostStartup",

  /**
   * Runs when an error occurs during any startup schedule.
   * Use for cleanup or error reporting before the error is re-thrown.
   */
  StartupError = "StartupError",

  /**
   * Runs each frame before {@link Update}.
   * Use for pre-frame logic like input polling.
   */
  PreUpdate = "PreUpdate",

  /**
   * Runs each frame as the main update schedule.
   * Most app logic systems belong here.
   */
  Update = "Update",

  /**
   * Runs each frame before {@link WorldFlush}.
   * Use for late-frame logic that must complete after update systems.
   */
  PostUpdate = "PostUpdate",

  /**
   * Runs each frame before the world flushes queued entity despawns and component removals.
   * Systems here can perform final queries before entities are removed.
   *
   * Any systems with {@link Mutated} queries should run on this schedule or a previous update schedule.
   */
  WorldFlush = "WorldFlush",

  /**
   * Runs each frame before event buffers are swapped.
   * This is not usually used for app logic.
   * Any {@link Mutated} queries running on this schedule will not return any results.
   */
  EventUpdate = "EventUpdate",

  /**
   * Is the final step of the frame loop, runnning after {@link EventUpdate}.
   * Any {@link Mutated} queries running on this schedule will not return any results.
   */
  UpdateFinished = "UpdateFinished",

  /**
   * Runs once when {@link App.destroy} is called.
   * Use for cleanup and resource teardown.
   */
  Destroy = "Destroy",
}

// F_entity
/* d88888b d8b   db d888888b d888888b d888888b db    db */
/* 88'     888o  88 `~~88~~'   `88'   `~~88~~' `8b  d8' */
/* 88ooooo 88V8o 88    88       88       88     `8bd8'  */
/* 88~~~~~ 88 V8o88    88       88       88       88    */
/* 88.     88  V888    88      .88.      88       88    */
/* Y88888P VP   V8P    YP    Y888888P    YP       YP    */

export type EntityID = number;

export const Entity = Number;

export const currentEntity = Symbol.for("CurrentEntity");

// F_query
/*  .d88b.  db    db d88888b d8888b. db    db */
/* .8P  Y8. 88    88 88'     88  `8D `8b  d8' */
/* 88    88 88    88 88ooooo 88oobY'  `8bd8'  */
/* 88    88 88    88 88~~~~~ 88`8b      88    */
/* `8P  d8' 88b  d88 88.     88 `88.    88    */
/*  `Y88'Y8 ~Y8888P' Y88888P 88   YD    YP    */

const mutTag = Symbol.for("MutTag");

type MutParam<T> = {
  [mutTag]: T;
};

/**
 * Marks a component as mutable in a query.
 * This ensures proper change tracking and prevents aliasing issues.
 */
export function Mut<T>(value: T): MutParam<T> {
  return { [mutTag]: value };
}

/**
 * A reference to a mutable component.
 * Tracks mutations to ensure proper change detection.
 */
class MutRef<T> {
  constructor(world: World) {
    this.world = world;
  }

  /**
   * Dereferences the mutable component and marks it as changed.
   * @returns The mutable component.
   */
  deref(): T {
    this.world.markChanged(this.value!);
    return this.value;
  }

  /**
   * Gets an immutable reference to the component.
   * @returns The immutable component.
   */
  get ref(): Immutable<T> {
    return <Immutable<T>>this.value;
  }

  private world!: World;
  private value!: T;
}

type MutatedParam<T> = {
  [mutatedTag]: T;
};

const mutatedTag = Symbol.for("MutatedTag");

/**
 * Filters a query to only yield entities whose component was mutated this frame.
 * Components are considered mutated when accessed via `Mut` deref or `getMut`.
 * Newly inserted components are also treated as mutated.
 */
export function Mutated<T>(value: T): MutatedParam<T> {
  return { [mutatedTag]: value };
}

type QueryList = readonly (
  | ConstructorOf<Object>
  | MutParam<any>
  | MutatedParam<any>
)[];

const queryTag = Symbol.for("QueryTag");
export function Query<T extends QueryList>(...values: T) {
  (<any>values)[queryTag] = true;
  return values;
}

type InferQuery<T extends QueryList> = {
  [K in keyof T]: T[K] extends MutParam<infer U>
    ? MutRef<InstanceOf<U>>
    : T[K] extends MutatedParam<infer U>
      ? InstanceOf<U>
      : T[K] extends ConstructorOf<Object>
        ? Immutable<InstanceOf<T[K]>>
        : never;
};

// F_system
/* .d8888. db    db .d8888. d888888b d88888b .88b  d88. */
/* 88'  YP `8b  d8' 88'  YP `~~88~~' 88'     88'YbdP`88 */
/* `8bo.    `8bd8'  `8bo.      88    88ooooo 88  88  88 */
/*   `Y8b.    88      `Y8b.    88    88~~~~~ 88  88  88 */
/* db   8D    88    db   8D    88    88.     88  88  88 */
/* `8888Y'    YP    `8888Y'    YP    Y88888P YP  YP  YP */

type InferEventReader<T extends Event<any>> = {
  [eventReaderTag]: boolean;
  event: T;
};

type InferEventWriter<T extends Event<any>> = {
  [eventWriterTag]: boolean;
  event: T;
};

export type QueryResult<T extends QueryList> = [
  entityID: EntityID,
  ...InferQuery<T>,
];

/**
 * Wraps a world query to provide ergonomic iteration and access patterns.
 * Constructed automatically when a system declares a `Query(...)` argument.
 */
export class QueryIterator<T extends QueryList> {
  #world: World;
  #query: T;

  constructor(world: World, query: T) {
    this.#world = world;
    this.#query = query;
  }

  /**
   * Enables iteration over query results via `for...of`.
   */
  [Symbol.iterator](): IterableIterator<QueryResult<T>> {
    return this.iter();
  }

  /**
   * Returns an iterator over query results.
   * Each result is a tuple of `[entityID, ...components]`.
   */
  iter(): IterableIterator<QueryResult<T>> {
    return this.#world.queryIter(this.#query);
  }

  /**
   * Iterate over each result, destructuring the entity id and components into callback arguments.
   */
  forEach(
    fn: (entityID: EntityID, ...components: InferQuery<T>) => void,
  ): void {
    for (const [entity, ...components] of this.iter()) {
      fn(entity, ...(components as any));
    }
  }

  /**
   * Returns the first query result, or `undefined` if the query matches nothing.
   * Useful for singleton components.
   */
  first(): QueryResult<T> | undefined {
    const it = this.iter();
    const n = it.next();
    return n.done ? undefined : (n.value as any);
  }

  /**
   * Iterate only entity ids, discarding component data.
   */
  *entities(): IterableIterator<EntityID> {
    for (const [entity] of this.iter()) {
      yield entity;
    }
  }

  /**
   * Iterate only component tuples, discarding entity ids.
   */
  *components(): IterableIterator<InferQuery<T>> {
    for (const [, ...components] of this.iter()) {
      yield components as any;
    }
  }
}

type InferSystemArgs<T> = {
  [K in keyof T]: T[K] extends ConstructorOf<Object>
    ? InstanceOf<T[K]>
    : T[K] extends QueryList
      ? QueryIterator<T[K]>
      : T[K] extends InferEventReader<infer U>
        ? EventReader<U>
        : T[K] extends InferEventWriter<infer U>
          ? EventWriter<U>
          : T[K] extends RefRegistry
            ? RefRegistry
            : never;
};

type SystemCallback<T extends readonly any[] = []> = (
  ...args: InferSystemArgs<T>
) => void;

type SystemOptions = {
  enforceSchedules?: Array<Schedule>;
  modes?: Array<AppMode>;
};

/**
 * Creates a named system with typed arguments and an execution callback.
 * Systems are the primary unit of behavior in the ECS — they operate on
 * queries, resources, and events each frame (or during a specific schedule).
 * @param name - The name of the system.
 * @param args - An array of dependencies that the system requires. These can be:
 *   - QueryList: A query defined with `Query(...)` that will be converted to a `QueryIterator`
 *   - EventReader: An event reader for a specific event type
 *   - EventWriter: An event writer for a specific event type
 *   - ConstructorOf<Object>: A resource type that will be resolved from the app's resource manager
 * @param callback - The function that will be executed when the system runs. It receives the
 *   resolved dependencies (queries, resources, event readers/writers) as arguments.
 * @param options - Optional configuration for the system.
 */
export function System<T extends readonly any[] = []>(
  name: string,
  args: [...T],
  callback: SystemCallback<T>,
  options: Partial<SystemOptions> = {},
) {
  const system = {
    name,
    args,
    callback,
    options,
    enforceSchedules: (...schedules: Schedule[]) => {
      system.options.enforceSchedules ??= [];
      system.options.enforceSchedules!.push(...schedules);
      return system;
    },
    modes: (...modes: AppMode[]) => {
      system.options.modes ??= [];
      system.options.modes!.push(...modes);
      return system;
    },
  };

  return system;
}

export type System = ReturnType<typeof System>;

// F_world
/* db   d8b   db  .d88b.  d8888b. db      d8888b. */
/* 88   I8I   88 .8P  Y8. 88  `8D 88      88  `8D */
/* 88   I8I   88 88    88 88oobY' 88      88   88 */
/* Y8   I8I   88 88    88 88`8b   88      88   88 */
/* `8b d8'8b d8' `8b  d8' 88 `88. 88booo. 88  .8D */
/*  `8b8' `8d8'   `Y88P'  88   YD Y88888P Y8888D' */

/**
 * Event triggered when a component is inserted into an entity.
 * Fired by {@link World.insert} after a component is successfully attached.
 */
export class ComponentInserted {}
const componentInserted = new ComponentInserted();

/**
 * Event triggered when a component is scheduled for removal from an entity.
 * Fired by {@link World.remove} when a component is queued for deferred removal.
 */
export class ComponentRemovalScheduled {}
const componentRemovalScheduled = new ComponentRemovalScheduled();

/**
 * Event triggered when an entity is spawned into the world.
 * Fired by {@link World.spawn} after the entity is created.
 */
export class EntitySpawned {}
const entitySpawned = new EntitySpawned();

/**
 * Event triggered when an entity is scheduled for despawn.
 * Fired by {@link World.despawn} when an entity is queued for deferred removal.
 */
export class EntityDespawnScheduled {}
const entityDespawnScheduled = new EntityDespawnScheduled();

/**
 * The central data structure of the Entity Component System (ECS).
 *
 * `World` manages entities and their associated components, providing methods to
 * spawn and despawn entities, insert and remove components, query for entities
 * matching component archetypes, and track component mutations across frames.
 *
 * ### Entities
 * Entities are lightweight numeric identifiers ({@link EntityID}) created via {@link spawn}.
 * They serve as keys that bind components together into a logical game object.
 *
 * ### Components
 * Components are plain class instances attached to entities via {@link insert}.
 * Each entity may hold at most one instance of a given component type, and each
 * component instance may belong to at most one entity at a time.
 *
 * ### Deferred Operations
 * Despawns and component removals are **deferred** — they are queued and only
 * applied when {@link flush} is called (typically during the `WorldFlush` schedule).
 * This ensures systems can safely iterate entities without invalidating iteration state.
 *
 * ### Change Tracking
 * The world tracks which components were mutated during a frame. Components accessed
 * via {@link getMut} are immediately marked as changed. In queries, `Mut(Component)`
 * wraps the component in a {@link MutRef} — the component is only marked as changed
 * when you call `.deref()`, while `.ref` provides an immutable view without triggering
 * change detection. Newly inserted components are also marked as changed.
 * The {@link Mutated} query filter yields only entities whose component changed this
 * frame. Call {@link tick} at the end of a frame to reset change tracking and
 * advance the generation counter.
 *
 * ### Querying
 * Use {@link queryIter} (or the higher-level {@link QueryIterator} in systems) to
 * efficiently iterate entities that possess a specific set of components. Queries
 * support immutable access, mutable access via `Mut(Component)`, and changed-only
 * filtering via `Mutated(Component)`.
 *
 * @example
 * ```ts
 * const world = new World();
 *
 * // Spawn an entity with components
 * const entity = world.spawn(new Position(0, 0), new Velocity(1, 1));
 *
 * // Read a component (immutable)
 * const pos = world.get(entity, Position); // Immutable<Position>
 *
 * // Write a component (marks it as changed)
 * const vel = world.getMut(entity, Velocity);
 * vel.x = 5;
 *
 * // Query all entities with both Position and Velocity
 * for (const [id, pos, vel] of world.queryIter([Position, Velocity])) {
 *   // pos and vel are immutable here
 * }
 *
 * // Deferred despawn — entity is removed on next flush()
 * world.despawn(entity);
 * world.flush();
 * ```
 */
export class World {
  #entityCount = 0;
  #entities: Set<EntityID> = new Set();
  #componentMap: AutoMap<ConstructorOf<Object>, SparseSet<Object>> =
    new AutoMap(() => new SparseSet());
  #despawnQueue = new Set<EntityID>();
  #removalQueue = new AutoMap<ConstructorOf<Object>, Set<EntityID>>(
    () => new Set(),
  );
  #sharedIterResult: any[] = [];
  #mutWrappers = Array.from({ length: 100 }).map(() => new MutRef(this));
  #generation = 0;

  #mutatedComponentMap = new AutoMap<ConstructorOf<Object>, SparseSet<Object>>(
    () => new SparseSet(),
  );

  /**
   * The current generation (frame) counter.
   * Incremented each time {@link tick} is called.
   * Useful for frame-relative comparisons and cache invalidation.
   */
  get generation(): number {
    return this.#generation;
  }

  /** Optional triggerer for broadcasting entity and component lifecycle events. */
  public triggerer?: Triggerer;

  /**
   * Creates a new entity in the world, optionally with an initial set of components.
   * @param components - Components to attach to the newly created entity.
   * @returns The {@link EntityID} of the spawned entity.
   * @throws If any provided component instance already belongs to another entity.
   */
  spawn(...components: Object[]): EntityID {
    const entity = ++this.#entityCount;
    this.#entities.add(entity);
    this.triggerer?.trigger(entitySpawned, entity);
    for (const c of components) {
      this.insert(entity, c);
    }
    return entity;
  }

  /**
   * Schedules one or more entities for deferred despawn.
   *
   * The entities are not removed immediately — they remain queryable and accessible
   * until {@link flush} is called. This allows systems to safely reference entities
   * during the current frame even after they have been marked for despawn.
   *
   * @param entities - The entity IDs to despawn.
   * @throws If any of the provided entities do not exist in the world.
   */
  despawn(...entities: EntityID[]) {
    for (const entity of entities) {
      if (!this.exists(entity)) {
        throw Error(`Entity ${entity} does not exist`);
      }
    }
    entities.forEach((it) => {
      this.#despawnQueue.add(it);
      this.triggerer?.trigger(entityDespawnScheduled, it);
    });
  }

  /**
   * Attempts to schedule entities for deferred despawn.
   * Unlike {@link despawn}, this does not throw on invalid entities.
   * @param entities - The entity IDs to despawn.
   * @returns `true` if all entities were successfully queued, `false` if an error occurred.
   */
  tryDespawn(...entities: EntityID[]): boolean {
    try {
      this.despawn.apply(this, entities);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Attaches one or more component instances to an existing entity.
   *
   * Newly inserted components are automatically marked as mutated for the current
   * frame, since they may be modified after insertion.
   *
   * @param entity - The target entity.
   * @param components - The component instances to attach.
   * @throws If the entity does not exist.
   * @throws If any component instance is already attached to another entity.
   * @throws If the entity already has a component of the same type.
   */
  insert(entity: EntityID, ...components: Object[]) {
    if (!this.exists(entity)) {
      throw Error(`Entity ${entity} does not exist`);
    }

    for (const component of components) {
      if ((<any>component)[currentEntity]) {
        throw Error(`Component exists on another entity`);
      }

      if (this.has(entity, ConstructorOf(component))) {
        throw Error(
          `Entity ${entity} already contains component ${ConstructorOf(component).name}`,
        );
      }

      (<any>component)[currentEntity] = entity;
      this.#componentMap.get(ConstructorOf(component)).add(entity, component);
      // add to mutated components since components added are inherently mutable,
      // so they might be mutated after insertion
      this.#mutatedComponentMap
        .get(ConstructorOf(component))
        .add(entity, component);
      this.triggerer?.trigger(componentInserted, component);
    }
  }

  /**
   * Attempts to attach components to an entity.
   * Unlike {@link insert}, this does not throw on failure.
   * @param entity - The target entity.
   * @param components - The component instances to attach.
   * @returns `true` if all components were successfully inserted, `false` if an error occurred.
   */
  tryInsert(entity: EntityID, ...components: Object[]): boolean {
    try {
      this.insert(entity, ...components);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Schedules one or more component types for deferred removal from an entity.
   *
   * Like {@link despawn}, removals are deferred — the component remains accessible
   * until {@link flush} is called.
   *
   * @param entity - The entity to remove components from.
   * @param components - The component type constructors to remove.
   * @throws If the entity does not exist.
   */
  remove(entity: EntityID, ...components: ConstructorOf<Object>[]) {
    if (!this.exists(entity)) {
      throw Error(`Entity ${entity} does not exist`);
    }

    for (const component of components) {
      this.#removalQueue.get(component).add(entity);
      this.triggerer?.trigger(componentRemovalScheduled, component);
    }
  }

  /**
   * Attempts to schedule component types for deferred removal.
   * Unlike {@link remove}, this does not throw on failure.
   * @param entity - The entity to remove components from.
   * @param components - The component type constructors to remove.
   * @returns `true` if all removals were successfully queued, `false` if an error occurred.
   */
  tryRemove(entity: EntityID, ...components: ConstructorOf<Object>[]): boolean {
    try {
      this.remove(entity, ...components);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks whether an entity currently has **all** of the specified component types.
   *
   * Note: components scheduled for removal via {@link remove} still return `true`
   * until {@link flush} is called.
   *
   * @param entity - The entity to check.
   * @param components - The component type constructors to test for.
   * @returns `true` if the entity has every listed component type, `false` otherwise.
   */
  has(entity: EntityID, ...components: ConstructorOf<Object>[]): boolean {
    for (const component of components) {
      if (!this.#componentMap.get(component).has(entity)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Checks whether an entity exists in the world.
   * @param entity - The entity ID to check.
   * @returns `true` if the entity is alive (has not been flushed after despawn).
   */
  exists(entity: EntityID): boolean {
    return this.#entities.has(entity);
  }

  /**
   * Retrieves an immutable reference to a component on an entity.
   *
   * The returned value is typed as `Immutable<T>` to discourage direct mutation.
   * To mutate a component with proper change tracking, use {@link getMut} instead.
   *
   * @typeParam T - The component type.
   * @param entity - The entity that owns the component.
   * @param componentType - The component type constructor.
   * @returns An immutable reference to the component.
   * @throws If the component does not exist on the entity.
   */
  get<T extends Object>(
    entity: EntityID,
    componentType: ConstructorOf<T>,
  ): Immutable<T> {
    if (!this.#componentMap.get(componentType).has(entity)) {
      throw Error(`Component ${componentType.name} does not exist on entity`);
    }
    return <Immutable<T>>this.#componentMap.get(componentType).get(entity);
  }

  /**
   * Retrieves an immutable reference to a component, or `null` if it doesn't exist.
   * Unlike {@link get}, this does not throw on missing components.
   * @typeParam T - The component type.
   * @param entity - The entity that owns the component.
   * @param component - The component type constructor.
   * @returns An immutable reference to the component, or `null`.
   */
  tryGet<T extends Object>(
    entity: EntityID,
    component: ConstructorOf<T>,
  ): Immutable<T> | null {
    if (!this.#componentMap.get(component).has(entity)) {
      return null;
    }
    return <Immutable<T>>this.#componentMap.get(component).get(entity);
  }

  /**
   * Retrieves a mutable reference to a component on an entity.
   *
   * The component is automatically marked as changed for the current frame,
   * making it visible to {@link Mutated} queries and {@link componentChanged} checks.
   *
   * @typeParam T - The component type.
   * @param entity - The entity that owns the component.
   * @param componentType - The component type constructor.
   * @returns A mutable reference to the component.
   * @throws If the component does not exist on the entity.
   */
  getMut<T extends Object>(
    entity: EntityID,
    componentType: ConstructorOf<T>,
  ): T {
    if (!this.#componentMap.get(componentType).has(entity)) {
      throw Error(`Component ${componentType.name} does not exist on entity`);
    }
    const component = <T>this.#componentMap.get(componentType).get(entity);
    this.#mutatedComponentMap.get(componentType).add(entity, component);
    return component;
  }

  /**
   * Retrieves a mutable reference to a component, or `null` if it doesn't exist.
   * Like {@link getMut}, the component is marked as changed if found.
   * Unlike {@link getMut}, this does not throw on missing components.
   * @typeParam T - The component type.
   * @param entity - The entity that owns the component.
   * @param componentType - The component type constructor.
   * @returns A mutable reference to the component, or `null`.
   */
  tryGetMut<T extends Object>(
    entity: EntityID,
    componentType: ConstructorOf<T>,
  ): T | null {
    if (!this.#componentMap.get(componentType).has(entity)) {
      return null;
    }
    const component = <T>this.#componentMap.get(componentType).get(entity);
    this.#mutatedComponentMap.get(componentType).add(entity, component);
    return component;
  }

  /**
   * Moves a component from one entity to another.
   *
   * The component instance is detached from `from` and attached to `to`.
   * This is an **immediate** operation (not deferred). Triggers removal and
   * insertion events via the triggerer if present.
   *
   * @typeParam T - The component type.
   * @param componentType - The component type constructor to move.
   * @param from - The source entity that currently owns the component.
   * @param to - The destination entity to receive the component.
   * @throws If the component does not exist on the `from` entity.
   * @throws If the `to` entity does not exist in the world.
   */
  swap<T extends Object>(
    componentType: ConstructorOf<T>,
    from: EntityID,
    to: EntityID,
  ) {
    if (!this.#componentMap.get(componentType).has(from)) {
      throw Error(`Component ${componentType.name} does not exist on entity`);
    }
    if (!this.exists(to)) {
      throw Error(`to value of swap does not exist in world`);
    }

    const component = this.#componentMap.get(componentType).get(from)!;
    this.triggerer?.trigger(componentRemovalScheduled, from, component);

    (<any>component)[currentEntity] = to;
    this.#componentMap.get(componentType).remove(from);
    this.#componentMap.get(componentType).add(to, component);

    this.triggerer?.trigger(componentInserted, component);
  }

  /**
   * Attempts to move a component from one entity to another.
   * Unlike {@link swap}, this does not throw on failure.
   * @typeParam T - The component type.
   * @param componentType - The component type constructor to move.
   * @param from - The source entity.
   * @param to - The destination entity.
   * @returns `true` if the swap succeeded, `false` if the component or entity was missing.
   */
  trySwap<T extends Object>(
    componentType: ConstructorOf<T>,
    from: EntityID,
    to: EntityID,
  ): boolean {
    if (!this.#componentMap.get(componentType).has(from) || !this.exists(to)) {
      return false;
    }

    const component = this.#componentMap.get(componentType).get(from)!;
    this.triggerer?.trigger(componentRemovalScheduled, from, component);

    (<any>component)[currentEntity] = to;

    this.#componentMap.get(componentType).remove(from);
    this.#componentMap.get(componentType).add(to, component);
    this.triggerer?.trigger(componentInserted, component);

    return true;
  }

  /**
   * Checks whether an entity has been scheduled for despawn but not yet flushed.
   * @param entity - The entity ID to check.
   * @returns `true` if the entity is in the despawn queue.
   */
  willDespawn(entity: EntityID): boolean {
    return this.#despawnQueue.has(entity);
  }

  /**
   * Checks whether a component type has been scheduled for removal from an entity but not yet flushed.
   * @param entity - The entity to check.
   * @param component - The component type constructor to check.
   * @returns `true` if the component is in the removal queue for this entity.
   */
  willRemove(entity: EntityID, component: ConstructorOf<Object>): boolean {
    return this.#removalQueue.get(component).has(entity);
  }

  /**
   * Retrieves the entity ID that owns a given component instance.
   * @param component - A component instance currently attached to an entity.
   * @returns The owning {@link EntityID}.
   * @throws If the object is not a component currently attached to any entity.
   */
  getEntity(component: Object): EntityID {
    if (currentEntity in component && component[currentEntity]) {
      return <EntityID>component[currentEntity];
    }
    throw Error(`Object is not component in World`);
  }

  /**
   * Retrieves the entity ID that owns a given component instance, or `null` if it isn't attached.
   * Unlike {@link getEntity}, this does not throw.
   * @param component - A component instance.
   * @returns The owning {@link EntityID}, or `null`.
   */
  tryGetEntity(component: Object): EntityID | null {
    if (currentEntity in component && component[currentEntity]) {
      return <EntityID>component[currentEntity];
    }
    return null;
  }

  /**
   * Manually marks a component as changed for the current frame.
   *
   * This is called automatically by {@link getMut}, `Mut` query derefs, and on
   * component insertion. Use this when you have mutated a component through some
   * other path (e.g. a cached reference) and need change detection to pick it up.
   *
   * @param component - The component instance to mark as changed.
   */
  markChanged(component: Object) {
    this.#mutatedComponentMap
      .get(ConstructorOf(component))
      .add(this.getEntity(component), component);
  }

  /**
   * Checks whether a component has been marked as changed during the current frame.
   * @param component - The component instance to check.
   * @returns `true` if the component was mutated (or inserted) this frame.
   */
  componentChanged(component: Object): boolean {
    const entity = this.getEntity(component);
    return this.#mutatedComponentMap.get(ConstructorOf(component)).has(entity);
  }

  /**
   * Applies all deferred despawns and component removals.
   *
   * - Entities in the despawn queue have all their components detached and are
   *   removed from the world.
   * - Components in the removal queue are detached from their respective entities.
   *
   * This is typically called once per frame during the `WorldFlush` schedule,
   * after all systems have finished running.
   */
  flush() {
    for (const entity of this.#despawnQueue) {
      if (this.exists(entity)) {
        for (const componentType of this.#componentMap.keys()) {
          const component = this.#componentMap.get(componentType).get(entity);
          (<any>component)[currentEntity] = undefined;
          this.#componentMap.get(componentType).remove(entity);
        }
      }
      this.#entities.delete(entity);
      this.#despawnQueue.delete(entity);
    }

    for (const [componentType, entities] of this.#removalQueue) {
      for (const entity of entities) {
        if (this.exists(entity)) {
          const component = this.#componentMap.get(componentType).get(entity);
          (<any>component)[currentEntity] = undefined;
          this.#componentMap.get(componentType).remove(entity);
        }
      }
      entities.clear();
    }
  }

  /**
   * Advances the world to the next frame.
   *
   * Clears all change-tracking data (the mutated component map) and increments
   * the {@link generation} counter. Call this at the end of each frame, after
   * {@link flush}, to reset mutation state for the next frame.
   */
  tick() {
    for (const set of this.#mutatedComponentMap.values()) {
      set.clear();
    }
    this.#generation++;
  }

  /**
   * Iterates over all entities matching a component query.
   *
   * Each yielded result is a tuple of `[EntityID, ...components]` where the
   * components correspond positionally to the query items. The iterator uses a
   * shared result array for performance — values should be consumed immediately
   * or copied, as the array is reused on each iteration step.
   *
   * Query items can be:
   * - **A component constructor** (e.g. `Position`) — yields an `Immutable<T>` reference.
   * - **`Mut(Component)`** — yields a {@link MutRef} wrapper. Call `.deref()` to get
   *   a mutable reference and mark the component as changed, or use `.ref` for an
   *   immutable view without triggering change detection.
   * - **`Mutated(Component)`** — filters to only entities whose component was changed this frame.
   *
   * The iterator uses a smallest-set optimization: it begins iterating from the
   * component set with the fewest entries, skipping entities that lack other
   * required components.
   *
   * @typeParam T - The query tuple type.
   * @param query - An array of component constructors, `Mut(...)`, or `Mutated(...)` wrappers.
   * @returns An iterator over matching `[EntityID, ...components]` tuples.
   * @throws If the query contains more than 100 component items.
   *
   * @example
   * ```ts
   * // Immutable query
   * for (const [id, pos, vel] of world.queryIter([Position, Velocity])) { ... }
   *
   * // Mutable query — .deref() marks the component as changed
   * for (const [id, mutPos] of world.queryIter(Query(Mut(Position)))) {
   *   console.log(mutPos.ref.x);   // read without triggering change detection
   *   mutPos.deref().x += 1;       // marks Position as changed
   * }
   *
   * // Only iterate entities whose Position changed this frame
   * for (const [id, pos] of world.queryIter([Mutated(Position)])) { ... }
   * ```
   */
  *queryIter<T extends QueryList>(
    query: T,
  ): IterableIterator<[EntityID, ...InferQuery<T>]> {
    const unwrapQueryItem = (item: any) =>
      item[mutTag] ?? item[mutatedTag] ?? item;

    const getMap = (item: any) =>
      mutatedTag in item ? this.#mutatedComponentMap : this.#componentMap;

    if (query.length === 0) return;

    if (query.length > this.#mutWrappers.length) {
      throw new Error("Query has more than 100 components which is the max");
    }

    let smallest = getMap(query[0]).get(unwrapQueryItem(query[0]));

    for (let i = 1; i < query.length; i++) {
      const set = getMap(query[i]).get(unwrapQueryItem(query[i]));
      if (set.size === 0) return;
      if (set.size < smallest.size) {
        smallest = set;
      }
    }

    this.#sharedIterResult.length = query.length + 1;

    outer: for (const [entity] of smallest) {
      this.#sharedIterResult[0] = entity;

      for (let i = 0; i < query.length; i++) {
        this.#sharedIterResult[i + 1] = getMap(query[i])
          .get(unwrapQueryItem(query[i]))
          .get(entity);

        // move on if component is missing
        if (!this.#sharedIterResult[i + 1]) continue outer;

        if (mutTag in query[i]) {
          (<any>this.#mutWrappers[i]).value = this.#sharedIterResult[i + 1];
          this.#sharedIterResult[i + 1] = this.#mutWrappers[i];
        }
      }
      yield this.#sharedIterResult as any;
    }
  }
}

/* d8888b. db      db    db  d888b  d888888b d8b   db */
/* 88  `8D 88      88    88 88' Y8b   `88'   888o  88 */
/* 88oodD' 88      88    88 88         88    88V8o 88 */
/* 88~~~   88      88    88 88  ooo    88    88 V8o88 */
/* 88      88booo. 88b  d88 88. ~8~   .88.   88  V888 */
/* 88      Y88888P ~Y8888P'  Y888P  Y888888P VP   V8P */

const pluginName = Symbol.for("PluginName");

export type Plugin = ((app: App) => void) & { [pluginName]?: string };

export function Plugin(name: string, plugin: Plugin): Plugin {
  plugin[pluginName] = name;
  return plugin;
}

// F_app
/*  .d8b.  d8888b. d8888b. */
/* d8' `8b 88  `8D 88  `8D */
/* 88ooo88 88oodD' 88oodD' */
/* 88~~~88 88~~~   88~~~   */
/* 88   88 88      88      */
/* YP   YP 88      88      */

/**
 * Defines the execution mode of the application.
 *
 * The app mode determines the level of logging and can be used to conditionally
 * enable or disable systems based on the environment (e.g., development tools,
 * debug overlays, or production optimizations).
 *
 * Systems can be configured to only run in specific modes using the `.modes(...)`
 * method when defining a system.
 */
export enum AppMode {
  /**
   * Debug mode — enables verbose logging (LogLevel.Debug) and is intended for
   * active development and troubleshooting. Systems marked with this mode will
   * only run when the app is in Debug mode.
   */
  Debug = "ModeDebug",

  /**
   * Development mode — enables informational logging (LogLevel.Info) and is
   * suitable for general development work. Systems marked with this mode will
   * only run when the app is in Dev mode.
   */
  Dev = "ModeDev",

  /**
   * Production mode — disables logging (LogLevel.Silent) for performance and
   * is intended for release builds. This is the default mode. Systems marked
   * with this mode will only run when the app is in Prod mode.
   */
  Prod = "ModeProd",
}

/**
 * Configuration for the {@link App} lifecycle, controlling timing, error handling, logging, and execution mode.
 *
 * The `Configuration` class allows you to customize how the app runs:
 * - **Time step** — controls the frame rate of the update loop.
 * - **Fixed time step** — defines the interval for fixed-rate physics/logic updates (future use).
 * - **Error handling** — determines whether system errors are thrown or logged.
 * - **App mode** — sets the execution environment (Debug, Dev, or Prod), affecting logging verbosity and conditional system execution.
 * - **Logger** — an optional custom logger instance for controlling app-level logging output.
 *
 * An instance of `Configuration` is passed to the {@link App} constructor and can be accessed
 * internally via the app's resource manager.
 *
 * @example
 * ```ts
 * const config = new Configuration();
 * config.mode = AppMode.Debug;
 * config.timeStep = 16; // ~60fps
 * config.throwOnSystemError = true;
 *
 * const app = new App(config);
 * ```
 */
export class Configuration {
  /**
   * The update timestep in milliseconds.
   *
   * - **`0`** (default) — uses `requestAnimationFrame`, running the update loop as fast as
   *   the browser allows (typically 60fps).
   * - **Any positive value** — uses `setTimeout` to run the update loop at a fixed interval,
   *   e.g., `16` for approximately 60fps, `33` for approximately 30fps.
   *
   * Set this to a non-zero value if you want a fixed frame rate or if running in a non-browser
   * environment where `requestAnimationFrame` is unavailable.
   */
  timeStep = 0;

  /**
   * The fixed update timestep in milliseconds. Default is `20` (50Hz).
   *
   * This is intended for future use in a fixed-timestep physics or logic loop that runs
   * independently of the variable frame rate. Currently not actively used by the app's
   * update loop, but reserved for fixed-rate scheduling features.
   */
  fixedTimeStep = 20;

  /**
   * Whether system errors during update and fixed-update schedules should be thrown.
   *
   * - **`false`** (default) — errors are caught, logged, and passed to {@link onSystemError}.
   *   The app continues running.
   * - **`true`** — errors are re-thrown after logging, halting the app.
   *
   * Startup schedules (`PreStartup`, `Startup`, `PostStartup`) always throw on error,
   * regardless of this setting.
   */
  throwOnSystemError = false;

  /**
   * A callback invoked whenever a system throws an error.
   *
   * Use this for custom error reporting, analytics, or telemetry. The error is logged
   * by the app's logger regardless of this callback.
   *
   * Defaults to {@link noop} (no-op).
   *
   * @param error - The error thrown by the system.
   *
   * @example
   * ```ts
   * config.onSystemError = (error) => {
   *   console.error("System error:", error);
   *   // send to error tracking service
   * };
   * ```
   */
  onSystemError: (error: unknown) => void = noop;

  /**
   * The execution mode of the app, affecting logging verbosity and conditional system execution.
   *
   * - **{@link AppMode.Debug}** — enables verbose logging (`LogLevel.Debug`).
   * - **{@link AppMode.Dev}** — enables informational logging (`LogLevel.Info`).
   * - **{@link AppMode.Prod}** (default) — disables logging (`LogLevel.Silent`).
   *
   * Systems can be configured to only run in specific modes using the `.modes(...)` method.
   */
  mode: AppMode = AppMode.Prod;

  /**
   * An optional custom {@link Logger} instance for app-level logging.
   *
   * If not provided, the {@link App} constructor will create a default logger based on
   * the {@link mode} setting. You can supply your own logger to customize log formatting,
   * output destinations, or filtering.
   */
  logger?: Logger;
}

/**
 * The central orchestrator of the ECS (Entity Component System) application.
 *
 * `App` manages the full lifecycle of an ECS application: registering plugins, systems,
 * resources, and events during configuration, then running startup schedules and entering
 * the main update loop. It coordinates the {@link World}, {@link Time}, {@link Triggerer},
 * and all registered systems across their designated {@link Schedule}s.
 *
 * An `App` follows a strict lifecycle:
 * 1. **Configuration** — Add plugins, systems, resources, and events.
 * 2. **Run** — Call {@link App.run} to resolve system arguments, execute startup schedules,
 *    and begin the update loop.
 * 3. **Destroy** — Call {@link App.destroy} to run the `Destroy` schedule and tear down all state.
 *
 * Once destroyed, an `App` cannot be run again. Attempting to add plugins, systems, resources,
 * or events after the app has started or been destroyed will log a warning and no-op.
 *
 * @example
 * ```ts
 * const app = App.WithDefaults()
 *   .addPlugins(myPlugin)
 *   .addSystems(Schedule.Update, movementSystem, renderSystem)
 *   .addEvents(CollisionEvent)
 *   .run();
 * ```
 */
export class App {
  /**
   * A built-in plugin that registers the core resources ({@link Time}, {@link Triggerer},
   * {@link World}, `Input`) and the essential systems for relationships, input setup,
   * input updating, and input teardown across the appropriate schedules.
   */
  static defaultsPlugin = Plugin("CoreDefaults", (app: App) => {
    app.addResources(Time, Triggerer, World, Input);
    app.addSystems(Schedule.PreStartup, relationshipSystem, inputSystemSetup);
    app.addSystems(Schedule.PreUpdate, inputSystemUpdate);
    app.addSystems(Schedule.Destroy, inputSystemDestroy);
  });

  /**
   * Creates a new `App` with the {@link App.defaultsPlugin} already applied.
   *
   * This is the recommended way to create an `App` instance for most use cases, as it
   * ensures the core resources (`Time`, `Triggerer`, `World`, `Input`) and essential
   * systems are registered automatically.
   *
   * @param config - An optional {@link Configuration} instance or constructor to customize
   *   app behavior (time step, logging, error handling, etc.).
   * @returns A new `App` with default plugins applied, ready for further configuration.
   */
  static WithDefaults(
    config?: Configuration | ConstructorOf<Configuration>,
  ): App {
    return new App(config).addPlugins(App.defaultsPlugin);
  }

  #providedSystems = new AutoMap<Schedule, Set<System>>(() => new Set());
  #systems = new AutoMap<
    Schedule,
    Set<{ args: any[]; callback: any; name: string }>
  >(() => new Set());
  #events = new Map<Event, EventQueue<any>>();
  #started = false;
  #destroyed = false;
  #resources = new ResourceManager();
  #config: Configuration;

  /**
   * Creates a new `App` instance.
   *
   * Initializes the app's {@link Configuration} and sets up the logger based on the
   * configured {@link AppMode}:
   * - `Debug` → `LogLevel.Debug`
   * - `Dev` → `LogLevel.Info`
   * - `Prod` → `LogLevel.Silent`
   *
   * @param config - A {@link Configuration} instance or a constructor for one.
   *   Defaults to a new `Configuration` with production-mode settings.
   */
  constructor(
    config: Configuration | ConstructorOf<Configuration> = new Configuration(),
  ) {
    this.#config = isConstructor(config) ? new config() : config;

    // init logger using AppMode
    if (!this.#config.logger) {
      this.#config.logger = new Logger(
        "app",
        this.#config.mode === AppMode.Debug
          ? LogLevel.Debug
          : this.#config.mode === AppMode.Dev
            ? LogLevel.Info
            : LogLevel.Silent,
        logColors.purple,
      );
    }
  }

  /**
   * Registers one or more {@link Plugin}s with the app.
   *
   * Each plugin is a function that receives this `App` instance and may call any
   * configuration methods (e.g. `addSystems`, `addResources`, `addEvents`) to extend
   * the app. Plugins are invoked immediately in the order provided.
   *
   * No-ops with a warning if the app has already been started or destroyed.
   *
   * @param plugins - The plugins to register.
   * @returns This `App` instance for chaining.
   */
  addPlugins(...plugins: Plugin[]): App {
    if (this.#started || this.#destroyed) {
      this.#logger.warn(
        "Attempted to add a plugin to App, which is either running or destroyed",
      );
      return this;
    }
    plugins.forEach((it) => {
      this.#logger.info(`Registering plugin ${it[pluginName] ?? "AnonPlugin"}`);
      it(this);
    });
    return this;
  }

  /**
   * Registers one or more {@link System}s to run on a given {@link Schedule}.
   *
   * Systems are the primary unit of logic in the ECS. Each system declares its
   * dependencies (queries, resources, event readers/writers) and a callback that
   * operates on them. Systems are executed in registration order within their schedule.
   *
   * A system may be skipped if its configured {@link AppMode} modes include the current
   * app mode. If a system has enforced schedules and the target schedule is not among
   * them, an error is thrown.
   *
   * No-ops with a warning if the app has already been started or destroyed.
   *
   * @param schedule - The schedule during which the systems should execute.
   * @param systems - The systems to register for that schedule.
   * @returns This `App` instance for chaining.
   * @throws If a system's enforced schedules do not include the target schedule.
   */
  addSystems(schedule: Schedule, ...systems: ReturnType<typeof System>[]): App {
    if (this.#started || this.#destroyed) {
      this.#logger.warn(
        "Attempted to add a system to App, which is either running or destroyed",
      );
      return this;
    }

    for (const system of systems) {
      if (
        system.options.modes &&
        system.options.modes.includes(this.#config.mode)
      ) {
        continue;
      }

      const enforces = system.options.enforceSchedules;
      if (!enforces || enforces.includes(schedule)) {
        this.#logger.info(`Registering system ${system.name}`);
        this.#providedSystems.get(schedule).add(system);
      } else if (enforces.length > 0) {
        throw new Error(
          `System ${system.name} cannot be added to schedule ${schedule} due to enforced schedules: [${enforces.join(", ")}]`,
        );
      }
    }

    return this;
  }

  /**
   * Registers one or more resource types with the app.
   *
   * Resources are singleton objects that are instantiated once and injected into systems
   * as arguments. They are ideal for global state such as timers, input managers, or
   * configuration objects.
   *
   * No-ops with a warning if the app has already been started or destroyed.
   *
   * @param resources - Constructors for the resource classes to register.
   * @returns This `App` instance for chaining.
   */
  addResources(...resources: ConstructorOf<Object>[]): App {
    if (this.#started || this.#destroyed) {
      this.#logger.warn(
        "Attempted to add a resource to App, which is either running or destroyed",
      );
      return this;
    }
    for (const r of resources) {
      this.#logger.info(`Registering resource ${r.name}`);
      this.#resources.add(r);
    }
    return this;
  }

  /**
   * Registers one or more event types with the app.
   *
   * Each event type gets a backing {@link EventQueue} that supports double-buffered
   * read/write semantics. Systems can declare {@link EventReader} or {@link EventWriter}
   * arguments to consume or produce events of these types. Event queues are automatically
   * swapped at the end of each update frame during the `EventUpdate` schedule.
   *
   * Duplicate registrations are ignored with a warning.
   * No-ops with a warning if the app has already been started or destroyed.
   *
   * @param events - The event type identifiers to register.
   * @returns This `App` instance for chaining.
   */
  addEvents(...events: Event<any>[]): App {
    if (this.#started || this.#destroyed) {
      this.#logger.warn(
        "Attempted to add an event to App, which is either running or destroyed",
      );
      return this;
    }
    for (const e of events) {
      if (!this.#events.has(e)) {
        this.#logger.info(`Registering event ${e}`);
        this.#events.set(e, new EventQueue());
      } else {
        this.#logger.warn(
          `Attempted to add an event (${e}) which was already added`,
        );
      }
    }
    return this;
  }

  /**
   * Starts the application.
   *
   * This method transitions the app from the configuration phase to the running phase:
   *
   * 1. **Validates** that required resources (`Configuration`, `Time`, `Triggerer`, `World`)
   *    exist and are properly instantiated.
   * 2. **Resolves** all registered systems' arguments (queries, resources, event readers/writers)
   *    by calling {@link App.createSystemInput} for each system.
   * 3. **Executes startup schedules** in order: `PreStartup` → `Startup` → `PostStartup`.
   *    If any startup system throws, the `StartupError` schedule is run and the error
   *    is re-thrown.
   * 4. **Begins the update loop** via `setTimeout` (deferred to the next tick), which
   *    repeatedly runs `PreUpdate` → `Update` → `PostUpdate` → `WorldFlush` → `EventUpdate`
   *    on each frame.
   *
   * @returns This `App` instance for chaining.
   * @throws If the app was previously destroyed, or if required resources are missing.
   */
  run(): App {
    if (this.#started) {
      this.#logger.warn("Attempted to run an app which is already running");
      return this;
    }

    if (this.#destroyed) {
      throw Error("Attempted to run an app when it was previously destroyed");
    }

    assertInstanceOf(
      this.#config,
      Configuration,
      `Configuration resource must exist and be instanceof Configuration`,
    );

    assertInstanceOf(
      this.#resources.get(Time),
      Time,
      `Time resource must exist and be instanceof Time`,
    );

    const triggerer = this.#resources.get(Triggerer);
    assertInstanceOf(
      triggerer,
      Triggerer,
      `Triggerer resource must exist and be instanceof Triggerer`,
    );

    const world = this.#resources.get(World);
    assertInstanceOf(
      world,
      World,
      `World resource must exist and be instanceof World`,
    );

    world.triggerer = triggerer;

    const logger = this.#logger;

    this.#started = true;
    logger.debug("Started app");

    try {
      for (const [schedule, systems] of this.#providedSystems) {
        for (const system of systems) {
          this.#systems.get(schedule).add({
            args: this.createSystemInput(system),
            callback: system.callback,
            name: system.name,
          });
        }
      }

      this.#runSystems(Schedule.PreStartup, {
        throwOnError: true,
        errorPrefix: "pre startup system",
      });

      this.#runSystems(Schedule.Startup, {
        throwOnError: true,
        errorPrefix: "startup system",
      });

      this.#runSystems(Schedule.PostStartup, {
        throwOnError: true,
        errorPrefix: "post startup system",
      });
    } catch (error) {
      this.#runSystems(Schedule.StartupError);
      throw error;
    }

    setTimeout(this.#update, 0);

    logger.success("App successfully started!");

    return this;
  }

  /**
   * Tears down the application and releases all resources.
   *
   * Runs the `Destroy` schedule to allow systems to clean up, then clears all internal
   * state: systems, provided systems, events, and resources. After destruction, the app
   * is marked as destroyed and cannot be run again.
   *
   * Logs a warning if called on an app that was never started.
   */
  destroy() {
    if (!this.#started) {
      this.#logger.warn(
        `Attempted to destroy an app which was not started. This may not be intended behavior.`,
      );
    }

    this.#runSystems(Schedule.Destroy);

    this.#systems = new AutoMap<
      Schedule,
      Set<{ args: any[]; callback: any; name: string }>
    >(() => new Set());

    this.#providedSystems = new AutoMap<Schedule, Set<System>>(() => new Set());

    this.#events.clear();
    this.#resources = new ResourceManager();

    this.#started = false;
    this.#destroyed = true;
    this.#logger.debug(`Destroyed app ${this}`);
  }

  /**
   * Resolves the declared arguments of a {@link System} into concrete runtime values.
   *
   * For each argument in the system's `args` array, this method determines the argument
   * type and resolves it:
   * - **Query** (tagged with `queryTag`) → a new {@link QueryIterator} bound to the {@link World}.
   * - **EventReader** (tagged with `eventReaderTag`) → a reader from the event's {@link EventQueue}.
   * - **EventWriter** (tagged with `eventWriterTag`) → a writer from the event's {@link EventQueue}.
   * - **Resource** (constructor) → the singleton instance from the {@link ResourceManager}.
   *
   * @param system - The system whose arguments should be resolved.
   * @returns An array of resolved argument values, in the same order as the system's `args`.
   * @throws If a resource argument cannot be found, or if an event type is not registered.
   */
  createSystemInput(system: System) {
    const result = [];

    const world = mustExist(
      <World>this.#resources.get(World),
      "World does not exist as Resource",
    );

    for (const arg of system.args) {
      if (queryTag in arg) {
        result.push(new QueryIterator(world, arg));
      } else if (eventReaderTag in arg) {
        result.push(this.#getEventQueue(arg.event, system).getReader());
      } else if (eventWriterTag in arg) {
        result.push(this.#getEventQueue(arg.event, system).getWriter());
      } else {
        const res = this.#resources.get(arg);
        if (!res) {
          throw Error(
            `Could not resolve argument ${arg.name} for system ${system.name}.`,
          );
        }
        result.push(res);
      }
    }

    this.#logger.debug(
      `created arguments for system ${system.name}: ${result}`,
    );
    return result;
  }

  get #logger() {
    return this.#config.logger!;
  }

  #update = () => {
    if (this.#destroyed) {
      return;
    }

    const logger = this.#logger;

    if (this.#config.timeStep === 0) {
      requestAnimationFrame(this.#update);
    } else {
      setTimeout(this.#update, this.#config.timeStep);
    }

    // capture time
    const time = this.#resources.get(Time)!;
    time.capture();

    logger.debug(`running preupdate schedule`);
    this.#runSystems(Schedule.PreUpdate);
    logger.debug(`running update schedule`);
    this.#runSystems(Schedule.Update);
    logger.debug(`running postupdate schedule`);
    this.#runSystems(Schedule.PostUpdate);

    // flush world (remove queued components and entities)
    const world = <World>this.#resources.get(World)!;
    logger.debug("flushing world");
    this.#runSystems(Schedule.WorldFlush);
    world.flush();
    world.tick();

    // update event queues
    logger.debug("updating event queues");
    this.#runSystems(Schedule.EventUpdate);
    for (const queue of this.#events.values()) {
      queue.update();
    }
  };

  #runSystems(
    schedule: Schedule,
    options: { throwOnError?: boolean; errorPrefix?: string } = {},
  ) {
    const logger = this.#logger;
    const shouldThrow = options.throwOnError ?? this.#config.throwOnSystemError;
    const errorPrefix = options.errorPrefix ?? "system";

    for (const s of this.#systems.get(schedule)) {
      logger.debug("running system:", s.name);
      try {
        s.callback.apply(null, s.args);
      } catch (error) {
        this.#config.onSystemError(error);
        logger.critical(`Error in ${errorPrefix} ${s.name}: ${error}`);
        if (shouldThrow) {
          throw error;
        }
      }
    }
  }

  #getEventQueue(event: Event, system: System) {
    const queue = this.#events.get(event);
    if (!queue) {
      throw Error(
        `Event type ${event} is not registered but is depended on by system ${system.name}`,
      );
    }
    return queue;
  }
}

// F_relationship
/* d8888b. d88888b db      */
/* 88  `8D 88'     88      */
/* 88oobY' 88ooooo 88      */
/* 88`8b   88~~~~~ 88      */
/* 88 `88. 88.     88booo. */
/* 88   YD Y88888P Y88888P */

/**
 * A component for managing hierarchical parent-child relationships between entities.
 *
 * The `Relationship` component enables you to build entity hierarchies (scene graphs)
 * where entities can have a single parent and multiple children. This is useful for
 * implementing transform hierarchies, UI layouts, or any other tree-structured data.
 *
 * ### Usage
 * Use the static methods {@link Parent} and {@link Unparent} to establish and remove
 * parent-child relationships. Access the current parent via the `.parent` getter, and
 * iterate over children via the `.children` getter (a readonly `Set`).
 *
 * @example
 * ```ts
 * const world = new World();
 * const parentEntity = world.spawn();
 * const childEntity = world.spawn();
 *
 * // Establish a parent-child relationship
 * Relationship.Parent(world, parentEntity, childEntity);
 *
 * // Access the relationship
 * const rel = world.get(childEntity, Relationship);
 * console.log(rel.parent); // parentEntity
 *
 * const parentRel = world.get(parentEntity, Relationship);
 * for (const child of parentRel.children) {
 *   console.log(child); // childEntity
 * }
 *
 * // Remove the relationship
 * Relationship.Unparent(world, parentEntity, childEntity);
 * ```
 */
export class Relationship {
  /**
   * Establishes a parent-child relationship between two entities.
   *
   * If either entity does not have a `Relationship` component, one is automatically
   * created and inserted. If the child already has a parent, it is first unparented
   * from the old parent before being reparented to the new one.
   *
   * This method performs circular relationship detection by walking up the parent chain
   * from the proposed parent. If the child is found in that chain, a circular relationship
   * would be created, and an error is thrown.
   *
   * @param world - The {@link World} containing the parent and child entities.
   * @param parent - The {@link EntityID} of the parent entity.
   * @param child - The {@link EntityID} of the child entity.
   * @throws If either `parent` or `child` does not exist in the world.
   * @throws If establishing the relationship would create a cycle (circular reference).
   *
   * @example
   * ```ts
   * const world = new World();
   * const root = world.spawn();
   * const node = world.spawn();
   * Relationship.Parent(world, root, node);
   * ```
   */
  static Parent(world: World, parent: EntityID, child: EntityID) {
    if (!world.exists(parent) || !world.exists(child)) {
      throw Error(
        `Cannot parent ${parent} to ${child}. One or both does not exist.`,
      );
    }

    let parentRelationship = world.tryGetMut(parent, Relationship);

    if (!parentRelationship) {
      parentRelationship = new Relationship();
      world.insert(parent, parentRelationship);
    } else {
      // check for circular relationships
      let currentParent: EntityID | null = parent;
      while (currentParent) {
        if (currentParent === child) {
          throw Error("Detected a circular relationship while parenting");
        }
        const currentRelationship: Relationship | null = world.tryGetMut(
          currentParent,
          Relationship,
        );
        currentParent = currentRelationship?._parent ?? null;
      }
    }

    let childRelationship = world.tryGetMut(child, Relationship);
    if (!childRelationship) {
      childRelationship = new Relationship();
      world.insert(child, childRelationship);
    }

    let oldParent = childRelationship._parent;
    if (oldParent) {
      Relationship.Unparent(world, oldParent, child);
    }

    parentRelationship._children ??= new Set<EntityID>();
    parentRelationship._children.add(child);
    childRelationship._parent = parent;
  }

  /**
   * Removes a parent-child relationship between two entities.
   *
   * If the child's parent is the specified `parent`, the child's parent reference is
   * cleared (`null`). The child is also removed from the parent's children set.
   *
   * If either entity does not exist, or if either entity lacks a `Relationship` component,
   * the method returns early without throwing.
   *
   * @param world - The {@link World} containing the parent and child entities.
   * @param parent - The {@link EntityID} of the parent entity.
   * @param child - The {@link EntityID} of the child entity.
   * @throws If either `parent` or `child` does not exist in the world.
   *
   * @example
   * ```ts
   * Relationship.Unparent(world, parentEntity, childEntity);
   * ```
   */
  static Unparent(
    world: World,
    parent: EntityID,
    child: EntityID,
  ): undefined | Error {
    if (!world.exists(parent) || !world.exists(child)) {
      throw Error(
        `Cannot unparent ${parent} to ${child}. One or both does not exist.`,
      );
    }
    let childRelationship = world.tryGetMut(child, Relationship);
    if (!childRelationship) {
      return;
    }
    let parentRelationship = world.tryGetMut(parent, Relationship);
    if (!parentRelationship) {
      return;
    }
    if (childRelationship.parent === parent) {
      childRelationship._parent = null;
    }
    parentRelationship._children?.delete(child);
  }

  /**
   * Gets the parent entity ID of this entity, or `null` if it has no parent.
   *
   * @returns The parent {@link EntityID}, or `null` if unparented.
   */
  get parent(): EntityID | null {
    return this._parent;
  }

  /**
   * Gets a readonly view of the children of this entity.
   *
   * The returned set cannot be modified directly — use {@link Parent} and {@link Unparent}
   * to modify relationships. If the entity has no children, an empty readonly set is returned.
   *
   * @returns A readonly `Set` containing the {@link EntityID}s of all child entities.
   */
  get children(): ChildSet {
    return this._children ?? <ChildSet>EMPTY_SET;
  }

  /** @internal The parent entity ID, or `null` if this entity has no parent. */
  protected _parent: EntityID | null = null;

  /** @internal The set of child entity IDs, or `undefined` if there are no children. */
  protected _children?: Set<EntityID>;
}

type ChildSet = Omit<Set<EntityID>, "add" | "delete" | "clear">;
const EMPTY_SET: Set<any> = new Set();

const relationshipSystem = System(
  "RelationshipSystem",
  [World, Triggerer],
  (w, t) => {
    t.addResponder(
      [ComponentRemovalScheduled, Entity, Relationship],
      (_, entity, rel) => {
        if (rel.parent) {
          Relationship.Unparent(w, rel.parent, entity);
        }
        for (const child of rel.children) {
          Relationship.Unparent(w, entity, child);
        }
      },
    );

    t.addResponder(
      [EntityDespawnScheduled, Entity, Relationship],
      (_, entity, rel) => {
        if (rel.parent) {
          Relationship.Unparent(w, rel.parent, entity);
        }
        for (const child of rel.children) {
          w.despawn(child);
        }
      },
    );
  },
);

/**
 * Unified input manager for keyboard, mouse, and gamepad state.
 *
 * Provides a polling-based API for querying the current state of input devices each frame.
 * Tracks pressed/just-pressed/just-released states for keys, mouse buttons, and gamepad buttons,
 * as well as mouse position, velocity, acceleration, scroll wheel, and gamepad analog sticks.
 */
export class Input {
  /** @internal */
  _internal = {
    connected: false,
    keyCodeValues: new Set(KeyCodeRegistry.keys()),

    keysDown: new Set<KeyCode>(),
    keysPressed: new Set<KeyCode>(),
    keysReleased: new Set<KeyCode>(),
    pendingKeysPressed: new Set<KeyCode>(),
    pendingKeysReleased: new Set<KeyCode>(),

    mouseDown: new Set<MouseCode>(),
    mousePressed: new Set<MouseCode>(),
    mouseReleased: new Set<MouseCode>(),
    pendingMousePressed: new Set<MouseCode>(),
    pendingMouseReleased: new Set<MouseCode>(),

    mouseX: 0,
    mouseY: 0,
    prevMouseX: 0,
    prevMouseY: 0,

    mouseDeltaX: 0,
    mouseDeltaY: 0,
    mouseVelocityX: 0,
    mouseVelocityY: 0,
    mouseAccelX: 0,
    mouseAccelY: 0,
    prevMouseVelocityX: 0,
    prevMouseVelocityY: 0,

    wheelX: 0,
    wheelY: 0,
    wheelZ: 0,
    pendingWheelX: 0,
    pendingWheelY: 0,
    pendingWheelZ: 0,

    pendingMovementX: 0,
    pendingMovementY: 0,
    pointerLocked: false,

    gamepadDeadzone: 0.15,
    gamepads: new Map<
      number,
      {
        connected: boolean;
        id: string;
        mapping: string;
        buttonsDown: Set<number>;
        buttonsPressed: Set<number>;
        buttonsReleased: Set<number>;
        pendingButtonsPressed: Set<number>;
        pendingButtonsReleased: Set<number>;
        axes: number[];
        prevAxes: number[];
        axesDelta: number[];
      }
    >(),

    dispose: [] as Array<() => void>,
  };

  /** The current X position of the mouse cursor (in screen coordinates). */
  get mouseX() {
    return this._internal.mouseX;
  }

  /** The current Y position of the mouse cursor (in screen coordinates). */
  get mouseY() {
    return this._internal.mouseY;
  }

  /** The change in mouse X position since the last frame. */
  get mouseDeltaX() {
    return this._internal.mouseDeltaX;
  }

  /** The change in mouse Y position since the last frame. */
  get mouseDeltaY() {
    return this._internal.mouseDeltaY;
  }

  /** The current velocity of the mouse along the X axis. */
  get mouseVelocityX() {
    return this._internal.mouseVelocityX;
  }

  /** The current velocity of the mouse along the Y axis. */
  get mouseVelocityY() {
    return this._internal.mouseVelocityY;
  }

  /** The current acceleration of the mouse along the X axis (change in velocity). */
  get mouseAccelX() {
    return this._internal.mouseAccelX;
  }

  /** The current acceleration of the mouse along the Y axis (change in velocity). */
  get mouseAccelY() {
    return this._internal.mouseAccelY;
  }

  /** The horizontal scroll wheel delta for the current frame. */
  get mouseWheelX() {
    return this._internal.wheelX;
  }

  /** The vertical scroll wheel delta for the current frame. */
  get mouseWheelY() {
    return this._internal.wheelY;
  }

  /** The Z-axis (depth) scroll wheel delta for the current frame. */
  get mouseWheelZ() {
    return this._internal.wheelZ;
  }

  /** Whether the pointer is currently locked (via the Pointer Lock API). */
  get pointerLocked() {
    return this._internal.pointerLocked;
  }

  /**
   * Returns `true` if the given key, mouse button, or gamepad button is currently held down.
   * @param code - The input code to check ({@link KeyCode}, {@link MouseCode}, or {@link GamepadButton}).
   */
  pressed(code: KeyCode | MouseCode | GamepadButton) {
    if (code instanceof KeyCode) {
      return this._internal.keysDown.has(code);
    }
    if (code instanceof MouseCode) {
      return this._internal.mouseDown.has(code);
    }
    const state = this._internal.gamepads.get(code.gamepadIndex);
    return !!state?.connected && state.buttonsDown.has(code.buttonIndex);
  }

  /**
   * Returns `true` if the given key, mouse button, or gamepad button was pressed this frame
   * (i.e. transitioned from up to down).
   * @param code - The input code to check ({@link KeyCode}, {@link MouseCode}, or {@link GamepadButton}).
   */
  justPressed(code: KeyCode | MouseCode | GamepadButton) {
    if (code instanceof KeyCode) {
      return this._internal.keysPressed.has(code);
    }
    if (code instanceof MouseCode) {
      return this._internal.mousePressed.has(code);
    }
    const state = this._internal.gamepads.get(code.gamepadIndex);
    return !!state?.connected && state.buttonsPressed.has(code.buttonIndex);
  }

  /**
   * Returns `true` if the given key, mouse button, or gamepad button was released this frame
   * (i.e. transitioned from down to up).
   * @param code - The input code to check ({@link KeyCode}, {@link MouseCode}, or {@link GamepadButton}).
   */
  justReleased(code: KeyCode | MouseCode | GamepadButton) {
    if (code instanceof KeyCode) {
      return this._internal.keysReleased.has(code);
    }
    if (code instanceof MouseCode) {
      return this._internal.mouseReleased.has(code);
    }
    const state = this._internal.gamepads.get(code.gamepadIndex);
    return !!state?.connected && state.buttonsReleased.has(code.buttonIndex);
  }

  /**
   * Returns `true` if a gamepad at the given index is currently connected.
   * @param index - The gamepad index (defaults to `0` for the first gamepad).
   */
  gamepadConnected(index = 0) {
    return !!this._internal.gamepads.get(index)?.connected;
  }

  /**
   * Returns the identifier string of the connected gamepad, or `null` if not connected.
   * @param index - The gamepad index (defaults to `0` for the first gamepad).
   */
  gamepadId(index = 0) {
    const state = this._internal.gamepads.get(index);
    return state?.connected ? state.id : null;
  }

  /**
   * Returns the current value of a gamepad axis (typically in the range `[-1, 1]`).
   * Returns `0` if the gamepad is not connected or the axis does not exist.
   * @param index - The gamepad index.
   * @param axis - The axis index (e.g. `0` = left stick X, `1` = left stick Y, `2` = right stick X, `3` = right stick Y).
   */
  gamepadAxis(index: number, axis: number) {
    const state = this._internal.gamepads.get(index);
    return state?.axes[axis] ?? 0;
  }

  /**
   * Returns the change in a gamepad axis value since the last frame.
   * Returns `0` if the gamepad is not connected or the axis does not exist.
   * @param index - The gamepad index.
   * @param axis - The axis index.
   */
  gamepadAxisDelta(index: number, axis: number) {
    const state = this._internal.gamepads.get(index);
    return state?.axesDelta[axis] ?? 0;
  }

  /**
   * Returns the left analog stick position as an `{ x, y }` object (axes 0 and 1).
   * Values are typically in the range `[-1, 1]`.
   * @param index - The gamepad index (defaults to `0`).
   */
  leftStick(index = 0) {
    return {
      x: this.gamepadAxis(index, 0),
      y: this.gamepadAxis(index, 1),
    };
  }

  /**
   * Returns the right analog stick position as an `{ x, y }` object (axes 2 and 3).
   * Values are typically in the range `[-1, 1]`.
   * @param index - The gamepad index (defaults to `0`).
   */
  rightStick(index = 0) {
    return {
      x: this.gamepadAxis(index, 2),
      y: this.gamepadAxis(index, 3),
    };
  }
}

export const inputSystemSetup = System("InputSystemSetup", [Input], (input) => {
  const internal = input._internal;
  if (internal.connected) return;
  if (typeof window === "undefined" || typeof document === "undefined") return;

  internal.connected = true;
  internal.pointerLocked = !!document.pointerLockElement;

  const add = (
    target: EventTarget,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ) => {
    target.addEventListener(type, handler, options);
    internal.dispose.push(() =>
      target.removeEventListener(type, handler, options),
    );
  };

  const onPointerLockChange = () => {
    internal.pointerLocked = !!document.pointerLockElement;
  };

  const onKeyDown = (ev: KeyboardEvent) => {
    if (!internal.keyCodeValues.has(ev.code)) return;
    const code = KeyCodeRegistry.get(ev.code);
    if (!code) return;
    if (!internal.keysDown.has(code)) {
      internal.keysDown.add(code);
      internal.pendingKeysPressed.add(code);
    }
  };

  const onKeyUp = (ev: KeyboardEvent) => {
    if (!internal.keyCodeValues.has(ev.code)) return;
    const code = KeyCodeRegistry.get(ev.code);
    if (!code) return;
    if (internal.keysDown.delete(code)) {
      internal.pendingKeysReleased.add(code);
    }
  };

  const onMouseDown = (ev: MouseEvent) => {
    const button = MouseCodeRegistry.get(ev.button);
    if (!button) return;
    if (!internal.mouseDown.has(button)) {
      internal.mouseDown.add(button);
      internal.pendingMousePressed.add(button);
    }
  };

  const onMouseUp = (ev: MouseEvent) => {
    const button = MouseCodeRegistry.get(ev.button);
    if (!button) return;
    if (internal.mouseDown.delete(button)) {
      internal.pendingMouseReleased.add(button);
    }
  };

  const onMouseMove = (ev: MouseEvent) => {
    internal.mouseX = ev.clientX;
    internal.mouseY = ev.clientY;
    internal.pendingMovementX += ev.movementX ?? 0;
    internal.pendingMovementY += ev.movementY ?? 0;
  };

  const onWheel = (ev: WheelEvent) => {
    internal.pendingWheelX += ev.deltaX;
    internal.pendingWheelY += ev.deltaY;
    internal.pendingWheelZ += ev.deltaZ;
  };

  const onGamepadConnected = (ev: GamepadEvent) => {
    const pad = ev.gamepad;
    let state = internal.gamepads.get(pad.index);
    if (!state) {
      state = {
        connected: true,
        id: pad.id ?? "",
        mapping: pad.mapping ?? "",
        buttonsDown: new Set<number>(),
        buttonsPressed: new Set<number>(),
        buttonsReleased: new Set<number>(),
        pendingButtonsPressed: new Set<number>(),
        pendingButtonsReleased: new Set<number>(),
        axes: [],
        prevAxes: [],
        axesDelta: [],
      };
      internal.gamepads.set(pad.index, state);
    }
    state.connected = true;
    state.id = pad.id ?? "";
    state.mapping = pad.mapping ?? "";
  };

  const onGamepadDisconnected = (ev: GamepadEvent) => {
    const pad = ev.gamepad;
    const state = internal.gamepads.get(pad.index);
    if (!state) return;
    state.connected = false;
    state.buttonsDown.clear();
    state.buttonsPressed.clear();
    state.buttonsReleased.clear();
    state.pendingButtonsPressed.clear();
    state.pendingButtonsReleased.clear();
    state.axes.length = 0;
    state.prevAxes.length = 0;
    state.axesDelta.length = 0;
  };

  const onBlur = () => {
    internal.keysDown.clear();
    internal.mouseDown.clear();

    internal.keysPressed.clear();
    internal.keysReleased.clear();
    internal.mousePressed.clear();
    internal.mouseReleased.clear();

    internal.pendingKeysPressed.clear();
    internal.pendingKeysReleased.clear();
    internal.pendingMousePressed.clear();
    internal.pendingMouseReleased.clear();

    internal.pendingWheelX = 0;
    internal.pendingWheelY = 0;
    internal.pendingWheelZ = 0;
    internal.pendingMovementX = 0;
    internal.pendingMovementY = 0;

    for (const state of internal.gamepads.values()) {
      state.buttonsDown.clear();
      state.buttonsPressed.clear();
      state.buttonsReleased.clear();
      state.pendingButtonsPressed.clear();
      state.pendingButtonsReleased.clear();
      state.axes.length = 0;
      state.prevAxes.length = 0;
      state.axesDelta.length = 0;
    }
  };

  add(window, "keydown", onKeyDown);
  add(window, "keyup", onKeyUp);
  add(window, "blur", onBlur);
  add(window, "gamepadconnected", onGamepadConnected);
  add(window, "gamepaddisconnected", onGamepadDisconnected);

  add(window, "mousedown", onMouseDown);
  add(window, "mouseup", onMouseUp);
  add(window, "mousemove", onMouseMove, { passive: true });
  add(window, "wheel", onWheel, { passive: true });

  add(document, "pointerlockchange", onPointerLockChange);
}).enforceSchedules(Schedule.PreStartup);

export const inputSystemUpdate = System(
  "InputSystemUpdate",
  [Input, Time],
  (input, { delta }) => {
    const internal = input._internal;
    const dt = Math.max(delta, 0.000001);

    const swapSets = <T>(from: Set<T>, to: Set<T>) => {
      to.clear();
      for (const v of from) to.add(v);
      from.clear();
    };

    const pads =
      typeof navigator !== "undefined" && navigator.getGamepads
        ? navigator.getGamepads()
        : [];

    const seen = new Set<number>();

    for (const pad of pads) {
      if (!pad) continue;
      seen.add(pad.index);

      let state = internal.gamepads.get(pad.index);
      if (!state) {
        state = {
          connected: true,
          id: pad.id ?? "",
          mapping: pad.mapping ?? "",
          buttonsDown: new Set<number>(),
          buttonsPressed: new Set<number>(),
          buttonsReleased: new Set<number>(),
          pendingButtonsPressed: new Set<number>(),
          pendingButtonsReleased: new Set<number>(),
          axes: [],
          prevAxes: [],
          axesDelta: [],
        };
        internal.gamepads.set(pad.index, state);
      }

      state.connected = pad.connected;
      state.id = pad.id ?? "";
      state.mapping = pad.mapping ?? "";

      for (let i = 0; i < pad.buttons.length; i++) {
        const btn = pad.buttons[i];
        const code = i;
        const isDown = !!btn?.pressed || (btn?.value ?? 0) > 0.5;
        const wasDown = state.buttonsDown.has(code);

        if (isDown && !wasDown) {
          state.pendingButtonsPressed.add(code);
        } else if (!isDown && wasDown) {
          state.pendingButtonsReleased.add(code);
        }

        if (isDown) {
          state.buttonsDown.add(code);
        } else {
          state.buttonsDown.delete(code);
        }
      }

      const deadzone = internal.gamepadDeadzone;
      for (let i = 0; i < pad.axes.length; i++) {
        const raw = pad.axes[i] ?? 0;
        const val = Math.abs(raw) < deadzone ? 0 : raw;
        const prev = state.prevAxes[i] ?? 0;
        state.axes[i] = val;
        state.axesDelta[i] = val - prev;
        state.prevAxes[i] = val;
      }
    }

    for (const [index, state] of internal.gamepads) {
      if (!seen.has(index) && state.connected) {
        state.connected = false;
        state.buttonsDown.clear();
        state.buttonsPressed.clear();
        state.buttonsReleased.clear();
        state.pendingButtonsPressed.clear();
        state.pendingButtonsReleased.clear();
        state.axes.length = 0;
        state.prevAxes.length = 0;
        state.axesDelta.length = 0;
      }
    }

    swapSets(internal.pendingKeysPressed, internal.keysPressed);
    swapSets(internal.pendingKeysReleased, internal.keysReleased);
    swapSets(internal.pendingMousePressed, internal.mousePressed);
    swapSets(internal.pendingMouseReleased, internal.mouseReleased);

    for (const state of internal.gamepads.values()) {
      swapSets(state.pendingButtonsPressed, state.buttonsPressed);
      swapSets(state.pendingButtonsReleased, state.buttonsReleased);
    }

    let dx = internal.mouseX - internal.prevMouseX;
    let dy = internal.mouseY - internal.prevMouseY;

    if (internal.pointerLocked) {
      dx = internal.pendingMovementX;
      dy = internal.pendingMovementY;
    }

    internal.mouseDeltaX = dx;
    internal.mouseDeltaY = dy;

    internal.mouseVelocityX = dx / dt;
    internal.mouseVelocityY = dy / dt;

    internal.mouseAccelX =
      (internal.mouseVelocityX - internal.prevMouseVelocityX) / dt;
    internal.mouseAccelY =
      (internal.mouseVelocityY - internal.prevMouseVelocityY) / dt;

    internal.prevMouseX = internal.mouseX;
    internal.prevMouseY = internal.mouseY;
    internal.prevMouseVelocityX = internal.mouseVelocityX;
    internal.prevMouseVelocityY = internal.mouseVelocityY;

    internal.pendingMovementX = 0;
    internal.pendingMovementY = 0;

    internal.wheelX = internal.pendingWheelX;
    internal.wheelY = internal.pendingWheelY;
    internal.wheelZ = internal.pendingWheelZ;

    internal.pendingWheelX = 0;
    internal.pendingWheelY = 0;
    internal.pendingWheelZ = 0;
  },
).enforceSchedules(Schedule.PreUpdate);

export const inputSystemDestroy = System(
  "InputSystemDestroy",
  [Input],
  (input) => {
    const internal = input._internal;
    for (const dispose of internal.dispose) dispose();
    internal.dispose.length = 0;
    internal.connected = false;

    internal.keysDown.clear();
    internal.mouseDown.clear();

    internal.keysPressed.clear();
    internal.keysReleased.clear();
    internal.mousePressed.clear();
    internal.mouseReleased.clear();

    internal.pendingKeysPressed.clear();
    internal.pendingKeysReleased.clear();
    internal.pendingMousePressed.clear();
    internal.pendingMouseReleased.clear();

    internal.pendingWheelX = 0;
    internal.pendingWheelY = 0;
    internal.pendingWheelZ = 0;
    internal.pendingMovementX = 0;
    internal.pendingMovementY = 0;

    for (const state of internal.gamepads.values()) {
      state.connected = false;
      state.buttonsDown.clear();
      state.buttonsPressed.clear();
      state.buttonsReleased.clear();
      state.pendingButtonsPressed.clear();
      state.pendingButtonsReleased.clear();
      state.axes.length = 0;
      state.prevAxes.length = 0;
      state.axesDelta.length = 0;
    }
  },
).enforceSchedules(Schedule.Destroy);
