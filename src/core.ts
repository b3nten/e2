/*         ,
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
                        `----`              fsc */

/*_,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,_

This module forms the core of Elysiatech. Documentation coming soon.

_,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,_*/

import {
  appLogger,
  assertInstanceOf,
  AutoMap,
  constructorOf,
  ConstructorOf,
  Immutable,
  InstanceOf,
  SparseSet,
} from "./lib.ts";

/* .d8888.  .o88b. db   db d88888b d8888b. db    db db      d88888b .d8888. */
/* 88'  YP d8P  Y8 88   88 88'     88  `8D 88    88 88      88'     88'  YP */
/* `8bo.   8P      88ooo88 88ooooo 88   88 88    88 88      88ooooo `8bo.   */
/*   `Y8b. 8b      88~~~88 88~~~~~ 88   88 88    88 88      88~~~~~   `Y8b. */
/* db   8D Y8b  d8 88   88 88.     88  .8D 88b  d88 88booo. 88.     db   8D */
/* `8888Y'  `Y88P' YP   YP Y88888P Y8888D' ~Y8888P' Y88888P Y88888P `8888Y' */

export enum Schedule {
  PreStartup,
  Startup,
  PostStartup,

  PreUpdate,
  Update,
  PostUpdate,

  Destroy,
}

/*  .o88b. db       .d88b.   .o88b. db   dD */
/* d8P  Y8 88      .8P  Y8. d8P  Y8 88 ,8P' */
/* 8P      88      88    88 8P      88,8P   */
/* 8b      88      88    88 8b      88`8b   */
/* Y8b  d8 88booo. `8b  d8' Y8b  d8 88 `88. */
/*  `Y88P' Y88888P  `Y88P'   `Y88P' YP   YD */

export class Clock {
  #started = false;
  #now = 0;
  #last = 0;
  #delta = 0.016;
  #elapsed = 0;

  get delta() {
    return this.#delta;
  }

  get elapsed() {
    return this.#elapsed;
  }

  capture() {
    if (!this.#started) {
      this.#started = true;
      this.#now = performance.now();
      this.#last = this.#now;
      return;
    }

    this.#now = performance.now();

    this.#delta = Math.max(
      0.00001,
      Math.min((this.#now - this.#last) / 1000, 0.06),
    );

    this.#elapsed += this.#delta;
    this.#last = this.#now;
  }
}

/*  .d8b.  .d8888. .d8888. d88888b d888888b */
/* d8' `8b 88'  YP 88'  YP 88'     `~~88~~' */
/* 88ooo88 `8bo.   `8bo.   88ooooo    88    */
/* 88~~~88   `Y8b.   `Y8b. 88~~~~~    88    */
/* 88   88 db   8D db   8D 88.        88    */
/* YP   YP `8888Y' `8888Y' Y88888P    YP    */

export class Handle<T> {
  constructor(asset: Asset<T>) {
    this.#asset = asset;
  }

  deref(): T | undefined {
    return (<any>this.#asset).data;
  }

  get initalized() {
    return this.#asset.initalized;
  }

  get errored() {
    return this.#asset.errored;
  }

  get loading() {
    return this.#asset.loading;
  }

  #asset: Asset<T>;
}

export abstract class Asset<T> {
  abstract initalizer(): Promise<T>;
  abstract destructor(value: T): void;

  private data: T | undefined;
  #error: unknown;
  #errored = false;
  #promise?: Promise<void>;

  get loading() {
    return this.data === undefined && this.#promise !== undefined;
  }

  get initalized() {
    return this.data !== undefined;
  }

  get errored() {
    return this.#errored;
  }

  get error() {
    return this.#error;
  }

  load() {
    if (!this.initalized && !this.#promise) {
      this.#promise = this.initalizer()
        .then((data) => {
          this.data = data;
        })
        .catch((error) => {
          this.#errored = true;
          this.#error = error;
        })
        .finally(() => {
          this.#promise = undefined;
        });
    }
  }

