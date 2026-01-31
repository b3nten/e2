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
  ConstructorOf,
  Immutable,
  InstanceOf,
  isConstructor,
  logColors,
  Logger,
  LogLevel,
  mustExist,
  noop,
  silentLogger,
  SparseSet,
} from "./lib.ts";

/* .d8888.  .o88b. db   db d88888b d8888b. db    db db      d88888b .d8888. */
/* 88'  YP d8P  Y8 88   88 88'     88  `8D 88    88 88      88'     88'  YP */
/* `8bo.   8P      88ooo88 88ooooo 88   88 88    88 88      88ooooo `8bo.   */
/*   `Y8b. 8b      88~~~88 88~~~~~ 88   88 88    88 88      88~~~~~   `Y8b. */
/* db   8D Y8b  d8 88   88 88.     88  .8D 88b  d88 88booo. 88.     db   8D */
/* `8888Y'  `Y88P' YP   YP Y88888P Y8888D' ~Y8888P' Y88888P Y88888P `8888Y' */

export enum Schedule {
  PreStartup = "PreStartup",
  Startup = "Startup",
  PostStartup = "PostStartup",
  /**
   * Runs when an error occurs during startup.
   */
  StartupError = "StartupError",

  PreUpdate = "PreUpdate",
  Update = "Update",
  PostUpdate = "PostUpdate",

  /**
   * Runs before the world flushes queued entity despawn,
     component removal, and clears the list of mutated components.
   */
  WorldFlush = "WorldFlush",
  /**
   * Runs before the event system swaps their event buffers.
   */
  EventUpdate = "EventUpdate",

  /**
   * Runs when the App instance is destroyed.
   */
  Destroy = "Destroy",
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

