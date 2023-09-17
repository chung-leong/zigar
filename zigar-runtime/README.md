
## Feautures

* Support for non-standard integer types (i29, u128, etc.)
* Support for non-standard float types (f16, f80, f128)
* Support for structs, including packed structs
* Support for different types of unions
* Support for optional and error union
* Subclassing of error sets
* Correct handling of pointers
* Automatic provisioning of memory allocator

## Calling Zig functions

Simply import a .zig file. All public functions contained in the file will be available:

```zig
// hello.zig
const std = @import("std");

pub fn hello() void {
    std.debug.print("Hello world", .{});
}
```
```js
// hello.js
import { hello } from './hello.zig';

hello();

// console output:
// Hello world
```

Functions can also be called from the default export:

```js
// default-hello.js
import module from './hello.zig';

module.hello();

// console output:
// Hello world
```

Numeric and boolean arguments are passed normally:

```zig
// area.zig
const std = @import("std");

pub fn getArea(radius: f64) f64 {
    return radius * radius * std.math.pi;
}

pub fn getOpposite(value: bool) bool {
    return !value;
}
```
```js
// area.js
import { getArea, getOpposite } from './area.zig';

console.log(getArea(5), getOpposite(true));

// console output:
// 78.53981633974483 false
```

String can be passed into a function normally:

```zig
// hello-name.zig
const std = @import("std");

pub fn hello(name: []const u8) void {
    std.debug.print("Hello, {s}!", .{name});
}
```
```js
// hello-name.js
import { hello } from './hello-name.zig';

hello('Bigus');

// console output:
// Hello, Bigus!
```

A function that returns a string would need an allocator:

```zig
// greeting.zig
const std = @import("std");

pub fn getGreeting(allocator: std.mem.Allocator, name: []const u8) ![]const u8 {
    return std.fmt.allocPrint(allocator, "Hello, {s}!", .{name});
}
```
``` js
// greeting.js
import { getGreeting } from './greeting.zig';

const greeting = getGreeting('Bigus');
console.log(`${greeting}`);
console.log(greeting.string);
console.log([ ...greeting ]);

// console output:
// [object []const u8]
// Hello, Bigus!
// [
//     72, 101, 108, 108, 111,
//     44,  32,  66, 105, 103,
//    117, 115,  33
// ]
```

Zigar will automatically provide the allocator. It allocates memory from the JavaScript engine in the
form of `ArrayBuffer`. The allocator should only be used for returning data to the caller and not other purposes, as it is not able to free memory (discarded blocks must await garbaged collection).

The Zig slice `[]const u8` is represented by an object on the JavaScript side by an object. To get
the actual text string you have to access its `string` property.

Functions returning error unions will throw when errors returned:

```zig
// add-error.zig
pub const MathError = error{
    UnexpectedSpanishInquisition,
    RecordIsScratched,
};

pub fn add(a: i32, b: i32) !i32 {
    if (a == 0 or b == 0) {
        return MathError.UnexpectedSpanishInquisition;
    }
    return a + b;
}
```
```js
import { add, MathError } from './add-error.zig';

console.log(add(1, 2));
try {
  add(0, 1);
} catch (err) {
  console.error(err);
  console.log(err instanceof MathError);
}

// console output:
// 3
// [error{UnexpectedSpanishInquisition,RecordIsScratched} [Error]: Unexpected spanish inquisition]
// true
```

Zigar will automatically generate an error message by "decamelizing" the error name, as shown in
the example above.

Functions returning optionals will return `null` when no value is present:

```zig
// optional-number.zig
pub fn getNumber(really: bool) ?i32 {
    if (!really) {
        return null;
    }
    return 43;
}
```
```js
// optional-number.js
import { getNumber } from './optional-number.zig';

console.log(getNumber(true), getNumber(false));

// console output:
// 43 null
```

Functions that accepts enum as arguments can accept strings:

```zig
// print-enum.zig
const std = @import("std");

pub const Pet = enum {
    Dog,
    Cat,
    Snake,
    Chicken,
};

pub fn printTag(tag: Pet) void {
    std.debug.print("{s}: {d}\n", .{ @tagName(tag), @intFromEnum(tag) });
}
```
```js
// print-enum.js
import { printTag } from './print-enum.zig';

printTag('Dog');
printTag('Chicken');
try {
  printTag('Cow');
} catch (err) {
  console.error(err);
}

// console output:
// Dog: 0
// Chicken: 3
// TypeError: Enum item of the type Pet expected, received Cow
```

You can also use items from an exported enum set:

```js
// print-enum-from-set.js
import { printTag, Pet } from './print-enum.zig';

printTag(Pet.Dog);
printTag(Pet.Cat);
printTag(Pet.Snake);

console.log(Pet.Dog instanceof Pet);

// console output:
// Dog: 0
// Cat: 1
// Snake: 2
// true
```

Function that take structs or unions as arguments will accept object initializers:

```zig
// print-struct.zig
const std = @import("std");

pub const StructA = struct {
    number1: i16,
    number2: i16,
};

pub const StructB = struct {
    a: ?StructA,
    number3: f64,
};

pub fn printStruct(s: StructB) void {
    std.debug.print("{any}\n", .{s});
}
```
```js
// print-struct.js
import { printStruct } from './print-struct.zig';

printStruct({ a: { number1: 123, number2: 456 }, number3: 77 });
printStruct({ a: null, number3: 77 });

// console output:
// print-struct.StructB{ .a = print-struct.StructA{ .number1 = 123, .number2 = 456 }, .number3 = 7.7e+01 }
// print-struct.StructB{ .a = null, .number3 = 7.7e+01 }
```

Fields can be omitted when they have default values:

```zig
// print-struct-defaults.zig
const std = @import("std");

pub const StructA = struct {
    number1: i16 = 1,
    number2: i16 = 2,
};

pub const StructB = struct {
    a: ?StructA = null,
    number3: f64 = 3,
};

pub fn printStruct(s: StructB) void {
    std.debug.print("{any}\n", .{s});
}
```
```js
// print-struct-defaults.js
import { printStruct } from './print-struct-defaults.zig';

printStruct({ a: {}, number3: 77 });
printStruct({ number3: 77 });

// console output:
// print-struct-defaults.StructB{ .a = print-struct-defaults.StructA{ .number1 = 1, .number2 = 2 }, .number3 = 7.7e+01 }
// print-struct-defaults.StructB{ .a = null, .number3 = 7.7e+01 }
```

Functions with pointer arguments can accept certain JavaScript objects directly. The mapping goes as
follows:

| Zig pointer type | JavaScript object types                           |
|------------------|---------------------------------------------------|
| `[]u8`, `*u8`    | `ArrayBuffer`, `Uint8Array`, `Buffer`, `DataView` |
| `[]i8`, `*i8`    | `Int8Array`, `DataView`                           |
| `[]u16`, `*u16`  | `Unt16Array`, `DataView`                          |
| `[]i16`, `*i16`  | `Int16Array`, `DataView`                          |
| `[]u32`, `*u32`  | `Uint32Array`, `DataView`,                        |
| `[]i32`, `*i32`  | `Int32Array`, `DataView`,                         |
| `[]u64`, `*u64`  | `BigUint64Array`, `DataView`,                     |
| `[]i64`, `*i64`  | `BigInt64Array`, `DataView`,                      |
| `[]f32`, `*f32`  | `Float32Array`, `DataView`,                       |
| `[]f64`, `*f64`  | `Float64Array`, `DataView`,                       |

The following example exports a number of functions, each of which sets all elements of a slice to
a particular value:

```zig
// memset.zig
fn createSetFn(comptime T: type) fn ([]T, T) void {
    const S = struct {
        fn set(slice: []T, value: T) void {
            @memset(slice, value);
        }
    };
    return S.set;
}

pub const setU8 = createSetFn(u8);
pub const setI8 = createSetFn(i8);
pub const setU16 = createSetFn(u16);
pub const setI16 = createSetFn(i16);
pub const setU32 = createSetFn(u32);
pub const setI32 = createSetFn(i32);
pub const setU64 = createSetFn(u64);
pub const setI64 = createSetFn(i64);
pub const setF32 = createSetFn(f32);
pub const setF64 = createSetFn(f64);
```
```js
// memset.js
import {
  setU8, setI8,
  setU16, setI16,
  setU32, setI32,
  setU64, setI64,
  setF32, setF64,
} from './memset.zig';

const u8Array = new Uint8Array(4);
const i8Array = new Int8Array(4);
const u16Array = new Uint16Array(4);
const i16Array = new Int16Array(4);
const u32Array = new Uint32Array(4);
const i32Array = new Int32Array(4);
const u64Array = new BigUint64Array(4);
const i64Array = new BigInt64Array(4);
const f32Array = new Float32Array(4);
const f64Array = new Float64Array(4);

setU8(u8Array, 1);
console.log([ ...u8Array ]);
setU8(u8Array.buffer, 2); // ArrayBuffer
console.log([ ...u8Array ]);
setU8(new DataView(u8Array.buffer), 3); // DataView
console.log([ ...u8Array ]);
setI8(i8Array, 4);
console.log([ ...i8Array ]);
setU16(u16Array, 5);
console.log([ ...u16Array ]);
setI16(i16Array, 6);
console.log([ ...i16Array ]);
setU32(u32Array, 7);
console.log([ ...u32Array ]);
setI32(i32Array, 8);
console.log([ ...i32Array ]);
setU64(u64Array, 9n);
console.log([ ...u64Array ]);
setI64(i64Array, 10n);
console.log([ ...i64Array ]);
setF32(f32Array, 0.25);
console.log([ ...f32Array ]);
setF64(f64Array, 3.14);
console.log([ ...f64Array ]);

// console output:
// [ 1, 1, 1, 1 ]
// [ 2, 2, 2, 2 ]
// [ 3, 3, 3, 3 ]
// [ 4, 4, 4, 4 ]
// [ 5, 5, 5, 5 ]
// [ 6, 6, 6, 6 ]
// [ 7, 7, 7, 7 ]
// [ 8, 8, 8, 8 ]
// [ 9n, 9n, 9n, 9n ]
// [ 10n, 10n, 10n, 10n ]
// [ 0.25, 0.25, 0.25, 0.25 ]
// [ 3.14, 3.14, 3.14, 3.14 ]
```

Functions with slice pointer arguments can also accept slice initializers in lieu of a slice object.
We have already such usage in an earlier example:

```zig
// hello-name.zig
const std = @import("std");

pub fn hello(name: []const u8) void {
    std.debug.print("Hello, {s}!", .{name});
}
```
```js
// hello-name.js
import { hello } from './hello-name.zig';

hello('Bigus');

// console output:
// Hello, Bigus!
```

Here's we are using a string to initialize a temporary slice of `u8`. An array of number would also
work:

```js
// hello-name-array.js
import { hello } from './hello-name.zig';

hello([ 66, 111, 98 ]);

// console output:
// Hello, Bob!
```

A generator would work too:

```js
// hello-name-generator.js
import { hello } from './hello-name.zig';

function *alphabet() {
  for (let c = 'A'.charCodeAt(0); c < 'Z'.charCodeAt(0) + 1; c++) {
    yield c;
  }
}

hello(alphabet());

// console output:
// Hello, ABCDEFGHIJKLMNOPQRSTUVWXYZ!
```

The usage above basically only make sense for const slices, where the slice pointer represents a
variable-length array and isn't being used to point to something. A warning will probably be
triggered in the future when a non-const pointer is initialized in this fashion.

Single pointers do not work in the same way:

```zig
// struct-pointer.zig
const std = @import("std");

const StructA = struct {
    dog: i32,
    cat: i32,
};

pub fn printStruct(s: *const StructA) void {
    std.debug.print("{any}\n", .{s.*});
}
```
```js
// struct-pointer.js
import { printStruct } from './struct-pointer.zig';

try {
  printStruct({ dog: 123, cat: 456 });
} catch (err) {
  console.error(err);
}

// console output:
// *StructA cannot point to an object
```