  destroy() {
    if (this.data !== undefined) {
      this.destructor(this.data);
      this.data = undefined;
      this.#errored = false;
      this.#error = undefined;
      this.#promise = undefined;
    } else if (this.#promise) {
      const promiseToCancel = this.#promise;
      this.#promise = undefined;
      promiseToCancel.then(() => {
        if (this.data !== undefined) {
          this.destructor(this.data);
          this.data = undefined;
        }
      });
    }
  }

  getHandle() {
    const handle = new Handle(this);
    return handle;
  }
}

/* d88888b db    db d88888b d8b   db d888888b .d8888. */
/* 88'     88    88 88'     888o  88 `~~88~~' 88'  YP */
/* 88ooooo Y8    8P 88ooooo 88V8o 88    88    `8bo.   */
/* 88~~~~~ `8b  d8' 88~~~~~ 88 V8o88    88      `Y8b. */
/* 88.      `8bd8'  88.     88  V888    88    db   8D */
/* Y88888P    YP    Y88888P VP   V8P    YP    `8888Y' */

export type Event<T = void> = string & {
  /** @internal @private */ typeof: T;
};

export function Event<T = void>(name: string) {
  return name as Event<T>;
}

export type EventData<T extends Event> = T["typeof"];

const eventWriterTag = Symbol.for("EventWriterTag");
export function EvWriter<T extends Event<any>>(event: T) {
  return { [eventWriterTag]: true, event };
}

const eventReaderTag = Symbol.for("EventReaderTag");
export function EvReader<T extends Event<any>>(event: T) {
  return { [eventReaderTag]: true, event };
}

export class EventReader<T extends Event> {
  #queue: WeakRef<EventQueue<T>>;
  #currentIndex = 0;
  #previousIndex = 0;

  constructor(queue: EventQueue<T>) {
    this.#queue = new WeakRef(queue);
  }

  get active() {
    return !!this.#queue.deref();
  }