  mustGet(): T {
    if (!this.initalized) {
      throw Error(
        `mustGet asset ${this.#asset.constructor.name}: not initalized`,
      );
    }
    return (<any>this.#asset).data!;
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

export class AssetManager {
  load<T extends Asset<any>>(asset: T): Handle<T> {
    asset.load();
    return asset.getHandle();
  }

  batchLoad() {}
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
      const val = q.previousBuffer[this.#previousIndex];
      this.#previousIndex++;
      yield val;
    }

    while (this.#currentIndex < q.currentBuffer.length) {
      const val = q.currentBuffer[this.#currentIndex];
      this.#currentIndex++;
      yield val;
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

export class EventQueue<T extends Event<any>> {
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

const mutTag = Symbol.for("MutTag");

type MutParam<T> = {
  [mutTag]: T;
};

export function Mut<T>(value: T): MutParam<T> {
  return { [mutTag]: value };
}

class MutRef<T> {
  constructor(world: World) {
    this.world = world;
  }

  deref(): T {
    this.world.changedComponents
      .get(ConstructorOf(this.value!))
      .add(this.value!);
    return this.value;
  }

  get ref(): Immutable<T> {
    return <Immutable<T>>this.value;
  }

  private world!: World;
  private value!: T;
}

type QueryList = readonly (ConstructorOf<Object> | MutParam<any>)[];

const queryTag = Symbol.for("QueryTag");
export function Query<T extends QueryList>(...values: T) {
  (<any>values)[queryTag] = true;
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
      const t = ConstructorOf(_t);
      const next = current.children.get(t);
      if (!next) return;
      current = next;
    }
    current.responders.forEach((it) =>
      (<(...payloads: Object[]) => void>it)(...payloads),
    );
  }
}

/* d8888b. d88888b .d8888. */
/* 88  `8D 88'     88'  YP */
/* 88oobY' 88ooooo `8bo.   */
/* 88`8b   88~~~~~   `Y8b. */
/* 88 `88. 88.     db   8D */
/* 88   YD Y88888P `8888Y' */

type ResourcePtr<T = unknown> = {
  data: T | undefined;
  valid: boolean;
  refCount: number;
};

export class Resource<T = unknown> {
  #ptr: ResourcePtr<T>;
  #disposed = false;

  private constructor(ptr: ResourcePtr<T>, disposalFn: VoidFunction) {
    this.#ptr = ptr;
    this.dispose = () => {
      if (this.#disposed) {
        return;
      }
      this.#disposed = true;
      disposalFn();
    };
  }

  get(): T {
    if (this.#disposed) {
      throw new Error("Resource handle has been disposed");
    }
    if (!this.#ptr.valid) {
      throw new Error("Resource has been invalidated");
    }
    return this.#ptr.data!;
  }

  tryGet(): T | null {
    if (!this.#ptr.valid || this.#disposed) {
      return null;
    }
    return this.#ptr.data!;
  }

  unwrap() {
    return this.#ptr.data;
  }

  readonly dispose: VoidFunction;
}

export class Resources {
  #storage = new Map<any, ResourcePtr>();

  #registry = new FinalizationRegistry<{ key: any; ptr: ResourcePtr }>(
    (ctx) => {
      this.#decrement(ctx.key, ctx.ptr);
    },
  );

  add<T>(key: any, value: T): Resource<T> {
    if (this.#storage.has(key)) {
      const ptr = <ResourcePtr<T>>this.#storage.get(key);

      try {
        (ptr.data as any)?.destructor?.();
      } catch (e) {}

      ptr.data = value;
      ptr.valid = true;

      return this.#createResource(key, ptr);
    }

    const ptr: ResourcePtr<T> = { data: value, valid: true, refCount: 1 };
    this.#storage.set(key, ptr);

    return this.#createResource(key, ptr);
  }

  get<T = unknown>(key: any): Resource<T> {
    const ptr = this.#storage.get(key);
    if (!ptr) {
      throw Error(`No Resource for key (${key}) available`);
    }
    ptr.refCount++;
    return this.#createResource(key, <ResourcePtr<T>>ptr);
  }

  tryGet<T = unknown>(key: any): Resource<T> | null {
    const ptr = this.#storage.get(key);
    if (!ptr) {
      return null;
    }
    ptr.refCount++;
    return this.#createResource(key, <ResourcePtr<T>>ptr);
  }

  #createResource<T>(key: any, ptr: ResourcePtr<T>): Resource<T> {
    const token = {};

    // @ts-expect-error private constructor is module scoped
    const resource = new Resource<T>(ptr, () => {
      this.#registry.unregister(token);
      this.#decrement(key, ptr);
    });

    this.#registry.register(resource, { key, ptr }, token);

    return resource;
  }

  #decrement(key: any, ptr: ResourcePtr) {
    ptr.refCount--;

    if (ptr.refCount === 0) {
      this.#destroy(ptr);
      if (this.#storage.get(key) === ptr) {
        this.#storage.delete(key);
      }
    }
  }

  #destroy(ptr: ResourcePtr) {
    if (!ptr.valid) return;

    try {
      (ptr.data as any)?.destructor?.();
    } catch (e) {}

    ptr.valid = false;
    ptr.data = undefined;
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

// trigger keys
export class ComponentInserted {
  constructor(public entity: EntityID) {}
}
export class ComponentRemovalScheduled {
  constructor(public entity: EntityID) {}
}
export class EntitySpawned {
  constructor(public entity: EntityID) {}
}
export class EntityDespawnScheduled {
  constructor(public entity: EntityID) {}
}

export class World {
  changedComponents = new AutoMap<Object, Set<Object>>(() => new Set());

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

  public triggerer?: Triggerer;

  spawn(...components: Object[]): EntityID {
    const entity = ++this.#entityCount;
    this.#entities.add(entity);
    this.triggerer?.trigger(new EntitySpawned(entity));
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
    entities.forEach((it) => {
      this.#despawnQueue.add(it);
      this.triggerer?.trigger(new EntityDespawnScheduled(it));
    });
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

      if (this.has(entity, ConstructorOf(component))) {
        throw Error(
          `Entity ${entity} already contains component ${ConstructorOf(component).name}`,
        );
      }

      (<any>component)[currentEntity] = entity;
      this.#componentMap.get(ConstructorOf(component)).add(entity, component);
      this.triggerer?.trigger(new ComponentInserted(entity), component);
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
      this.triggerer?.trigger(new ComponentRemovalScheduled(entity), component);
    }
  }

  tryRemove(entity: EntityID, ...components: ConstructorOf<Object>[]): boolean {
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

  get<T extends Object>(
    entity: EntityID,
    componentType: ConstructorOf<T>,
  ): Immutable<T> {
    if (!this.#componentMap.get(componentType).has(entity)) {
      throw Error(`Component ${componentType.name} does not exist on entity`);
    }
    return <Immutable<T>>this.#componentMap.get(componentType).get(entity);
  }

  tryGet<T extends Object>(
    entity: EntityID,
    component: ConstructorOf<T>,
  ): Immutable<T> | null {
    if (!this.#componentMap.get(component).has(entity)) {
      return null;
    }
    return <Immutable<T>>this.#componentMap.get(component).get(entity);
  }

  getMut<T extends Object>(
    entity: EntityID,
    componentType: ConstructorOf<T>,
  ): T {
    if (!this.#componentMap.get(componentType).has(entity)) {
      throw Error(`Component ${componentType.name} does not exist on entity`);
    }
    const component = <T>this.#componentMap.get(componentType).get(entity);
    this.changedComponents.get(componentType).add(component);
    return component;
  }

  tryGetMut<T extends Object>(
    entity: EntityID,
    componentType: ConstructorOf<T>,
  ): T | null {
    if (!this.#componentMap.get(componentType).has(entity)) {
      return null;
    }
    const component = <T>this.#componentMap.get(componentType).get(entity);
    this.changedComponents.get(componentType).add(component);
    return component;
  }

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
    this.triggerer?.trigger(new ComponentRemovalScheduled(from), component);

    (<any>component)[currentEntity] = to;
    this.#componentMap.get(componentType).remove(from);
    this.#componentMap.get(componentType).add(to, component);

    this.triggerer?.trigger(new ComponentInserted(to), component);
  }

  trySwap<T extends Object>(
    componentType: ConstructorOf<T>,
    from: EntityID,
    to: EntityID,
  ): boolean {
    if (!this.#componentMap.get(componentType).has(from) || !this.exists(to)) {
      return false;
    }

    const component = this.#componentMap.get(componentType).get(from)!;
    this.triggerer?.trigger(new ComponentRemovalScheduled(from), component);

    (<any>component)[currentEntity] = to;

    this.#componentMap.get(componentType).remove(from);
    this.#componentMap.get(componentType).add(to, component);
    this.triggerer?.trigger(new ComponentInserted(to), component);

    return true;
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

  clear() {
    for (const sets of this.changedComponents.values()) {
      sets.clear();
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

        if (mutTag in query[i]) {
          (<any>this.#mutWrappers[i]).value = this.#sharedIterResult[i + 1];
          this.#sharedIterResult[i + 1] = this.#mutWrappers[i];
        }
      }
      yield this.#sharedIterResult as any;
    }
  }
}

/* d8888b. d88888b db      */
/* 88  `8D 88'     88      */
/* 88oobY' 88ooooo 88      */
/* 88`8b   88~~~~~ 88      */
/* 88 `88. 88.     88booo. */
/* 88   YD Y88888P Y88888P */

export class Relationship {
  /**
   * Parent a child entity to a parent entity.
   * @param world - the {@link World} with the parent and child entities
   * @param parent - the parent {@link EntityID}
   * @param child - the child {@link EntityID}
   * @returns void on success, Error otherwise
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
   * Unparent a child entity from a parent entity.
   * @param world - the {@link World} with the parent and child entities
   * @param parent - the parent {@link EntityID}
   * @param child - the child {@link EntityID}
   * @returns void on success, Error otherwise
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

  /** Get the parent {@link EntityID} */
  get parent(): EntityID | null {
    return this._parent;
  }

  /** Get a readonly Set with {@link EntityID}s of child entities */
  get children(): ChildSet {
    return this._children ?? <ChildSet>EMPTY_SET;
  }

  protected _parent: EntityID | null = null;
  protected _children?: Set<EntityID>;
}

type ChildSet = Omit<Set<EntityID>, "add" | "delete" | "clear">;
const EMPTY_SET: Set<any> = new Set();

const relationshipSystem = System(
  "RelationshipSystem",
  [World, Triggerer],
  (w, t) => {
    t.addResponder(
      [ComponentRemovalScheduled, Relationship],
      ({ entity }, rel) => {
        if (rel.parent) {
          Relationship.Unparent(w, rel.parent, entity);
        }
        for (const child of rel.children) {
          Relationship.Unparent(w, entity, child);
        }
      },
    );
    t.addResponder(
      [EntityDespawnScheduled, Relationship],
      ({ entity }, rel) => {
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
          : T[K] extends Resources
            ? Resources
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

export type System = ReturnType<typeof System>;

/*  .d8b.  d8888b. d8888b. */
/* d8' `8b 88  `8D 88  `8D */
/* 88ooo88 88oodD' 88oodD' */
/* 88~~~88 88~~~   88~~~   */
/* 88   88 88      88      */
/* YP   YP 88      88      */

export enum AppMode {
  Debug = "ModeDebug",
  Dev = "ModeDev",
  Prod = "ModeProd",
}

export class Configuration {
  /**
   * The update timestep in ms. A value of 0 uses requestAnimationFrame
   */
  timeStep = 500;
  /**
   * The fixedUpdate timestep in ms. Default is 50hz (20ms).
   */
  fixedTimeStep = 20;
  /**
   * If update and fixed update system errors should be thrown by the app.
   * Defaults to false.
   */
  throwOnSystemError = false;
  /**
   * Called when any system errors. Can be used for reporting etc.
   */
  onSystemError: (error: unknown) => void = noop;

  mode: AppMode = AppMode.Prod;

  logger?: Logger;
}

export class App {
  static defaultsPlugin = Plugin("DefaultsPlugin", (app: App) => {
    app.addResources(Clock, Triggerer, World);
    app.addSystems(Schedule.Startup, relationshipSystem);
  });

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
  #resourceManager = new Resources();
  #staticResources = new Map<ConstructorOf<Object>, Resource<Object>>();
  #config: Configuration;

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

  addSystems(schedule: Schedule, ...systems: ReturnType<typeof System>[]): App {
    if (this.#started || this.#destroyed) {
      this.#logger.warn(
        "Attempted to add a system to App, which is either running or destroyed",
      );
      return this;
    }
    systems.forEach((it) => {
      this.#logger.info(`Registering system ${it.name}`);
      this.#providedSystems.get(schedule).add(it);
    });
    return this;
  }

  addResources(...resources: ConstructorOf<Object>[]): App {
    if (this.#started || this.#destroyed) {
      this.#logger.warn(
        "Attempted to add a resource to App, which is either running or destroyed",
      );
      return this;
    }
    for (const r of resources) {
      this.#logger.info(`Registering resource ${r.name}`);
      this.#staticResources.set(r, this.#resourceManager.add(r, new r()));
    }
    return this;
  }

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

  run(): App {
    if (this.#started) {
      this.#logger.warn("Attempted to run an app which is already running");
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
      this.#staticResources.get(Clock)?.unwrap(),
      Clock,
      `Clock resource must exist and be instanceof Clock`,
    );

    const triggerer = this.#staticResources.get(Triggerer)?.unwrap();
    assertInstanceOf(
      triggerer,
      Triggerer,
      `Triggerer resource must exist and be instanceof Triggerer`,
    );

    const world = this.#staticResources.get(World)?.unwrap();
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
            args: this.#createSystemArgs(system),
            callback: system.callback,
            name: system.name,
          });
        }
      }

      for (const s of this.#systems.get(Schedule.PreStartup)) {
        logger.debug("running system:", s.name);
        try {
          s.callback.apply(null, s.args);
        } catch (error) {
          this.#config.onSystemError(error);
          appLogger.critical(`Error in pre startup system ${s.name}: ${error}`);
          throw error;
        }
      }

      for (const s of this.#systems.get(Schedule.Startup)) {
        logger.debug("running system:", s.name);
        try {
          s.callback.apply(null, s.args);
        } catch (error) {
          this.#config.onSystemError(error);
          appLogger.critical(`Error in startup system ${s.name}: ${error}`);
          throw error;
        }
      }

      for (const s of this.#systems.get(Schedule.PostStartup)) {
        logger.debug("running system:", s.name);
        try {
          s.callback.apply(null, s.args);
        } catch (error) {
          this.#config.onSystemError(error);
          appLogger.critical(
            `Error in post startup system ${s.name}: ${error}`,
          );
          throw error;
        }
      }
    } catch (error) {
      this.#runSystems(Schedule.StartupError);
      throw error;
    }

    setTimeout(this.#update, 0);

    logger.success("App successfully started!");

    return this;
  }

  destroy() {
    if (!this.#started) {
      this.#logger.warn(
        `Attempted to destroy an app which was not started. This may not be intended behavior.`,
      );
    }
    this.#runSystems(Schedule.Destroy);
    this.#started = false;
    this.#destroyed = true;
    this.#logger.debug(`Destroyed app ${this}`);
  }

