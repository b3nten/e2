/*        .__....._             _.....__,
            .": o :':         ;': o :".
            `. `-' .'.       .'. `-' .'
              `---'             `---'

    _...----...      ...   ...      ...----..._
 .-'__..-""'----    `.  `"`  .'    ----'""-..__`-.
'.-'   _.--"""'       `-._.-'       '"""--._   `-.`
'  .-"'                  :                  `"-.  `
  '   `.              _.'"'._              .'   `
        `.       ,.-'"       "'-.,       .'
          `.                           .'
            `-._                   _.-'
                `"'--...___...--'"`

                Art by Morfina */

/*_,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,_

This module contains utility types, assert functions, type checks,
containers, loggers, and other basic useful utilities.

_,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,__,.-'~'-.,_*/

// F_types
/* d888888b db    db d8888b. d88888b .d8888. */
/* `~~88~~' `8b  d8' 88  `8D 88'     88'  YP */
/*    88     `8bd8'  88oodD' 88ooooo `8bo.   */
/*    88       88    88~~~   88~~~~~   `Y8b. */
/*    88       88    88      88.     db   8D */
/*    YP       YP    88      Y88888P `8888Y' */

export type Primitive =
  | string
  | number
  | bigint
  | boolean
  | symbol
  | null
  | undefined;

/**
 * Type representing falsy values in TypeScript: `false | "" | 0 | null | undefined`
 */
export type Falsy = false | "" | 0 | null | undefined;

/**
 * Type representing [nullish values][https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#nullish-coalescing] in TypeScript: `null | undefined`
 */
export type Nullish = null | undefined;

/**
 * Extracts the constructor type of a class or function.
 */
export type ConstructorOf<T, Args extends Array<any> = any[]> = new (
  ...args: Args
) => T;

/**
 * Extracts the abstract constructor type of a class or function
 * (e.g., for abstract classes).
 */
export type AbstractConstructorOf<T, Args extends Array<any> = any[]> = new (
  ...args: Args
) => T;

/**
 * Extracts the instance type of a class or function, similar to `InstanceType` but allows for abstract constructors.,
 */
export type InstanceOf<TClass> = InstanceType<{ new (): never } & TClass>;

/**
 * Type representing serializable types in TypeScript.
 */
export type Serializable =
  | string
  | number
  | boolean
  | null
  | undefined
  | Serializable[]
  | { [key: string]: Serializable };

/**
 * Credits to all the people who given inspiration and shared some very useful code snippets
 * in the following github issue: https://github.com/Microsoft/TypeScript/issues/12215
 */

/**
 * Set intersection of given union types `A` and `B`
 * @example
 *   // Expect: "2" | "3"
 *   SetIntersection<'1' | '2' | '3', '2' | '3' | '4'>;
 *
 *   // Expect: () => void
 *   SetIntersection<string | number | (() => void), Function>;
 */
export type SetIntersection<A, B> = A extends B ? A : never;

/**
 * Set difference of given union types `A` and `B`
 * @example
 *   // Expect: "1"
 *   SetDifference<'1' | '2' | '3', '2' | '3' | '4'>;
 *
 *   // Expect: string | number
 *   SetDifference<string | number | (() => void), Function>;
 */
export type SetDifference<A, B> = A extends B ? never : A;

/**
 * Set complement of given union types `A` and (it's subset) `A1`
 * @example
 *   // Expect: "1"
 *   SetComplement<'1' | '2' | '3', '2' | '3'>;
 */
export type SetComplement<A, A1 extends A> = SetDifference<A, A1>;

/**
 * Set difference of union and intersection of given union types `A` and `B`
 * @example
 *   // Expect: "1" | "4"
 *   SymmetricDifference<'1' | '2' | '3', '2' | '3' | '4'>;
 */
export type SymmetricDifference<A, B> = SetDifference<A | B, A & B>;

/**
 * Exclude undefined from set `A`
 * @example
 *   // Expect: "string | null"
 *   SymmetricDifference<string | null | undefined>;
 */
export type NonUndefined<A> = A extends undefined ? never : A;

/**
 * Get union type of keys that are functions in object type `T`
 * @example
 *  type MixedProps = {name: string; setName: (name: string) => void; someKeys?: string; someFn?: (...args: any) => any;};
 *
 *   // Expect: "setName | someFn"
 *   type Keys = FunctionKeys<MixedProps>;
 */
export type FunctionKeys<T extends object> = {
  [K in keyof T]-?: NonUndefined<T[K]> extends Function ? K : never;
}[keyof T];

/**
 * Get union type of keys that are non-functions in object type `T`
 * @example
 *   type MixedProps = {name: string; setName: (name: string) => void; someKeys?: string; someFn?: (...args: any) => any;};
 *
 *   // Expect: "name | someKey"
 *   type Keys = NonFunctionKeys<MixedProps>;
 */
export type NonFunctionKeys<T extends object> = {
  [K in keyof T]-?: NonUndefined<T[K]> extends Function ? never : K;
}[keyof T];

/**
 * Get union type of keys that are mutable in object type `T`
 * Credit: Matt McCutchen
 * https://stackoverflow.com/questions/52443276/how-to-exclude-getter-only-properties-from-type-in-typescript
 * @example
 *   type Props = { readonly foo: string; bar: number };
 *
 *   // Expect: "bar"
 *   type Keys = MutableKeys<Props>;
 */
export type MutableKeys<T extends object> = {
  [P in keyof T]-?: IfEquals<
    { [Q in P]: T[P] },
    { -readonly [Q in P]: T[P] },
    P
  >;
}[keyof T];

export type WritableKeys<T extends object> = MutableKeys<T>;

/**
 * Get union type of keys that are readonly in object type `T`
 * Credit: Matt McCutchen
 * https://stackoverflow.com/questions/52443276/how-to-exclude-getter-only-properties-from-type-in-typescript
 * @example
 *   type Props = { readonly foo: string; bar: number };
 *
 *   // Expect: "foo"
 *   type Keys = ReadonlyKeys<Props>;
 */
export type ReadonlyKeys<T extends object> = {
  [P in keyof T]-?: IfEquals<
    { [Q in P]: T[P] },
    { -readonly [Q in P]: T[P] },
    never,
    P
  >;
}[keyof T];

type IfEquals<X, Y, A = X, B = never> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B;

/**
 * Get union type of keys that are required in object type `T`
 * @see https://stackoverflow.com/questions/52984808/is-there-a-way-to-get-all-required-properties-of-a-typescript-object
 * @example
 *   type Props = { req: number; reqUndef: number | undefined; opt?: string; optUndef?: number | undefined; };
 *
 *   // Expect: "req" | "reqUndef"
 *   type Keys = RequiredKeys<Props>;
 */
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

/**
 * Get union type of keys that are optional in object type `T`
 * @see https://stackoverflow.com/questions/52984808/is-there-a-way-to-get-all-required-properties-of-a-typescript-object
 * @example
 *   type Props = { req: number; reqUndef: number | undefined; opt?: string; optUndef?: number | undefined; };
 *
 *   // Expect: "opt" | "optUndef"
 *   type Keys = OptionalKeys<Props>;
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

/**
 * Get keys of all objects in the union type `U`
 * Credit: filipomar
 * @see https://github.com/piotrwitek/utility-types/issues/192
 * @example
 *   // Expect: 'name' | 'age' | 'visible'
 *   UnionKeys<{ name: string; age: string } | { age: number } | { visible: boolean }>
 */
export type UnionKeys<U> = keyof UnionToIntersection<Partial<U>>;

/**
 * From `T` pick a set of properties by key `K`
 * @example
 *   type Props = { name: string; age: number; visible: boolean };
 *
 *   // Expect: { age: number; }
 *   type Props = Pick<Props, 'age'>;
 */
namespace Pick {}

/**
 * From `T` pick a set of properties by value matching `ValueType`.
 * Credit: [Piotr Lewandowski](https://medium.com/dailyjs/typescript-create-a-condition-based-subset-types-9d902cea5b8c)
 * @example
 *   type Props = { req: number; reqUndef: number | undefined; opt?: string; };
 *
 *   // Expect: { req: number }
 *   type Props = PickByValue<Props, number>;
 *   // Expect: { req: number; reqUndef: number | undefined; }
 *   type Props = PickByValue<Props, number | undefined>;
 */
export type PickByValue<T, ValueType> = Pick<
  T,
  { [Key in keyof T]-?: T[Key] extends ValueType ? Key : never }[keyof T]
>;

/**
 * From `T` pick a set of properties by value matching exact `ValueType`.
 * @example
 *   type Props = { req: number; reqUndef: number | undefined; opt?: string; };
 *
 *   // Expect: { req: number }
 *   type Props = PickByValueExact<Props, number>;
 *   // Expect: { reqUndef: number | undefined; }
 *   type Props = PickByValueExact<Props, number | undefined>;
 */