  *[Symbol.iterator]() {
    const q = this.#queue.deref();
    if (!q) return;

    while (this.#previousIndex < q.previousBuffer.length) {
      yield q.previousBuffer[this.#previousIndex];
      this.#previousIndex++;
    }

    while (this.#currentIndex < q.currentBuffer.length) {
      yield q.currentBuffer[this.#currentIndex];
      this.#currentIndex++;
    }
  }

  length(): number {
    const q = this.#queue.deref();
    if (!q) return 0;

    const unreadPrevious = q.previousBuffer.length - this.#previousIndex;
    const unreadCurrent = q.currentBuffer.length - this.#currentIndex;
    return unreadPrevious + unreadCurrent;
  }

  /** @internal */
  resetForNewFrame() {
    this.#previousIndex = this.#currentIndex;
    this.#currentIndex = 0;
  }
}

export class EventWriter<T extends Event> {
  #queue: WeakRef<EventQueue<T>>;

  constructor(queue: EventQueue<T>) {
    this.#queue = new WeakRef(queue);
  }

  get active() {
    return !!this.#queue.deref();
  }

  write(payload: EventData<T>) {
    const q = this.#queue.deref();
    if (q) {
      q.currentBuffer.push(payload);
    }
  }
}

class EventQueue<T extends Event> {
  #currentBuffer: Array<T["typeof"]> = [];
  #previousBuffer: Array<T["typeof"]> = [];
  #readers = new Set<WeakRef<EventReader<T>>>();

  get currentBuffer() {
    return this.#currentBuffer;
  }

  get previousBuffer() {
    return this.#previousBuffer;
  }

  getReader(): EventReader<T> {
    const reader = new EventReader(this);
    this.#readers.add(new WeakRef(reader));
    return reader;
  }

  getWriter(): EventWriter<T> {
    return new EventWriter(this);
  }

  update() {
    for (const ref of this.#readers) {
      const reader = ref.deref();
      if (!reader) {
        this.#readers.delete(ref);
      } else {
        reader.resetForNewFrame();
      }
    }

    this.#previousBuffer = this.#currentBuffer;
    this.#currentBuffer = [];
  }
}

/*  .d88b.  db    db d88888b d8888b. db    db */
/* .8P  Y8. 88    88 88'     88  `8D `8b  d8' */
/* 88    88 88    88 88ooooo 88oobY'  `8bd8'  */
/* 88    88 88    88 88~~~~~ 88`8b      88    */
/* `8P  d8' 88b  d88 88.     88 `88.    88    */
/*  `Y88'Y8 ~Y8888P' Y88888P 88   YD    YP    */

type MutParam<T> = {
  mutComponent: T;
};

export function Mut<T>(value: T): MutParam<T> {
  return { mutComponent: value };
}

class MutRef<T> {
  constructor(world: World) {
    this.world = world;
  }

  deref(): T {
    // do change detection here
    return this.value;
  }

  get ref(): Immutable<T> {
    return <Immutable<T>>this.value;
  }

  private world!: World;
  private value!: T;
}

type QueryList = readonly (ConstructorOf<Object> | MutParam<any>)[];

const isQuery = Symbol.for("QueryTag");
export function Query<T extends QueryList>(...values: T) {
  // @ts-expect-error
  values[isQuery] = true;
  return values;
}

type InferQuery<T extends QueryList> = {
  [K in keyof T]: T[K] extends MutParam<infer U>
    ? MutRef<InstanceOf<U>>
    : T[K] extends ConstructorOf<Object>
      ? Immutable<InstanceOf<T[K]>>
      : never;
};

/* d888888b d8888b. d888888b  d888b   d888b  d88888b d8888b. */
/* `~~88~~' 88  `8D   `88'   88' Y8b 88' Y8b 88'     88  `8D */
/*    88    88oobY'    88    88      88      88ooooo 88oobY' */
/*    88    88`8b      88    88  ooo 88  ooo 88~~~~~ 88`8b   */
/*    88    88 `88.   .88.   88. ~8~ 88. ~8~ 88.     88 `88. */
/*    YP    88   YD Y888888P  Y888P   Y888P  Y88888P 88   YD */

type TriggerResponder<T extends readonly ConstructorOf<Object>[] = []> = (
  ...args: { [K in keyof T]: InstanceOf<T[K]> }
) => void;

type TriggererStorage = {
  children: Map<ConstructorOf<Object>, TriggererStorage>;
  responders: Set<TriggerResponder>;
};

export function Trigger<T extends readonly ConstructorOf<Object>[] = []>(
  types: [...T],
  callback: TriggerResponder<T>,
) {
  return { types, callback };
}

export class Triggerer {
  #storage: TriggererStorage = { responders: new Set(), children: new Map() };

  add<T extends readonly ConstructorOf<Object>[]>({
    types,
    callback,
  }: {
    types: [...T];
    callback: TriggerResponder<T>;
  }) {
    this.addResponder(types, callback);
  }

  addResponder<T extends readonly ConstructorOf<Object>[]>(
    types: [...T],
    callback: TriggerResponder<T>,
  ) {
    let current = this.#storage;
    for (const t of types) {
      if (!current.children.has(t)) {
        current.children.set(t, { responders: new Set(), children: new Map() });
      }
      current = current.children.get(t)!;
    }
    current.responders.add(callback);
    return () => current.responders.delete(callback);
  }

  deleteResponder<T extends readonly ConstructorOf<Object>[]>(
    types: [...T],
    callback: TriggerResponder<T>,
  ) {
    let current = this.#storage;
    for (const t of types) {
      if (!current.children.has(t)) {
        return;
      }
      current = current.children.get(t)!;
    }
    current.responders.delete(callback);
  }

  trigger(...payloads: Object[]) {
    let current = this.#storage;
    for (const _t of payloads) {
      const t = constructorOf(_t);
      const next = current.children.get(t);
      if (!next) return;
      current = next;
    }
    current.responders.forEach((it) =>
      (<(...payloads: Object[]) => void>it)(...payloads),
    );
  }
}

/* d88888b d8b   db d888888b d888888b d888888b db    db */
/* 88'     888o  88 `~~88~~'   `88'   `~~88~~' `8b  d8' */
/* 88ooooo 88V8o 88    88       88       88     `8bd8'  */
/* 88~~~~~ 88 V8o88    88       88       88       88    */
/* 88.     88  V888    88      .88.      88       88    */
/* Y88888P VP   V8P    YP    Y888888P    YP       YP    */

export type EntityID = number;
export const entityIDField = Symbol.for("ECS::EntityIDField");
export const currentEntity = Symbol.for("CurrentEntity");

/* db   d8b   db  .d88b.  d8888b. db      d8888b. */
/* 88   I8I   88 .8P  Y8. 88  `8D 88      88  `8D */
/* 88   I8I   88 88    88 88oobY' 88      88   88 */
/* Y8   I8I   88 88    88 88`8b   88      88   88 */
/* `8b d8'8b d8' `8b  d8' 88 `88. 88booo. 88  .8D */
/*  `8b8' `8d8'   `Y88P'  88   YD Y88888P Y8888D' */

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

  spawn(...components: Object[]): EntityID {
    const entity = ++this.#entityCount;
    this.#entities.add(entity);
    for (const c of components) {
      this.insert(entity, c);
    }
    return entity;
  }

  despawn(...entities: EntityID[]) {
    for (const entity of entities) {
      if (!this.exists(entity)) {
        throw Error(`Entity ${entity} does not exist`);
      }
    }

    entities.forEach((it) => this.#despawnQueue.add(it));
  }

  tryDespawn(...entities: EntityID[]): boolean {
    try {
      this.despawn.apply(this, entities);
      return true;
    } catch {
      return false;
    }
  }

  insert(entity: EntityID, ...components: Object[]) {
    if (!this.exists(entity)) {
      throw Error(`Entity ${entity} does not exist`);
    }

    for (const component of components) {
      if ((<any>component)[currentEntity]) {
        throw Error(`Component exists on another entity`);
      }

      if (this.has(entity, constructorOf(component))) {
        this.remove(entity, constructorOf(component));
      }

      (<any>component)[currentEntity] = entity;
      this.#componentMap.get(constructorOf(component)).add(entity, component);
    }
  }

  tryInsert(entity: EntityID, ...components: Object[]): boolean {
    try {
      this.insert(entity, ...components);
      return true;
    } catch {
      return false;
    }
  }

  remove(entity: EntityID, ...components: ConstructorOf<Object>[]) {
    if (!this.exists(entity)) {
      throw Error(`Entity ${entity} does not exist`);
    }

    for (const component of components) {
      this.#removalQueue.get(component).add(entity);
    }
  }

  tryRemove(entity: EntityID, ...components: ConstructorOf<Object>[]) {
    try {
      this.remove(entity, ...components);
      return true;
    } catch {
      return false;
    }
  }

  has(entity: EntityID, ...components: ConstructorOf<Object>[]): boolean {
    for (const component of components) {
      if (!this.#componentMap.get(component).has(entity)) {
        return false;
      }
    }
    return true;
  }

  exists(entity: EntityID): boolean {
    return this.#entities.has(entity);
  }

  get<T extends Object>(entity: EntityID, component: ConstructorOf<T>): T {
    if (!this.#componentMap.get(component).has(entity)) {
      throw Error(`Component ${component.name} does not exist on entity`);
    }
    return <T>this.#componentMap.get(component).get(entity);
  }

  tryGet<T extends Object>(
    entity: EntityID,
    component: ConstructorOf<T>,
  ): T | null {
    if (!this.#componentMap.get(component).has(entity)) {
      return null;
    }
    return <T>this.#componentMap.get(component).get(entity);
  }

  willDespawn(entity: EntityID): boolean {
    return this.#despawnQueue.has(entity);
  }

  willRemove(entity: EntityID, component: ConstructorOf<Object>): boolean {
    return this.#removalQueue.get(component).has(entity);
  }

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
    }

    for (const [componentType, entities] of this.#removalQueue) {
      for (const entity of entities) {
        if (this.exists(entity)) {
          const component = this.#componentMap.get(componentType).get(entity);
          (<any>component)[currentEntity] = undefined;
          this.#componentMap.get(componentType).remove(entity);
        }
      }
    }
  }

