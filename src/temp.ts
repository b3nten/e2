import { Resources } from "./core";

class Foo {
  constructor(private bar: string){}
}

class LOL {}

const bar = {
  baz: 1
}

const r = new Resources;

const foo = r.create(Foo, "lol")

const lol = r.create(LOL)

const foo2 = r.add("SOME_KEY", new Foo("lol"))
const b = r.add("key2", bar)