export type PickByValueExact<T, ValueType> = Pick<
  T,
  {
    [Key in keyof T]-?: [ValueType] extends [T[Key]]
      ? [T[Key]] extends [ValueType]
        ? Key
        : never
      : never;
  }[keyof T]
>;

/**
 * From `T` remove a set of properties by key `K`
 * @example
 *   type Props = { name: string; age: number; visible: boolean };
 *
 *   // Expect: { name: string; visible: boolean; }
 *   type Props = Omit<Props, 'age'>;
 */
export type Omit<T, K extends keyof any> = Pick<T, SetDifference<keyof T, K>>;

/**
 * From `T` remove a set of properties by value matching `ValueType`.
 * Credit: [Piotr Lewandowski](https://medium.com/dailyjs/typescript-create-a-condition-based-subset-types-9d902cea5b8c)
 * @example
 *   type Props = { req: number; reqUndef: number | undefined; opt?: string; };
 *
 *   // Expect: { reqUndef: number | undefined; opt?: string; }
 *   type Props = OmitByValue<Props, number>;
 *   // Expect: { opt?: string; }
 *   type Props = OmitByValue<Props, number | undefined>;
 */
export type OmitByValue<T, ValueType> = Pick<
  T,
  { [Key in keyof T]-?: T[Key] extends ValueType ? never : Key }[keyof T]
>;

/**
 * From `T` remove a set of properties by value matching exact `ValueType`.
 * @example
 *   type Props = { req: number; reqUndef: number | undefined; opt?: string; };
 *
 *   // Expect: { reqUndef: number | undefined; opt?: string; }
 *   type Props = OmitByValueExact<Props, number>;
 *   // Expect: { req: number; opt?: string }
 *   type Props = OmitByValueExact<Props, number | undefined>;
 */
export type OmitByValueExact<T, ValueType> = Pick<
  T,
  {
    [Key in keyof T]-?: [ValueType] extends [T[Key]]
      ? [T[Key]] extends [ValueType]
        ? never
        : Key
      : Key;
  }[keyof T]
>;

/**
 * From `T` pick properties that exist in `U`
 * @example
 *   type Props = { name: string; age: number; visible: boolean };
 *   type DefaultProps = { age: number };
 *
 *   // Expect: { age: number; }
 *   type DuplicateProps = Intersection<Props, DefaultProps>;
 */
export type Intersection<T extends object, U extends object> = Pick<
  T,
  Extract<keyof T, keyof U> & Extract<keyof U, keyof T>
>;

/**
 * From `T` remove properties that exist in `U`
 * @example
 *   type Props = { name: string; age: number; visible: boolean };
 *   type DefaultProps = { age: number };
 *
 *   // Expect: { name: string; visible: boolean; }
 *   type DiffProps = Diff<Props, DefaultProps>;
 */
export type Diff<T extends object, U extends object> = Pick<
  T,
  SetDifference<keyof T, keyof U>
>;

/**
 * From `T` remove properties that exist in `T1` (`T1` has a subset of the properties of `T`)
 * @example
 *   type Props = { name: string; age: number; visible: boolean };
 *   type DefaultProps = { age: number };
 *
 *   // Expect: { name: string; visible: boolean; }
 *   type RestProps = Subtract<Props, DefaultProps>;
 */
export type Subtract<T extends T1, T1 extends object> = Pick<
  T,
  SetComplement<keyof T, keyof T1>
>;

/**
 * From `U` overwrite properties to `T`
 * @example
 *   type Props = { name: string; age: number; visible: boolean };
 *   type NewProps = { age: string; other: string };
 *
 *   // Expect: { name: string; age: string; visible: boolean; }
 *   type ReplacedProps = Overwrite<Props, NewProps>;
 */
export type Overwrite<
  T extends object,
  U extends object,
  I = Diff<T, U> & Intersection<U, T>,
> = Pick<I, keyof I>;

/**
 * From `U` assign properties to `T` (just like object assign)
 * @example
 *   type Props = { name: string; age: number; visible: boolean };
 *   type NewProps = { age: string; other: string };
 *
 *   // Expect: { name: string; age: number; visible: boolean; other: string; }
 *   type ExtendedProps = Assign<Props, NewProps>;
 */
export type Assign<
  T extends object,
  U extends object,
  I = Diff<T, U> & Intersection<U, T> & Diff<U, T>,
> = Pick<I, keyof I>;

/**
 * Exact
 * @desc Create branded object type for exact type matching
 */
export type Exact<A extends object> = A & { __brand: keyof A };

/**
 * Disjoin object to form union of objects, each with single property
 * @example
 *   type Props = { name: string; age: number; visible: boolean };
 *
 *   // Expect: { name: string; } | { age: number; } | { visible: boolean; }
 *   type UnionizedType = Unionize<Props>;
 */
export type Unionize<T extends object> = {
  [P in keyof T]: { [Q in P]: T[P] };
}[keyof T];

/**
 * Obtain Promise resolve type
 * @example
 *   // Expect: string;
 *   type Response = PromiseType<Promise<string>>;
 */
export type PromiseType<T extends Promise<any>> =
  T extends Promise<infer U> ? U : never;

// TODO: inline _DeepReadonlyArray with infer in DeepReadonly, same for all other deep types
/**
 * Readonly that works for deeply nested structure
 * @example
 *   // Expect: {
 *   //   readonly first: {
 *   //     readonly second: {
 *   //       readonly name: string;
 *   //     };
 *   //   };
 *   // }
 *   type NestedProps = {
 *     first: {
 *       second: {
 *         name: string;
 *       };
 *     };
 *   };
 *   type ReadonlyNestedProps = DeepReadonly<NestedProps>;
 */
export type DeepReadonly<T> = T extends ((...args: any[]) => any) | Primitive
  ? T
  : T extends _DeepReadonlyArray<infer U>
    ? _DeepReadonlyArray<U>
    : T extends _DeepReadonlyObject<infer V>
      ? _DeepReadonlyObject<V>
      : T;
/** @private */
// tslint:disable-next-line:class-name
export interface _DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}
/** @private */
export type _DeepReadonlyObject<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

/**
 * Required that works for deeply nested structure
 * @example
 *   // Expect: {
 *   //   first: {
 *   //     second: {
 *   //       name: string;
 *   //     };
 *   //   };
 *   // }
 *   type NestedProps = {
 *     first?: {
 *       second?: {
 *         name?: string;
 *       };
 *     };
 *   };
 *   type RequiredNestedProps = DeepRequired<NestedProps>;
 */
export type DeepRequired<T> = T extends (...args: any[]) => any
  ? T
  : T extends any[]
    ? _DeepRequiredArray<T[number]>
    : T extends object
      ? _DeepRequiredObject<T>
      : T;
/** @private */
// tslint:disable-next-line:class-name
export interface _DeepRequiredArray<T> extends Array<
  DeepRequired<NonUndefined<T>>
> {}
/** @private */
export type _DeepRequiredObject<T> = {
  [P in keyof T]-?: DeepRequired<NonUndefined<T[P]>>;
};

/**
 * NonNullable that works for deeply nested structure
 * @example
 *   // Expect: {
 *   //   first: {
 *   //     second: {
 *   //       name: string;
 *   //     };
 *   //   };
 *   // }
 *   type NestedProps = {
 *     first?: null | {
 *       second?: null | {
 *         name?: string | null |
 *         undefined;
 *       };
 *     };
 *   };
 *   type RequiredNestedProps = DeepNonNullable<NestedProps>;
 */
export type DeepNonNullable<T> = T extends (...args: any[]) => any
  ? T
  : T extends any[]
    ? _DeepNonNullableArray<T[number]>
    : T extends object
      ? _DeepNonNullableObject<T>
      : T;
/** @private */
// tslint:disable-next-line:class-name
export interface _DeepNonNullableArray<T> extends Array<
  DeepNonNullable<NonNullable<T>>
> {}
/** @private */
export type _DeepNonNullableObject<T> = {
  [P in keyof T]-?: DeepNonNullable<NonNullable<T[P]>>;
};

/**
 * Partial that works for deeply nested structure
 * @example
 *   // Expect: {
 *   //   first?: {
 *   //     second?: {
 *   //       name?: string;
 *   //     };
 *   //   };
 *   // }
 *   type NestedProps = {
 *     first: {
 *       second: {
 *         name: string;
 *       };
 *     };
 *   };
 *   type PartialNestedProps = DeepPartial<NestedProps>;
 */
export type DeepPartial<T> = { [P in keyof T]?: _DeepPartial<T[P]> };