Unlike a slice pointer, a single pointer does not automatically create its own target. `*StructA` only
accepts a `StructA` object. As the type is not public, the above example is actually unusable. We
have no means to create a `StructA` or cast a memory buffer into one.

## Calling methods

As in Zig, a function attached to a struct can be invoked as an instance method if it first argument
is itself:

```zig
// person-print.zig
const std = @import("std");

const Gender = enum { Male, Female, Other };

pub const Person = struct {
    name: []const u8,
    gender: Gender,
    age: i32,
    psycho: bool = false,

    pub fn print(self: Person) void {
        std.debug.print("Name: {s}\n", .{self.name});
        std.debug.print("Gender: {s}\n", .{@tagName(self.gender)});
        std.debug.print("Age: {d}\n", .{self.age});
        std.debug.print("Psycho: {s}\n", .{if (self.psycho) "Yes" else "No"});
    }
};
```
```
// person-print.js
import { Person } from './person-print.zig';

const person = new Person({
  name: 'Amber',
  gender: 'Female',
  age: 37,
  psycho: true,
});
person.print();

// console output:
// Name: Amber
// Gender: Female
// Age: 37,
// Psycho: Yes
```

It call also be called like a regular function:

```
// person-print-not-method.js
import { Person } from './person-print.zig';

const person = new Person({
  name: 'Amber',
  gender: 'Female',
  age: 37,
  psycho: true,
});
Person.print(person);

// console output:
// Name: Amber
// Gender: Female
// Age: 37,
// Psycho: Yes
```

## Casting

Zigar allows you to cast a JavaScript memory buffer into a Zig structure using the following syntax:

```zig
// struct.zig
pub const StructA = struct {
    dog: i32,
    cat: i32,
};
```
```js
// struct.js
import { StructA } from './struct.zig';

const buffer = new ArrayBuffer(8);
const struct = StructA(buffer);
struct.dog = 123;
struct.cat = 456;
const view = new DataView(buffer);
console.log(view.getInt32(0, true), view.getInt32(4, true));

// console output:
// 123 456
```

Casting creates a object without allocating new memory for it. Note how the `new` operator is not used.

## Working with pointers

Pointers are represented in JavaScript by pointer objects. As in Zig, they provide one-level of
automatic dereferencing:

```zig
// struct-pointer.zig
pub const StructA = struct {
    dog: i32,
    cat: i32,
};

pub const StructAPtr = *StructA;
pub const StructAConstPtr = *const StructA;
```
```js
// struct-pointer.js
import { StructA, StructAPtr, StructAConstPtr } from './struct-pointer.zig';

const object = new StructA({ dog: 123, cat: 456 });
const ptr = new StructAPtr(object);
console.log(ptr.dog, ptr.cat);
ptr.dog = 1111;
ptr.cat = 3333;
const constPtr = new StructAConstPtr(object);
console.log(constPtr.dog, constPtr.cat);
try {
  constPtr.dog = 0;
} catch (err) {
  console.error(err);
}

// console output:
// 123 456
// 1111 3333
// [TODO]
```

You can get the object that a pointer points to by accessing its '*' property:

```js
// struct-pointer-deref.js
import { StructA, StructAPtr } from './struct-pointer.zig';

const object = new StructA({ dog: 123, cat: 456 });
const ptr = new StructAPtr(object);
const target = ptr['*'];

console.log(object === target);

// console output:
// true
```

Assignment to the '*' property alters the pointer's target:

```js
// struct-pointer-assignment.js
import { StructA, StructAPtr } from './struct-pointer.zig';

const object = new StructA({ dog: 123, cat: 456 });
const ptr = new StructAPtr(object);
ptr['*'] = { dog: 1111, cat: 3333 };
console.log(object.dog, object.cat);

// console output:
// 1111 3333
```

## Working with slices

Zigar uses a pair of classes to handle slice pointers, one representing the pointer itself, and the
other representing the variable-length array it points to:

```zig
// slice-u16.zig
pub const Uint16Slice = []u16;
```
```js
// slice-u16.js
import { Uint16Slice } from './slice-u16.zig';

console.log(Uint16Slice.name, Uint16Slice.child.name);

// console output:
// []u16 [_]u16
```

`[_]u16` is not a real type in Zig. It's just a name used by Zigar.

While the constructor of a single pointer only accepts an object of the type it points to, the
constructor of a slice pointer also accepts slice initializers:

```js
// slice-u16-init.js
import { Uint16Slice } from './slice-u16.zig';

const slice1 = new Uint16Slice('Hello');
// this performs the same action more verbosely
const slice2 = new Uint16Slice(new Uint16Slice.child('Hello'));
console.log(slice1.string, slice2.string);

// console output:
// Hello Hello
```

Assign to the '*' property of the slice point to alter the slice:

```js
// slice-u16-assignment.js
import { Uint16Slice } from './slice-u16.zig';

const slice = new Uint16Slice('Hello');
slice['*'] = 'World';
console.log(slice.string);
try {
  slice['*'] = 'World!!!';
} catch (err) {
  console.error(err);
}

// console output:
// World
// TypeError: [_]u16 has 10 bytes, received 16
```

Note how you cannot change the length of a slice once it's been created. A new slice would need to
be created:

```js
// slice-u16-reinit.js
import { Uint16Slice } from './slice-u16.zig';

const slice = new Uint16Slice('Hello');
const oldTarget = slice['*'];
console.log(slice.string);
slice.$ = 'World!!!';
const newTarget = slice['*'];
console.log(slice.string);
console.log(oldTarget === newTarget);

// console output:
// Hello
// World!!!
// false
```

The dollar sign property represents an object's value. Assignment to it reinitialize an object. We
need to use '$' here because the slice is in a standalone variable. When the slice is in a struct,
we can assign to it directly:

```zig
// struct-with-slice.zig
pub const StructB = struct {
    text: []u16,
};
```
```js
// struct-with-slice.js
import { StructB } from './struct-with-slice.zig';

const object = new StructB({ text: 'Hello' });
console.log(object.text.string);
object.text = 'World';
console.log(object.text.string);

// console output:
// Hello
// World
```