  *queryIter<T extends QueryList>(
    query: T,
  ): IterableIterator<[EntityID, ...InferQuery<T>]> {
    const u = (item: any) => item["mutComponent"] ?? item;

    if (query.length === 0) return;
    if (query.length > this.#mutWrappers.length) {
      throw new Error(
        "Query has more than 100 mutable components which is the max",
      );
    }

    let smallest = this.#componentMap.get(u(query[0]));
    for (let i = 1; i < query.length; i++) {
      const set = this.#componentMap.get(u(query[i]));
      if (set.size === 0) return;
      if (set.size < smallest.size) {
        smallest = set;
      }
    }

    this.#sharedIterResult.length = query.length + 1;

    outer: for (const [entity] of smallest) {
      this.#sharedIterResult[0] = entity;
      for (let i = 0; i < query.length; i++) {
        this.#sharedIterResult[i + 1] = this.#componentMap
          .get(u(query[i]))
          .get(entity);

        // move on if component is missing
        if (!this.#sharedIterResult[i + 1]) continue outer;

        if ("mutComponent" in query[i]) {
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

export type Plugin = (app: App) => void;

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

type InferSystemArgs<T> = {
  [K in keyof T]: T[K] extends ConstructorOf<Object>
    ? InstanceOf<T[K]>
    : T[K] extends QueryList
      ? {
          [Symbol.iterator]: () => IterableIterator<
            [entityID: EntityID, ...InferQuery<T[K]>]
          >;
        }
      : T[K] extends InferEventReader<infer U>
        ? EventReader<U>
        : T[K] extends InferEventWriter<infer U>
          ? EventWriter<U>
          : never;
};

type SystemCallback<T extends readonly any[] = []> = (
  ...args: InferSystemArgs<T>
) => void;

export function System<T extends readonly any[] = []>(
  name: string,
  args: [...T],
  callback: SystemCallback<T>,
) {
  return { name, args, callback };
}

export type SystemBundle = ReturnType<typeof System>;

/*  .d8b.  d8888b. d8888b. */
/* d8' `8b 88  `8D 88  `8D */
/* 88ooo88 88oodD' 88oodD' */
/* 88~~~88 88~~~   88~~~   */
/* 88   88 88      88      */
/* YP   YP 88      88      */

export class Configuration {
  /**
   * The update timestep in ms. A value of 0 uses requestAnimationFrame
   */
  timeStep = 1000;
  /**
   * The fixedUpdate timestep in ms. Default is 50 / s.
   */
  fixedTimeStep = 50;
  /**
   * If update and fixed update system errors should be thrown by the app.
   * Defaults to false.
   */
  throwOnSystemError = false;
}

export class App {
  #providedSystems = new AutoMap<Schedule, Set<SystemBundle>>(() => new Set());
  #systems = new AutoMap<
    Schedule,
    Set<{ args: any[]; callback: any; name: string }>
  >(() => new Set());
  #resources = new Map<ConstructorOf<Object>, Object>();
  #events = new Map<Event, EventQueue<any>>();
  #started = false;
  #destroyed = false;
  #config: Configuration;

  constructor(config: Configuration = new Configuration()) {
    this.#config = config;
    this.addResources(Clock, Triggerer, World);
  }

  addPlugins(...plugins: Plugin[]) {
    if (this.#started || this.#destroyed) return;
    plugins.forEach((it) => it(this));
    return this;
  }

  addSystems(schedule: Schedule, ...systems: ReturnType<typeof System>[]) {
    if (this.#started || this.#destroyed) return this;
    systems.forEach((it) => this.#providedSystems.get(schedule).add(it));
    return this;
  }

  addResources(...resources: ConstructorOf<Object>[]) {
    if (this.#started || this.#destroyed) return this;
    for (const r of resources) {
      if (this.#resources.has(r)) {
        continue;
      }
      this.#resources.set(r, new r());
    }
    return this;
  }

  addEvents(...events: Event<any>[]) {
    if (this.#started || this.#destroyed) return this;
    for (const e of events) {
      if (!this.#events.has(e)) {
        this.#events.set(e, new EventQueue());
      }
    }
    return this;
  }

  run() {
    if (this.#started) return this;

    if (this.#destroyed) {
      throw Error(
        "Attempted to run Application when it was previously destroyed",
      );
    }

    this.#started = true;

    for (const [schedule, systems] of this.#providedSystems) {
      for (const system of systems) {
        this.#systems.get(schedule).add({
          args: this.#createSystemArgs(system),
          callback: system.callback,
          name: system.name,
        });
      }
    }

    for (const s of this.#systems.get(Schedule.PreStartup)) {
      try {
        s.callback.apply(null, s.args);
      } catch (error) {
        appLogger.critical(`Error in pre startup system ${s.name}: ${error}`);
        throw error;
      }
    }

    for (const s of this.#systems.get(Schedule.Startup)) {
      try {
        s.callback.apply(null, s.args);
      } catch (error) {
        appLogger.critical(`Error in startup system ${s.name}: ${error}`);
        throw error;
      }
    }

    for (const s of this.#systems.get(Schedule.PostStartup)) {
      try {
        s.callback.apply(null, s.args);
      } catch (error) {
        appLogger.critical(`Error in post startup system ${s.name}: ${error}`);
        throw error;
      }
    }

    this.#update();

    return this;
  }

  destroy() {
    if (!this.#started) return;
    this.#runSystems(Schedule.Destroy);
    this.#started = false;
    this.#destroyed = true;
  }

  #update = () => {
    setTimeout(this.#update, this.#config.timeStep);

    // capture time
    const clock = this.#getResource(Clock);
    assertInstanceOf(
      clock,
      Clock,
      "Internal error: Clock does not exist as Resource",
    );
    clock.capture();

    this.#runSystems(Schedule.PreUpdate);
    this.#runSystems(Schedule.Update);
    this.#runSystems(Schedule.PostUpdate);

    // flush world (remove queued components and entities)
    const world = this.#getResource(World);
    assertInstanceOf(
      world,
      World,
      "Internal error: World does not exist as Resource",
    );
    world.flush();

    // update event queues
    for (const queue of this.#events.values()) {
      queue.update();
    }
  };

  #runSystems(schedule: Schedule) {
    for (const s of this.#systems.get(schedule)) {
      try {
        s.callback.apply(null, s.args);
      } catch (error) {
        if (this.#config.throwOnSystemError) {
          throw error;
        } else {
          appLogger.critical(`Error in system ${s.name}: ${error}`);
        }
      }
    }
  }

  #createSystemArgs(system: SystemBundle) {
    const result = [];
    const world = this.#getResource(World);
    assertInstanceOf(
      world,
      World,
      "Internal error: World does not exist as Resource",
    );
    for (const arg of system.args) {
      if (isQuery in arg) {
        result.push({
          [Symbol.iterator]() {
            return world.queryIter(arg);
          },
        });
      } else if (eventReaderTag in arg) {
        const queue = this.#events.get(arg.event);
        if (!queue) {
          throw Error(
            `Event type ${arg.event} is not registered but is depended on by system ${system.name}`,
          );
        }
        result.push(queue.getReader());
      } else if (eventWriterTag in arg) {
        const queue = this.#events.get(arg.event);
        if (!queue) {
          throw Error(
            `Event type ${arg.event} is not registered but is depended on by system ${system.name}`,
          );
        }
        result.push(queue.getWriter());
      } else {
        const res = this.#getResource(arg);
        if (!res) {
          throw Error(
            `Could not resolve argument ${arg.name} for system ${system.name}.`,
          );
        }
        result.push(res);
      }
    }
    return result;
  }

  #getResource<T extends Object>(res: ConstructorOf<T>): T | undefined {
    return <T>this.#resources.get(res);
  }
}