/** @private */
export type _DeepPartial<T> = T extends Function
  ? T
  : T extends Array<infer U>
    ? _DeepPartialArray<U>
    : T extends object
      ? DeepPartial<T>
      : T | undefined;
/** @private */
// tslint:disable-next-line:class-name
export interface _DeepPartialArray<T> extends Array<_DeepPartial<T>> {}

/**
 * Define nominal type of U based on type of T. Similar to Opaque types in Flow.
 * @example
 *   type USD = Brand<number, "USD">
 *   type EUR = Brand<number, "EUR">
 *
 *   const tax = 5 as USD;
 *   const usd = 10 as USD;
 *   const eur = 10 as EUR;
 *
 *   function gross(net: USD): USD {
 *     return (net + tax) as USD;
 *   }
 *
 *   // Expect: No compile error
 *   gross(usd);
 *   // Expect: Compile error (Type '"EUR"' is not assignable to type '"USD"'.)
 *   gross(eur);
 */
export type Brand<T, U> = T & { __brand: U };

/**
 * From `T` make a set of properties by key `K` become optional
 * @example
 *    type Props = {
 *      name: string;
 *      age: number;
 *      visible: boolean;
 *    };
 *
 *    // Expect: { name?: string; age?: number; visible?: boolean; }
 *    type Props = Optional<Props>;
 *
 *    // Expect: { name: string; age?: number; visible?: boolean; }
 *    type Props = Optional<Props, 'age' | 'visible'>;
 */
export type Optional<T extends object, K extends keyof T = keyof T> = Omit<
  T,
  K
> &
  Partial<Pick<T, K>>;

/**
 * Get the union type of all the values in an object, array or array-like type `T`
 * @example
 *    type Props = { name: string; age: number; visible: boolean };
 *    // Expect: string | number | boolean
 *    type PropsValues = ValuesType<Props>;
 *
 *    type NumberArray = number[];
 *    // Expect: number
 *    type NumberItems = ValuesType<NumberArray>;
 *
 *    type ReadonlySymbolArray = readonly symbol[];
 *    // Expect: symbol
 *    type SymbolItems = ValuesType<ReadonlySymbolArray>;
 *
 *    type NumberTuple = [1, 2];
 *    // Expect: 1 | 2
 *    type NumberUnion = ValuesType<NumberTuple>;
 *
 *    type ReadonlyNumberTuple = readonly [1, 2];
 *    // Expect: 1 | 2
 *    type AnotherNumberUnion = ValuesType<NumberTuple>;
 *
 *    type BinaryArray = Uint8Array;
 *    // Expect: number
 *    type BinaryItems = ValuesType<BinaryArray>;
 */
export type ValuesType<
  T extends ReadonlyArray<any> | ArrayLike<any> | Record<any, any>,
> =
  T extends ReadonlyArray<any>
    ? T[number]
    : T extends ArrayLike<any>
      ? T[number]
      : T extends object
        ? T[keyof T]
        : never;

/**
 *  From `T` make a set of properties by key `K` become required
 * @example
 *    type Props = {
 *      name?: string;
 *      age?: number;
 *      visible?: boolean;
 *    };
 *
 *    // Expect: { name: string; age: number; visible: boolean; }
 *    type Props = Required<Props>;
 *
 *    // Expect: { name?: string; age: number; visible: boolean; }
 *    type Props = Required<Props, 'age' | 'visible'>;
 */
export type AugmentedRequired<
  T extends object,
  K extends keyof T = keyof T,
> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Get intersection type given union type `U`
 * Credit: jcalz
 * @see https://stackoverflow.com/a/50375286/7381355
 * @example
 *   // Expect: { name: string } & { age: number } & { visible: boolean }
 *   UnionToIntersection<{ name: string } | { age: number } | { visible: boolean }>
 */
export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

/**
 * From `T` make all properties become mutable
 * @example
 *    type Props = {
 *      readonly name: string;
 *      readonly age: number;
 *      readonly visible: boolean;
 *    };
 *
 *    // Expect: { name: string; age: number; visible: boolean; }
 *    Mutable<Props>;
 */
export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

export type Writable<T> = Mutable<T>;

export type Immutable<T> = T extends (...args: any[]) => any
  ? T
  : T extends Map<infer K, infer V>
    ? ReadonlyMap<Immutable<K>, Immutable<V>>
    : T extends Set<infer S>
      ? ReadonlySet<Immutable<S>>
      : T extends object
        ? { readonly [K in keyof T]: Immutable<T[K]> }
        : T;

export type WeakAssert = (input: unknown, message?: string) => void;

export type SubType<Input, Output> = Output extends Input ? Output : never;

type Assert<Input = unknown, Output = Input> = (
  input: Input,
  message?: string,
) => asserts input is SubType<Input, Output>;

type Check<Input = unknown, Output = Input> = (
  input: Input,
) => input is SubType<Input, Output>;

// F_assert
/*  .d8b.  .d8888. .d8888. d88888b d8888b. d888888b */
/* d8' `8b 88'  YP 88'  YP 88'     88  `8D `~~88~~' */
/* 88ooo88 `8bo.   `8bo.   88ooooo 88oobY'    88    */
/* 88~~~88   `Y8b.   `Y8b. 88~~~~~ 88`8b      88    */
/* 88   88 db   8D db   8D 88.     88 `88.    88    */
/* YP   YP `8888Y' `8888Y' Y88888P 88   YD    YP    */

const expectedToBe = (type: string): string => `expected to be ${type}`;

export function assert(condition: any, message?: string): asserts condition {
  if (!condition) {
    throw new TypeError(message ?? "Assertion failed");
  }
}

export function assertUnreachable(
  _input: never,
  message: string = expectedToBe("unreachable"),
): never {
  throw new TypeError(message);
}

export function assertNotNull<T>(
  input: null | T,
  message: string = expectedToBe("not null"),
): asserts input is T {
  assert(input !== null, message);
}

export function assertNotUndefined<T>(
  input: undefined | T,
  message: string = expectedToBe("not undefined"),
): asserts input is T {
  assert(input !== undefined, message);
}

export function assertNotVoid<T>(
  input: T,
  message: string = expectedToBe("neither null nor undefined"),
): asserts input is Exclude<T, undefined | null | undefined> {
  assert(input !== null && input !== undefined, message);
}

export function assertExactly<Input, Output>(
  input: Input,
  value: Output,
  message = expectedToBe(`exactly ${value}`),
): asserts input is SubType<Input, Output> {
  assert((input as unknown) === (value as unknown), message);
}

export function assertBoolean(
  input: unknown,
  message: string = expectedToBe("a boolean"),
): asserts input is boolean {
  assert(typeof input === "boolean", message);
}

export function assertNumber(
  input: unknown,
  message: string = expectedToBe("a number"),
): asserts input is number {
  assert(typeof input === "number", message);
}

export function assertString(
  input: unknown,
  message: string = expectedToBe("a string"),
): asserts input is string {
  assert(typeof input === "string", message);
}

export function assertDate(
  input: unknown,
  message: string = expectedToBe("a Date"),
): asserts input is Date {
  assert(input instanceof Date, message);
}

export function assertRecord(
  input: unknown,
  message: string = expectedToBe("a record"),
): asserts input is Record<string, unknown> {
  assert(typeof input === "object", message);
  assert(!Array.isArray(input), message);
  assertNotNull(input, message);
  for (const key of Object.keys(input as Record<string, unknown>)) {
    assertString(key, message);
  }
}

export function assertRecordWithKeys<K extends string>(
  input: unknown,
  keys: K[],
  message = expectedToBe(`a record with keys ${keys.join(", ")}`),
): asserts input is {
  readonly [Key in K]: unknown;
} {
  assertRecord(input, message);
  for (const key of keys) {
    assertNotUndefined(input[key], message);
  }
}

export function assertArray(
  input: unknown,
  message: string = expectedToBe("an array"),
): asserts input is unknown[] {
  assert(Array.isArray(input), message);
}

export function assertRecordOfType<T>(
  input: unknown,
  assertT: Assert<unknown, T>,
  message = expectedToBe("a record of given type"),
  itemMessage = expectedToBe("of given type"),
): asserts input is Record<string, T> {
  assertRecord(input, message);
  for (const item of Object.values(input)) {
    assertT(item, itemMessage);
  }
}

export function assertArrayOfType<T>(
  input: unknown,
  assertT: Assert<unknown, T>,
  message = expectedToBe("an array of given type"),
  itemMessage = expectedToBe("of given type"),
): asserts input is T[] {
  assertArray(input, message);
  for (const item of input) {
    assertT(item, itemMessage);
  }
}

export function assertOptionOfType<Input, Output>(
  input: Input | undefined,
  assertT: Assert<Input, Output>,
  message = expectedToBe("option of given type"),
): asserts input is SubType<Input, Output | undefined> {
  if (input === undefined) {
    return;
  }
  assertT(input, message);
}