Zigar uses [JavaScript proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
to enable the use of the bracket operator on arrays and slices. Proxy is notoriously slow.
In general, accessing the elements of a slice through its iterator is much more performant:

```js
// slice-u16-loop.js
import { Uint16Slice } from './slice-u16.zig';

const slice = new Uint16Slice('Привет!');

console.time('iterator');
for (let i = 0; i < 100000; i++) {
  for (const cp of slice) {
    if (i === 0) {
      console.log(cp.toString(16));
    }
  }
}
console.timeEnd('iterator');

console.time('bracket');
for (let i = 0; i < 100000; i++) {
  for (let j = 0; j < slice.length; j++) {
    const cp = slice[j];
    if (i === 0) {
      console.log(cp.toString(16));
    }
  }
}
console.timeEnd('bracket');

// console output:
// 41f
// 440
// 438
// 432
// 435
// 442
// 21
// iterator: 103.059ms
// 41f
// 440
// 438
// 432
// 435
// 442
// 21
// bracket: 840.617ms
```

If you need to access a large slice non-sequentially, you can use its `get` and `set` methods:

```js
// slice-u16-loop-reverse.js
import { Uint16Slice } from './slice-u16.zig';

const slice = new Uint16Slice('Привет!');

console.time('get');
const { length, get, set } = slice;
for (let i = 0; i < 100000; i++) {
  for (let j = length - 1; j >= 0; j--) {
    const cp = get(j);
    if (i === 0) {
      console.log(cp.toString(16));
    }
  }
}
console.timeEnd('get');

console.time('bracket');
for (let i = 0; i < 100000; i++) {
  for (let j = slice.length - 1; j >= 0; j--) {
    const cp = slice[j];
    if (i === 0) {
      console.log(cp.toString(16));
    }
  }
}
console.timeEnd('bracket');

// console output:
// 21
// 442
// 435
// 432
// 438
// 440
// 41f
// get: 9.02ms
// 21
// 442
// 435
// 432
// 438
// 440
// 41f
// bracket: 539.534ms
```

is fast.

## Working with unions

When a function returns a bare (or extern) union, only the active field can be accessed. An error
would be thrown when runtime safety check is active:

```zig
// bare-union-price.zig
const Currency = enum { EUR, PLN, MOP, USD };
const Price = union {
    USD: i32,
    EUR: i32,
    PLN: i32,
    MOP: i32,
};

pub fn getPrice(currency: Currency, amount: i32) Price {
    return switch (currency) {
        .USD => .{ .USD = amount },
        .EUR => .{ .EUR = amount },
        .PLN => .{ .PLN = amount },
        .MOP => .{ .MOP = amount },
    };
}
```
```js
// bare-union-price.js
import { getPrice } from './bare-union-price.zig';

const price = getPrice('USD', 123);
console.log(`USD = ${price.USD}`);
try {
  console.log(`PLN = ${price.PLN}`);
} catch (err) {
  console.error(err);
}
console.log(Object.keys(price));

// console output:
// USD = 123
// TypeError: Accessing property pln when usd is active
// [ 'USD', 'EUR', 'PLN', 'MOP' ]
```

Tagged union, on the other hand, allows you to read from an inactive field:

```zig
// tagged-union-price.zig
const Currency = enum { usd, eur, pln, mop };
const Price = union(Currency) {
    usd: i32,
    eur: i32,
    pln: i32,
    mop: i32,
};

pub fn getPrice(currency: Currency, amount: i32) Price {
    return switch (currency) {
        .usd => .{ .usd = amount },
        .eur => .{ .eur = amount },
        .pln => .{ .pln = amount },
        .mop => .{ .mop = amount },
    };
}
```
```js
// tagged-union-price.js
import { getPrice } from './tagged-union-price.zig';

const price = getPrice('USD', 123);
console.log(`USD = ${price.USD}`);
console.log(`PLN = ${price.PLN}`);
for (const [ key, value ] of Object.entries(price)) {
  console.log(`${key} = ${value}`);
}
try {
  price.PLN = 500;
} catch (err) {
  console.error(err);
}
console.log(Object.keys(price));

// console output:
// USD = 123
// PLN = null
// USD = 123
// TypeError: Accessing property PLN when USD is active
// [ 'USD' ]
```

Note how a tagged union only returns the active key when `Object.keys()` is called on it, while a
bare union returns all possible keys. This means it's possible to perform a spread operation
(`{ ...object }`) on a tagged union whiledoing the same on a bare union would always cause an
error to be thrown.

## Special properties

## Getting regular JavaScript objects

## Stringifying to JSON

## Limitations

* No support for function pointers
* No support for async function
* No support for functions with variadic arguments
* No support for functions with comptime arguments
* Pointers with no length or terminator are not accessible - Zigar only exposes memory when it knows the extent. Pointers that points to a single object (`*T`) or slices (`[]T`), and those with sentinel value (`[*:0]T`) are OK. Pointers that can pointer to arbitrary numbers of objects (`[*]T` and `[*c]T`) are not.
* Pointers within bare and extern (i.e. C-compatible) unions are not accessible - Zigar simply cannot figure out whether these pointers are pointing to valid memory regions. Pointers are only accessible inside tagged unions.
* Pointers cannot point to partially overlapping memory regions. Pointers pointing to an item within a slice must come after the slice when passed as arguments. E.g.:

```zig
// overlapping-pointers.zig
const Item = struct {
    id: u64,
    price: f64,
};

// okay
pub fn good(list: []const Item, item_ptr: *const Item) void {
    _ = list;
    _ = item_ptr;
}

// this will fail when item_ptr points to an item in list
pub fn bad(item_ptr: *const item, list: []const Item) void {
    _ = item_ptr;
    _ = list;
}
```

* Misaligned pointers will cause errors when they're aliased by other pointers.