  get #logger() {
    return this.#config.logger!;
  }

  #update = () => {
    const logger = this.#logger;

    if (this.#config.timeStep === 0) {
      requestAnimationFrame(this.#update);
    } else {
      setTimeout(this.#update, this.#config.timeStep);
    }

    // capture time
    const clock = <Clock>this.#staticResources.get(Clock)!.unwrap();
    clock.capture();

    logger.debug(`running preupdate schedule`);
    this.#runSystems(Schedule.PreUpdate);
    logger.debug(`running update schedule`);
    this.#runSystems(Schedule.Update);
    logger.debug(`running postupdate schedule`);
    this.#runSystems(Schedule.PostUpdate);

    // flush world (remove queued components and entities)
    const world = <World>this.#staticResources.get(World)!.unwrap();
    logger.debug("flushing world");
    this.#runSystems(Schedule.WorldFlush);
    world.flush();
    world.clear();

    // update event queues
    logger.debug("updating event queues");
    this.#runSystems(Schedule.EventUpdate);
    for (const queue of this.#events.values()) {
      queue.update();
    }
  };

  #runSystems(schedule: Schedule) {
    const logger = this.#logger;
    for (const s of this.#systems.get(schedule)) {
      logger.debug("running system:", s.name);
      try {
        s.callback.apply(null, s.args);
      } catch (error) {
        this.#config.onSystemError(error);
        if (this.#config.throwOnSystemError) {
          throw error;
        } else {
          logger.critical(`Error in system ${s.name}: ${error}`);
        }
      }
    }
  }

  #createSystemArgs(system: System) {
    const result = [];

    const world = mustExist(
      <World>this.#staticResources.get(World)!.unwrap(),
      "World does not exist as Resource",
    );

    for (const arg of system.args) {
      if (arg === Resources) {
        result.push(this.#resourceManager);
      } else if (queryTag in arg) {
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
        const res = this.#resourceManager.tryGet(arg)?.tryGet();
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
}