export function assertOneOf<Input, Output>(
  input: Input,
  values: readonly Output[],
  message: string = expectedToBe(`one of ${values.join(", ")}`),
): asserts input is SubType<Input, Output> {
  assert(values.includes(input as SubType<Input, Output>), message);
}

export function assertOneOfType<T>(
  input: unknown,
  assertT: Assert<unknown, T>[],
  message: string = expectedToBe("one of type"),
  itemMessage?: string,
): asserts input is T {
  for (const assert of assertT) {
    try {
      (assert as WeakAssert)(input as T, itemMessage);
      return;
    } catch (_) {}
  }
  throw new TypeError(message);
}

export function assertInstanceOf<T>(
  input: unknown,
  constructor: new (...args: any[]) => T,
  message = expectedToBe("an instance of given constructor"),
): asserts input is T {
  assert(input instanceof constructor, message);
}

export function assertPromise(
  input: unknown,
  message = expectedToBe("a promise"),
): asserts input is Promise<unknown> {
  assertInstanceOf(input, Promise, message);
}

export function check<Input, Output>(
  assertT: Assert<Input, Output>,
): Check<Input, Output> {
  return (input: Input): input is SubType<Input, Output> => {
    try {
      assertT(input);
      return true;
    } catch (_) {
      return false;
    }
  };
}

export function assertFieldsNotEmpty<T, K extends keyof T>(
  value: T,
  fields: K[],
  message: string | ((badProps: K[]) => string),
): asserts value is T & { [Key in K]-?: NonNullable<T[Key]> } {
  const emptyProps = fields.filter((prop) => value[prop] == null);
  if (value == null || emptyProps.length > 0) {
    const msg = typeof message === "function" ? message(emptyProps) : message;
    throw new TypeError(msg);
  }
}

export function mustExist<T>(
  value: T,
  message: string = expectedToBe("not null"),
): NonNullable<T> {
  assertNotVoid(value, message);
  return value as NonNullable<T>;
}

export function cast<T>(obj: any): T {
  return obj as T;
}

// F_checks
/*  .o88b. db   db d88888b  .o88b. db   dD .d8888. */
/* d8P  Y8 88   88 88'     d8P  Y8 88 ,8P' 88'  YP */
/* 8P      88ooo88 88ooooo 8P      88,8P   `8bo.   */
/* 8b      88~~~88 88~~~~~ 8b      88`8b     `Y8b. */
/* Y8b  d8 88   88 88.     Y8b  d8 88 `88. db   8D */
/*  `Y88P' YP   YP Y88888P  `Y88P' YP   YD `8888Y' */

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isFunction(value: unknown): value is Function {
  return typeof value === "function";
}

export function isUndefined(value: unknown): value is undefined {
  return typeof value === "undefined";
}

export function isNull(value: unknown): value is null {
  return value === null;
}

export function isVoid(value: unknown): value is null | undefined {
  return value === null || typeof value === "undefined";
}

export function isNullish(value: unknown): value is Nullish {
  return value == null;
}

export function isFalsy(value: unknown): value is Falsy {
  return !value;
}

export function isExactly<Input, Output>(
  input: Input,
  value: Output,
): input is SubType<Input, Output> {
  return (input as unknown) === (value as unknown);
}

export function isConstructor<T>(
  value: unknown,
): value is new (...args: any[]) => T {
  return typeof value === "function" && "prototype" in value;
}

export function isPrimitive(val: unknown): val is Primitive {
  if (val === null || val === undefined) {
    return true;
  }
  switch (typeof val) {
    case "string":
    case "number":
    case "bigint":
    case "boolean":
    case "symbol": {
      return true;
    }
    default:
      return false;
  }
}

/* d88888b db    db d8b   db  .o88b. */
/* 88'     88    88 888o  88 d8P  Y8 */
/* 88ooo   88    88 88V8o 88 8P      */
/* 88~~~   88    88 88 V8o88 8b      */
/* 88      88b  d88 88  V888 Y8b  d8 */
/* YP      ~Y8888P' VP   V8P  `Y88P' */

/**
 * Runs a function and returns its result.
 * @param fn
 */
export function run<T>(fn: () => T) {
  return fn();
}

export type Result<T, E = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/**
 * Runs a function and catches any errors, logging them to the console.
 * @param fn
 */
export function runSafe<T>(fn: () => T): T | undefined {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.catch((e) => {
        console.error(e);
      }) as T;
    }
    return result;
  } catch (e) {
    console.error(e);
  }
}

/**
 * Runs a function and returns a Result indicating success or failure.
 * @param fn
 */
export function runCatching<T>(
  fn: () => T,
): T extends Promise<infer U> ? Promise<Result<U>> : Result<T> {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(Ok).catch(Err) as any;
    }
    return Ok(result) as any;
  } catch (e) {
    return Err(e) as any;
  }
}

/**
 * Runs a function that may return a Promise, and always returns a Promise.
 * @param fn
 */
export function runAsync<T>(fn: () => T | Promise<T>) {
  const result = fn();
  if (result instanceof Promise) {
    return result;
  }
  return Promise.resolve(result);
}

/* A no-operation function that does nothing. */
export function noop() {}

/* Schedules a callback to run on the next tick of the event loop. */
export function runNextTick(callback: () => void) {
  setTimeout(callback, 0);
}

/* Schedules a callback to run on the next animation frame. */
export function runNextFrame(callback: () => void) {
  requestAnimationFrame(() => runNextTick(callback));
}

/* Runs an asynchronous function without awaiting its result. */
export function runAndForget<T>(callback: () => Promise<T>) {
  callback();
}

/* Gets the constructor of an object. */
export function constructorOf<T extends Object>(ctor: T): ConstructorOf<T> {
  return ctor.constructor as ConstructorOf<T>;
}

/* Gets the constructor of an object. */
export function ConstructorOf<T extends Object>(ctor: T): ConstructorOf<T> {
  return ctor.constructor as ConstructorOf<T>;
}

export function forEach<T>(
  iterable: Iterable<T>,
  callback: (item: T, index: number) => void,
): void {
  let index = 0;
  for (const item of iterable) {
    callback(item, index++);
  }
}

// F_math
/* .88b  d88.  .d8b.  d888888b db   db */
/* 88'YbdP`88 d8' `8b `~~88~~' 88   88 */
/* 88  88  88 88ooo88    88    88ooo88 */
/* 88  88  88 88~~~88    88    88~~~88 */
/* 88  88  88 88   88    88    88   88 */
/* YP  YP  YP YP   YP    YP    YP   YP */

/**
 * Clamp a value between a minimum and maximum value.
 * @param value
 * @param min
 * @param max
 */
export let clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Remap a value from one range to another.
 * @param value
 * @param fromMin
 * @param fromMax
 * @param toMin
 * @param toMax
 */
export function remapRange(
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number,
): number {
  const fromRange = fromMax - fromMin;
  const toRange = toMax - toMin;
  const scaledValue = (value - fromMin) / fromRange;
  return clamp(toMin + scaledValue * toRange, toMin, toMax);
}

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

export const slerp = (a: number, b: number, t: number): number =>
  a + ((b - a) * (1 - Math.cos(t * Math.PI))) / 2;

/**
 * Improved lerp for smoothing that prevents overshoot and is frame rate independent.
 * - from https://theorangeduck.com/page/spring-roll-call
 * @param start - The value to start from. Can be a number or Vector.
 * @param end	- The value to end at. Can be a number or Vector.
 * @param delta - Frame delta time.
 * @param halflife - The half-life of decay (smoothing)
 * @returns If smoothing number, returns the smoothed number. If smoothing Vector, returns void.
 */
export function lerpSmooth(
  start: number,
  end: number,
  delta: number,
  halflife: number,
): number {
  return lerp(start, end, -Math.expm1(-(Math.LN2 * delta) / (halflife + 1e-5)));
}

// F_ease
/* d88888b  .d8b.  .d8888. d88888b */
/* 88'     d8' `8b 88'  YP 88'     */
/* 88ooooo 88ooo88 `8bo.   88ooooo */
/* 88~~~~~ 88~~~88   `Y8b. 88~~~~~ */
/* 88.     88   88 db   8D 88.     */
/* Y88888P YP   YP `8888Y' Y88888P */

/***********************************************************
 Thanks to https://easings.net/
 with love <3
 ************************************************************/

type EasingFunction = (progress: number) => number;

const pow = Math.pow;
const sqrt = Math.sqrt;
const sin = Math.sin;
const cos = Math.cos;
const PI = Math.PI;
const c1 = 1.70158;
const c2 = c1 * 1.525;
const c3 = c1 + 1;
const c4 = (2 * PI) / 3;
const c5 = (2 * PI) / 4.5;

export const linear: EasingFunction = (x) => x;

export const easeInQuad: EasingFunction = (x) => x * x;

export const easeOutQuad: EasingFunction = (x) => 1 - (1 - x) * (1 - x);

export const easeInOutQuad: EasingFunction = (x) =>
  x < 0.5 ? 2 * x * x : 1 - pow(-2 * x + 2, 2) / 2;

export const easeInCubic: EasingFunction = (x) => x * x * x;

export const easeOutCubic: EasingFunction = (x) => 1 - pow(1 - x, 3);

export const easeInOutCubic: EasingFunction = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2;

export const easeInQuart: EasingFunction = (x) => x * x * x * x;

export const easeOutQuart: EasingFunction = (x) => 1 - pow(1 - x, 4);

export const easeInOutQuart: EasingFunction = (x) =>
  x < 0.5 ? 8 * x * x * x * x : 1 - pow(-2 * x + 2, 4) / 2;

export const easeInQuint: EasingFunction = (x) => x * x * x * x * x;

export const easeOutQuint: EasingFunction = (x) => 1 - pow(1 - x, 5);

export const easeInOutQuint: EasingFunction = (x) =>
  x < 0.5 ? 16 * x * x * x * x * x : 1 - pow(-2 * x + 2, 5) / 2;

export const easeInSine: EasingFunction = (x) => 1 - cos((x * PI) / 2);

export const easeOutSine: EasingFunction = (x) => sin((x * PI) / 2);

export const easeInOutSine: EasingFunction = (x) => -(cos(PI * x) - 1) / 2;

export const easeInExpo: EasingFunction = (x) =>
  x === 0 ? 0 : pow(2, 10 * x - 10);

export const easeOutExpo: EasingFunction = (x) =>
  x === 1 ? 1 : 1 - pow(2, -10 * x);

export const easeInOutExpo: EasingFunction = (x) =>
  x === 0
    ? 0
    : x === 1
      ? 1
      : x < 0.5
        ? pow(2, 20 * x - 10) / 2
        : (2 - pow(2, -20 * x + 10)) / 2;

export const easeInCirc: EasingFunction = (x) => 1 - sqrt(1 - pow(x, 2));

export const easeOutCirc: EasingFunction = (x) => sqrt(1 - pow(x - 1, 2));

export const easeInOutCirc: EasingFunction = (x) =>
  x < 0.5
    ? (1 - sqrt(1 - pow(2 * x, 2))) / 2
    : (sqrt(1 - pow(-2 * x + 2, 2)) + 1) / 2;

export const easeInBack: EasingFunction = (x) => c3 * x * x * x - c1 * x * x;

export const easeOutBack: EasingFunction = (x) =>
  1 + c3 * pow(x - 1, 3) + c1 * pow(x - 1, 2);

export const easeInOutBack: EasingFunction = (x) =>
  x < 0.5
    ? (pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
    : (pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;

export const easeInElastic: EasingFunction = (x) =>
  x === 0 ? 0 : x === 1 ? 1 : -pow(2, 10 * x - 10) * sin((x * 10 - 10.75) * c4);

export const easeOutElastic: EasingFunction = (x) =>
  x === 0 ? 0 : x === 1 ? 1 : pow(2, -10 * x) * sin((x * 10 - 0.75) * c4) + 1;

export const easeInOutElastic: EasingFunction = (x) =>
  x === 0
    ? 0
    : x === 1
      ? 1
      : x < 0.5
        ? -(pow(2, 20 * x - 10) * sin((20 * x - 11.125) * c5)) / 2
        : (pow(2, -20 * x + 10) * sin((20 * x - 11.125) * c5)) / 2 + 1;

export const bounceOut: EasingFunction = (x) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) {
    return n1 * x * x;
  }
  if (x < 2 / d1) {
    // biome-ignore lint/suspicious/noAssignInExpressions: performant
    return n1 * (x -= 1.5 / d1) * x + 0.75;
  }
  if (x < 2.5 / d1) {
    // biome-ignore lint/suspicious/noAssignInExpressions: performant
    return n1 * (x -= 2.25 / d1) * x + 0.9375;
  }
  // biome-ignore lint/suspicious/noAssignInExpressions: performant
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};

export const easeInBounce: EasingFunction = (x) => 1 - bounceOut(1 - x);

export const easeOutBounce: EasingFunction = bounceOut;

export const easeInOutBounce: EasingFunction = (x) =>
  x < 0.5 ? (1 - bounceOut(1 - 2 * x)) / 2 : (1 + bounceOut(2 * x - 1)) / 2;

// F_sparse
/* .d8888. d8888b.  .d8b.  d8888b. .d8888. d88888b */
/* 88'  YP 88  `8D d8' `8b 88  `8D 88'  YP 88'     */
/* `8bo.   88oodD' 88ooo88 88oobY' `8bo.   88ooooo */
/*   `Y8b. 88~~~   88~~~88 88`8b     `Y8b. 88~~~~~ */
/* db   8D 88      88   88 88 `88. db   8D 88.     */
/* `8888Y' 88      YP   YP 88   YD `8888Y' Y88888P */

export class SparseSet<T> {
  get size(): number {
    return this.dense.length;
  }

  get first(): T | undefined {
    if (this.size === 0) return undefined;
    return this.components[0];
  }

  add(entity: number, component: T): boolean {
    if (this.has(entity)) return false;
    const index = this.dense.length;
    this.dense.push(entity);
    this.sparse[entity] = index;
    this.components[index] = component;
    return true;
  }

  remove(entity: number) {
    if (!this.has(entity)) return;

    const indexToRemove = this.sparse[entity];
    const lastIndex = this.dense.length - 1;

    if (indexToRemove !== lastIndex) {
      const lastEntity = this.dense[lastIndex];
      this.dense[indexToRemove] = lastEntity;
      this.components[indexToRemove] = this.components[lastIndex];
      this.sparse[lastEntity] = indexToRemove;
    }

    this.dense.pop();
    this.components.pop();
    delete this.sparse[entity];

    if (this.dense.length === 0) {
      this.sparse = [];
    }
  }

  get(entity: number): T | undefined {
    if (!this.has(entity)) return undefined;
    return this.components[this.sparse[entity]];
  }

  has(entity: number): boolean {
    return this.sparse[entity] !== undefined;
  }

  clear() {
    this.dense.length = 0;
    this.components.length = 0;
    this.sparse = [];
  }

  *[Symbol.iterator](): Iterator<[entity: number, component: T]> {
    for (let i = 0; i < this.dense.length; i++) {
      yield [this.dense[i], this.components[i]];
    }
  }

  private sparse: number[] = [];
  private dense: number[] = [];
  private components: T[] = [];
}

// F_auto
/*  .d8b.  db    db d888888b  .d88b.  */
/* d8' `8b 88    88 `~~88~~' .8P  Y8. */
/* 88ooo88 88    88    88    88    88 */
/* 88~~~88 88    88    88    88    88 */
/* 88   88 88b  d88    88    `8b  d8' */
/* YP   YP ~Y8888P'    YP     `Y88P'  */

/**
 * Map which uses a factory to auto-initalize values on key access.
 */
export class AutoMap<K, V> extends Map<K, V> {
  constructor(protected factory: () => V) {
    super();
  }

  override get(key: K): V {
    if (!super.has(key)) {
      this.set(key, this.factory());
    }
    return super.get(key)!;
  }
}

// F_pool
/* d8888b.  .d88b.   .d88b.  db      */
/* 88  `8D .8P  Y8. .8P  Y8. 88      */
/* 88oodD' 88    88 88    88 88      */
/* 88~~~   88    88 88    88 88      */
/* 88      `8b  d8' `8b  d8' 88booo. */
/* 88       `Y88P'   `Y88P'  Y88888P */

interface ObjectPoolOptions<T> {
  /** Initial size of the pool */
  initialSize: number;
  /** Factory function to create new objects */
  createObject: (index: number) => T;
  /** Optional function to reset objects when they are created and freed */
  resetObject?: (object: T) => void;
  /** Optional function to determine how many objects to add when the pool grows */
  growthStrategy?: (currentSize: number) => number;
}

/**
 * A pool of reusable objects to minimize allocations.
 * The pool will automatically grow when needed.
 * @typeParam T The type of objects in the pool.
 * @param options Configuration options for the pool.
 * - initialSize: The initial number of objects in the pool.
 * - createObject: A factory function to create new objects.
 * - resetObject: An optional function to reset objects when they are freed. Also called on initial creation.
 * - growthStrategy: An optional function to determine how many objects to add when the pool grows.
 */
export class ObjectPool<T> {
  constructor(options: ObjectPoolOptions<T>) {
    this.alloc = this.alloc.bind(this);
    this.free = this.free.bind(this);
    this.freeAll = this.freeAll.bind(this);

    if (options.growthStrategy) {
      this.growthStrategy = options.growthStrategy;
    }
    this.createObject = options.createObject;
    this.resetObject = options.resetObject;

    if (options.initialSize < 1) {
      options.initialSize = 1;
    }

    for (let index = 0; index < options.initialSize; index++) {
      const object = this.createObject(index);
      this.resetObject?.(object);
      this.inactive.push(object);
    }
  }

  /** Allocate an object from the pool */
  alloc() {
    let object = this.inactive.pop();
    // No more objects in the pool
    if (!object) {
      const currentSize = this.size;
      let growthAmount = this.growthStrategy(currentSize);
      if (growthAmount < 1) {
        growthAmount = 1;
      }
      for (let index = 0; index < growthAmount; index++) {
        const newObject = this.createObject(currentSize + index);
        this.resetObject?.(newObject);
        this.inactive.push(newObject);
      }
      object = this.inactive.pop()!;
    }
    this.active.add(object);
    return object;
  }

  /** Release an object back into the pool */
  free(object: T) {
    if (this.active.has(object)) {
      this.active.delete(object);
      this.inactive.push(object);
      this.resetObject?.(object);
    }
  }

  /** Release all active objects back into the pool */
  freeAll() {
    for (const activeObject of this.active) {
      this.inactive.push(activeObject);
      this.resetObject?.(activeObject);
    }
    this.active.clear();
  }

  /** Total number of objects managed by the pool */
  get size() {
    return this.inactive.length + this.active.size;
  }

  /** Number of active objects */
  get sizeOfActive() {
    return this.active.size;
  }

  /** Number of inactive objects */
  get sizeOfReserve() {
    return this.inactive.length;
  }

  protected inactive: T[] = [];
  protected active = new Set<T>();
  protected createObject: (index: number) => T;
  protected resetObject?: (object: T) => void;
  protected growthStrategy: (currentSize: number) => number = (it) => it * 2;
}

// F_log
/* db       .d88b.   d888b  */
/* 88      .8P  Y8. 88' Y8b */
/* 88      88    88 88      */
/* 88      88    88 88  ooo */
/* 88booo. `8b  d8' 88. ~8~ */
/* Y88888P  `Y88P'   Y888P  */

export const logColors = {
  purple: [
    [247, 81, 172],
    [55, 0, 231],
  ],
  sunset: [
    [231, 0, 187],
    [255, 244, 20],
  ],
  gray: [
    [150, 150, 150],
    [69, 69, 69],
  ],
  orange: [
    [255, 147, 15],
    [255, 249, 91],
  ],
  lime: [
    [89, 209, 2],
    [243, 245, 32],
  ],
  blue: [
    [31, 126, 161],
    [111, 247, 232],
  ],
  red: [
    [244, 7, 82],
    [249, 171, 143],
  ],
} as const;

export enum LogLevel {
  Debug = 100,
  Info = 200,
  Warn = 300,
  Error = 400,
  Critical = 500,
  Production = 999,
  Silent = 9999,
}

interface Writer {
  message(message: any[]): void;
  debug(message: any[]): void;
  info(message: any[]): void;
  success(message: any[]): void;
  warn(message: any[]): void;
  error(message: any[]): void;
  critical(message: any[]): void;
}

class BasicConsoleWriter implements Writer {
  constructor(private name: string) {}

  message(message: any[]): void {
    console.log(`${performance.now()} [${this.name}]`, ...message);
  }

  debug(message: any[]): void {
    console.debug(`${performance.now()} [${this.name}] DEBUG`, ...message);
  }

  info(message: any[]): void {
    console.info(`${performance.now()} [${this.name}] INFO`, ...message);
  }

  success(message: any[]): void {
    console.log(`${performance.now()} [${this.name}] SUCCESS`, ...message);
  }

  warn(message: any[]): void {
    console.warn(`${performance.now()} [${this.name}] WARN`, ...message);
  }

  error(message: any[]): void {
    console.error(`${performance.now()} [${this.name}] ERROR`, ...message);
  }

  critical(message: any[]): void {
    console.error(`${performance.now()} [${this.name}] CRITICAL`, ...message);
  }
}

// given a start and end color, and a t value between 0 and 1, return the color that is t percent between the start and end color
function interpolateRGB(
  startColor: Readonly<[number, number, number]>,
  endColor: Readonly<[number, number, number]>,
  t: number,
): Readonly<[number, number, number]> {
  if (t < 0) {
    return startColor;
  }
  if (t > 1) {
    return endColor;
  }
  return [
    Math.round(lerp(startColor[0], endColor[0], t)),
    Math.round(lerp(startColor[1], endColor[1], t)),
    Math.round(lerp(startColor[2], endColor[2], t)),
  ];
}

function isBrowser() {
  return (
    //@ts-ignore
    typeof window !== "undefined" && typeof globalThis.Deno === "undefined"
  );
}

function formatAnsi(
  string: string,
  styles: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    foreground?: Readonly<[number, number, number]>;
    background?: Readonly<[number, number, number]>;
  } = {},
): { content: string; styles: never[] } {
  let c = "";
  if (styles.bold) c += "1;";
  if (styles.italic) c += "3;";
  if (styles.underline) c += "4;";
  if (styles.foreground) c += `38;2;${styles.foreground.join(";")};`;
  if (styles.background) c += `48;2;${styles.background.join(";")};`;
  while (c.endsWith(";")) c = c.slice(0, -1);
  return {
    content: `\x1b[${c}m${string}\x1b[0m\x1b[0m`,
    styles: [],
  };
}

function formatBrowser(
  string: string,
  options: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    foreground?: Readonly<[number, number, number]>;
    background?: Readonly<[number, number, number]>;
    size?: number;
  } = {},
) {
  const styles: string[] = [];
  if (options.bold) styles.push("font-weight: bold;");
  if (options.italic) styles.push("font-style: italic;");
  if (options.underline) styles.push("text-decoration: underline;");
  if (options.foreground)
    styles.push(`color: rgb(${options.foreground.join(", ")});`);
  if (options.background)
    styles.push(`background-color: rgb(${options.background.join(", ")});`);
  if (options.size) styles.push(`font-size: ${options.size}px;`);
  return {
    content: `%c${string}`,
    styles: [styles.join("")],
  };
}

function format(
  string: string,
  options = {},
): {
  content: string;
  styles: string[];
} {
  if (isBrowser()) return formatBrowser(string, options);
  return formatAnsi(string, options);
}

function stringGradient(
  str: string,
  gradient: Readonly<
    [Readonly<[number, number, number]>, Readonly<[number, number, number]>]
  >,
  options = {},
): { content: string; styles: string[] } {
  const result = {
    content: "",
    styles: [] as string[],
  };
  if (isBrowser()) {
    result.content = `%c${str.split("").join("%c")}`;
    for (let i = 0; i < str.length; i++) {
      const g = interpolateRGB(gradient[0], gradient[1], i / str.length);
      result.styles.push(
        formatBrowser(str[i], { ...options, foreground: g }).styles[0],
      );
    }
    return result;
  }
  for (let i = 0; i < str.length; i++) {
    result.content += formatAnsi(str[i], {
      ...options,
      foreground: interpolateRGB(gradient[0], gradient[1], i / str.length),
    }).content;
  }
  return result;
}

function _toBool(val: any): boolean {
  return val ? val !== "false" : false;
}

function env(): any {
  // @ts-ignore - Node specific
  return (
    // @ts-ignore - Node specific
    globalThis.process?.env ||
    // @ts-ignore - Deno specific
    import.meta.env ||
    // @ts-ignore - Browser specific
    globalThis.Deno?.env.toObject() ||
    // @ts-ignore - Browser specific
    globalThis.__env__ ||
    globalThis
  );
}

// @ts-ignore - Deno specific
function isWindows(): boolean {
  // @ts-expect-error
  return /^win/i.test(globalThis.process?.platform || "");
}

function hasTTY(): boolean {
  return _toBool(
    // @ts-expect-error
    globalThis.process?.stdout && globalThis.process?.stdout.isTTY,
  );
}

function isColorSupported(): boolean {
  return (
    typeof document !== "undefined" ||
    (!_toBool(env().NO_COLOR) &&
      (_toBool(env().FORCE_COLOR) ||
        ((hasTTY() || isWindows()) && env().TERM !== "dumb")))
  );
}

class FancyConsoleWriter implements Writer {
  formattedName: { content: string; styles: string[] };

  levels: Record<string, { content: string; styles: string[] }>;

  constructor(
    private name: string,
    color: Readonly<
      [Readonly<[number, number, number]>, Readonly<[number, number, number]>]
    >,
  ) {
    this.formattedName = stringGradient(`[ ${this.name} ]`, color);
    this.levels = {
      debug: stringGradient("DEBUG", logColors.gray, { size: 12 }),
      info: stringGradient("INFO", logColors.blue),
      success: stringGradient("SUCCESS", logColors.lime),
      warn: stringGradient("WARN", logColors.orange),
      error: stringGradient("ERROR", logColors.red, { bold: true }),
      critical: format("  CRITICAL  ", {
        background: [255, 0, 0],
        size: 20,
      }),
    };
  }

  message(message: any[]): void {
    console.log(
      `${this.formattedName.content}`,
      ...this.formattedName.styles,
      ...message,
    );
  }

  debug(message: any[]): void {
    console.debug(
      `${this.formattedName.content} ${this.levels.debug.content}`,
      ...this.formattedName.styles,
      ...this.levels.debug.styles,
      ...message,
    );
  }

  info(message: any[]): void {
    console.info(
      `${this.formattedName.content} ${this.levels.info.content}`,
      ...this.formattedName.styles,
      ...this.levels.info.styles,
      ...message,
    );
  }

  success(message: any[]): void {
    console.log(
      `${this.formattedName.content} ${this.levels.success.content}`,
      ...this.formattedName.styles,
      ...this.levels.success.styles,
      ...message,
    );
  }

  warn(message: any[]): void {
    console.warn(
      `${this.formattedName.content} ${this.levels.warn.content}`,
      ...this.formattedName.styles,
      ...this.levels.warn.styles,
      ...message,
    );
  }

  error(message: any[]): void {
    console.error(
      `${this.formattedName.content} ${this.levels.error.content}`,
      ...this.formattedName.styles,
      ...this.levels.error.styles,
      ...message,
    );
  }

  critical(message: any[]): void {
    console.error(
      `${this.formattedName.content} ${this.levels.critical.content}`,
      ...this.formattedName.styles,
      ...this.levels.critical.styles,
      ...message,
    );
  }
}

/**
 * A logging utility class that provides different logging levels and message types.
 * Supports debug, info, success, warning, error, and critical message logging.
 * Can be configured with custom writers and logging levels, and includes support
 * for message filtering based on logger name.
 *
 * @class
 * @param {string} name - The identifier for the logger instance
 * @param {LogLevel} level - The minimum logging level to output
 * @param {Writer} writer - The writer implementation for log output
 */
export class Logger {
  writer: Writer;

  constructor(
    public readonly name: string,
    public level: LogLevel,
    color?: Readonly<
      [Readonly<[number, number, number]>, Readonly<[number, number, number]>]
    >,
  ) {
    this.writer = isColorSupported()
      ? new FancyConsoleWriter(name ?? "App", color ?? logColors.purple)
      : new BasicConsoleWriter(name ?? "App");
  }

  /**
   * Log a message.
   */
  message = (...msg: any[]): void => {
    this.writer.message(msg);
  };

  log = this.message;

  /**
   * Log a message for debugging purposes.
   * @param  {...any} msg
   * @returns void
   */
  debug = (...msg: any[]) => {
    this.level <= LogLevel.Debug && this.writer.debug(msg);
  };

  /**
   * Log a message that provides non critical information for the user.
   * @param  {...any} msg
   * @returns void
   */

  info = (...msg: any[]) => {
    this.level <= LogLevel.Info && this.writer.info(msg);
  };
  /**
   * Log a message that indicates a successful operation to the user.
   * @param  {...any} msg
   * @returns void
   */

  success = (...msg: any[]) => {
    this.level <= LogLevel.Info && this.writer.success(msg);
  };

  /**
   * Log a message that indicates a warning to the user.
   * @param  {...any} msg
   * @returns void
   */
  warn = (...msg: any[]) => {
    this.level <= LogLevel.Warn && this.writer.warn(msg);
  };

  /**
   * Log a message that indicates an error to the user.
   * @param  {...any} msg
   * @returns void
   */
  error = (...msg: any[]) => {
    this.level <= LogLevel.Error && this.writer.error(msg);
  };

  /**
   * Log a message that indicates a critical error to the user.
   * @param  {...any} msg
   * @returns void
   */
  critical = (...msg: any[]) => {
    this.level <= LogLevel.Critical && this.writer.critical(msg);
  };
}

export const silentLogger = new Logger("", LogLevel.Silent);

// F_composite
/*  .o88b.  .d88b.  .88b  d88. d8888b.  .d88b.  .d8888. d888888b d888888b d88888b */
/* d8P  Y8 .8P  Y8. 88'YbdP`88 88  `8D .8P  Y8. 88'  YP   `88'   `~~88~~' 88'     */
/* 8P      88    88 88  88  88 88oodD' 88    88 `8bo.      88       88    88ooooo */
/* 8b      88    88 88  88  88 88~~~   88    88   `Y8b.    88       88    88~~~~~ */
/* Y8b  d8 `8b  d8' 88  88  88 88      `8b  d8' db   8D   .88.      88    88.     */
/*  `Y88P'  `Y88P'  YP  YP  YP 88       `Y88P'  `8888Y' Y888888P    YP    Y88888P */

class CompositeMapStorage<T> {
  children = new Map<any, CompositeMapStorage<T>>();
  value?: T;
  set = false;
}

export class CompositeMap<T> {
  #storage = new CompositeMapStorage<T>();

  constructor() {
    this.entries = this.entries.bind(this);
    this.keys = this.keys.bind(this);
    this[Symbol.iterator] = this[Symbol.iterator].bind(this);
  }

  set = (key: any[], value: T): CompositeMap<T> => {
    let current = this.#storage;
    for (const k of key) {
      if (!current.children.get(k)) {
        current.children.set(k, new CompositeMapStorage());
      }
      current = current.children.get(k)!;
    }
    current.value = value;
    current.set = true;
    return this;
  };

  get = (key: any[]): T | undefined => {
    let current = this.#storage;
    for (const k of key) {
      const next = current.children.get(k);
      if (!next) return;
      current = next;
    }
    return current.value;
  };

  has = (key: any[]): boolean => {
    let current = this.#storage;
    for (const k of key) {
      const next = current.children.get(k);
      if (!next) return false;
      current = next;
    }
    return current.set;
  };

  delete = (key: any[]) => {
    let current = this.#storage;
    for (const k of key) {
      const next = current.children.get(k);
      if (!next) return false;
      current = next;
    }
    current.value = undefined;
    current.set = false;
  };

  clear = () => {
    this.#storage = new CompositeMapStorage();
  };

  forEach = (
    callback: (value: T, key: any[], map: CompositeMap<T>) => void,
  ) => {
    for (const [key, value] of this.entries()) {
      callback(value, key, this);
    }
  };

  *entries(): IterableIterator<[key: any[], value: T]> {
    yield* this.#traverse(this.#storage, []);
  }

  *keys(): IterableIterator<any[]> {
    for (const [key] of this.entries()) {
      yield key;
    }
  }

  *[Symbol.iterator](): IterableIterator<[key: any[], value: T]> {
    yield* this.entries();
  }

  *#traverse(
    storage: CompositeMapStorage<T>,
    currentPath: any[],
  ): IterableIterator<[key: any[], value: T]> {
    if (storage.set && storage.value !== undefined) {
      yield [currentPath, storage.value];
    }
    for (const [key, childStorage] of storage.children) {
      yield* this.#traverse(childStorage, [...currentPath, key]);
    }
  }
}

class EmptySet extends Set<any> {
  add(value: any): this {
    return this;
  }
}

export const EMPTY_SET = new EmptySet();

// F_clock
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

// F_asset
/*  .d8b.  .d8888. .d8888. d88888b d888888b */
/* d8' `8b 88'  YP 88'  YP 88'     `~~88~~' */
/* 88ooo88 `8bo.   `8bo.   88ooooo    88    */
/* 88~~~88   `Y8b.   `Y8b. 88~~~~~    88    */
/* 88   88 db   8D db   8D 88.        88    */
/* YP   YP `8888Y' `8888Y' Y88888P    YP    */

export class Handle<T> {
  constructor(asset: Res<AssetInstance<T>>) {
    this.#asset = asset;
  }

  get pending() {
    return this.#asset.tryDeref()?.pending ?? false;
  }

  get promise() {
    return this.#asset.tryDeref()?.promise ?? Promise.reject(Err("Disposed"));
  }

  get error() {
    const data = this.#asset.tryDeref()?.data;
    if (data?.ok) return null;
    else return data?.error;
  }

  get ready() {
    const a = this.#asset.tryDeref();
    return a?.data?.ok ?? false;
  }

  get ptr(): Readonly<AssetInstance<T>> | null {
    return this.#asset.tryDeref();
  }

  get() {
    const a = this.#asset.deref();
    if (a.pending) {
      throw Error("Asset is pending");
    }
    if (!a.data?.ok) {
      throw Error("Asset has errored");
    }
    return a.data.value;
  }

  tryGet() {
    const a = this.#asset.deref();
    if (a.pending || !a.data?.ok) {
      return null;
    }
    return a.data.value;
  }

  dispose() {
    this.#asset.dispose();
  }

  #asset: Res<AssetInstance<T>>;
}

export interface AssetType<T extends any = unknown> {
  path: string;
  load(signal: AbortSignal): Promise<T>;
  destroy?(instance: T): void;
}

type AssetInstance<T> = {
  data: Result<T> | null;
  promise: Promise<Result<T>>;
  pending: boolean;
  controller: AbortController;
  type: AssetType;
};

export class Assets {
  #resources = new Resources();

  load<T>(asset: AssetType<T>): Handle<T> {
    return new Handle(
      this.#resources.add(
        asset.path,
        this.#load(asset, this.#resources.tryGet<AssetInstance<T>>(asset.path)),
      ),
    );
  }

  getOrLoad<T>(asset: AssetType<T>): Handle<T> {
    const instance = this.#resources.tryGet<AssetInstance<T>>(asset.path);
    if (instance) return new Handle(instance);

    return new Handle(this.#resources.add(asset.path, this.#load(asset, null)));
  }

  get<T>(asset: AssetType<T>): Handle<T> {
    const instance = this.#resources.tryGet<AssetInstance<T>>(asset.path);
    if (!instance) throw Error(`Asset ${asset.path} does not exist`);
    return new Handle(instance);
  }

  tryGet<T>(asset: AssetType<T>): Handle<T> | null {
    const instance = this.#resources.tryGet<AssetInstance<T>>(asset.path);
    if (!instance) return null;
    return new Handle(instance);
  }

  clone<T>(handle: Handle<T>): Handle<T> {
    return this.get(handle.ptr!.type) as Handle<T>;
  }

  #load<T>(
    asset: AssetType<T>,
    oldRes: Res<AssetInstance<T>> | null,
  ): AssetInstance<T> {
    const old = oldRes?.tryDeref();

    if (old?.pending) {
      old.controller.abort();
    }

    const assetInstance: Omit<AssetInstance<T>, "promise"> &
      Partial<AssetInstance<T>> = {
      data: old?.data ?? null,
      pending: true,
      controller: new AbortController(),
      type: asset,
    };

    assetInstance.promise = runCatching(async () => {
      const data = await asset.load(assetInstance.controller.signal);
      if (assetInstance.controller.signal.aborted) {
        throw Error("Aborted");
      }
      if (old?.data?.ok) {
        try {
          asset.destroy?.(old.data.value);
        } catch {}
      }
      return data;
    }).finally(() => {
      assetInstance.pending = false;
    });

    return <AssetInstance<T>>assetInstance;
  }
}

// F_events
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

export const eventWriterTag = Symbol.for("EventWriterTag");
export function EvWriter<T extends Event<any>>(event: T) {
  return { [eventWriterTag]: true, event };
}

export const eventReaderTag = Symbol.for("EventReaderTag");
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

// F_trigger
/* d888888b d8888b. d888888b  d888b   d888b  d88888b d8888b. */
/* `~~88~~' 88  `8D   `88'   88' Y8b 88' Y8b 88'     88  `8D */
/*    88    88oobY'    88    88      88      88ooooo 88oobY' */
/*    88    88`8b      88    88  ooo 88  ooo 88~~~~~ 88`8b   */
/*    88    88 `88.   .88.   88. ~8~ 88. ~8~ 88.     88 `88. */
/*    YP    88   YD Y888888P  Y888P   Y888P  Y88888P 88   YD */

type TriggerResponder<T extends readonly ConstructorOf<Object>[] = []> = (
  ...args: {
    [K in keyof T]: T[K] extends NumberConstructor
      ? number
      : T[K] extends StringConstructor
        ? string
        : T[K] extends BooleanConstructor
          ? boolean
          : InstanceOf<T[K]>;
  }
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

// F_resource
/* d8888b. d88888b .d8888. */
/* 88  `8D 88'     88'  YP */
/* 88oobY' 88ooooo `8bo.   */
/* 88`8b   88~~~~~   `Y8b. */
/* 88 `88. 88.     db   8D */
/* 88   YD Y88888P `8888Y' */

type ResPtr<T = unknown> = {
  data: T | undefined;
  valid: boolean;
  refCount: number;
  key: any;
};

export class Res<T = unknown> {
  #ptr: ResPtr<T>;
  #disposed = false;
  #res: Resources;

  private constructor(
    res: Resources,
    ptr: ResPtr<T>,
    disposalFn: VoidFunction,
  ) {
    this.#ptr = ptr;
    this.#res = res;
    this.dispose = () => {
      if (this.#disposed) {
        return;
      }
      this.#disposed = true;
      disposalFn();
    };
  }

  deref(): T {
    if (this.#disposed) {
      throw new Error("Resource handle has been disposed");
    }
    if (!this.#ptr.valid) {
      throw new Error("Resource has been invalidated");
    }
    return this.#ptr.data!;
  }

  tryDeref(): T | null {
    if (!this.#ptr.valid || this.#disposed) {
      return null;
    }
    return this.#ptr.data!;
  }

  unwrap(): T | null {
    return this.#ptr.data ?? null;
  }

  clone(): Res<T> {
    return this.#res.clone(this);
  }

  /** @internal */
  get ptr(): Readonly<ResPtr<T>> {
    return this.#ptr;
  }

  readonly dispose: VoidFunction;
}

export class Resources {
  #storage = new Map<any, ResPtr>();

  #registry = new FinalizationRegistry<{ key: any; ptr: ResPtr }>((ctx) => {
    this.#decrement(ctx.key, ctx.ptr);
  });

  create<T, Args extends any[]>(
    key: ConstructorOf<T, Args>,
    ...args: Args
  ): Res<T> {
    if (this.#storage.has(key)) {
      const ptr = <ResPtr<T>>this.#storage.get(key);

      try {
        (ptr.data as any)?.destructor?.();
      } catch (e) {}

      ptr.data = isConstructor(key) ? new key(...args) : key;
      ptr.valid = true;

      return this.#createResource(key, ptr);
    }

    const ptr: ResPtr<T> = {
      data: isConstructor(key) ? new key(...args) : key,
      valid: true,
      refCount: 1,
      key,
    };
    this.#storage.set(key, ptr);

    return this.#createResource(key, ptr);
  }

  add<T>(key: any, value: T): Res<T> {
    if (this.#storage.has(key)) {
      const ptr = <ResPtr<T>>this.#storage.get(key);

      try {
        (ptr.data as any)?.destructor?.();
      } catch (e) {}

      ptr.data = value;
      ptr.valid = true;

      return this.#createResource(key, ptr);
    }

    const ptr: ResPtr<T> = {
      data: value,
      valid: true,
      refCount: 1,
      key,
    };
    this.#storage.set(key, ptr);

    return this.#createResource(key, ptr);
  }

  get<T = unknown>(key: any): Res<T> {
    const ptr = this.#storage.get(key);
    if (!ptr) {
      throw Error(`No Resource for key (${key}) available`);
    }
    ptr.refCount++;
    return this.#createResource(key, <ResPtr<T>>ptr);
  }

  tryGet<T = unknown>(key: any): Res<T> | null {
    const ptr = this.#storage.get(key);
    if (!ptr) {
      return null;
    }
    ptr.refCount++;
    return this.#createResource(key, <ResPtr<T>>ptr);
  }

  clone<T>(res: Res<T>): Res<T> {
    return this.get<T>(res.ptr.key);
  }

  unwrap<T = unknown>(key: any) {
    return this.#storage.get(key);
  }

  #createResource<T>(key: any, ptr: ResPtr<T>): Res<T> {
    const token = {};

    // @ts-expect-error private constructor is module scoped
    const resource = new Res<T>(this, ptr, () => {
      this.#registry.unregister(token);
      this.#decrement(key, ptr);
    });

    this.#registry.register(resource, { key, ptr }, token);

    return resource;
  }

  #decrement(key: any, ptr: ResPtr) {
    ptr.refCount--;

    if (ptr.refCount === 0) {
      this.#destroy(ptr);
      if (this.#storage.get(key) === ptr) {
        this.#storage.delete(key);
      }
    }
  }

  #destroy(ptr: ResPtr) {
    if (!ptr.valid) return;

    try {
      (ptr.data as any)?.destructor?.();
    } catch (e) {}

    ptr.valid = false;
    ptr.data = undefined;
  }
}
