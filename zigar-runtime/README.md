
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
form of `ArrayBuffer`. It should only be used for returning data to the caller and not other
purposes, as it is not able to free memory (discarded blocks must await garbaged collection).

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
| `[]u8`           | `ArrayBuffer`, `Uint8Array`, `Buffer`, `DataView` |
| `[]i8`           | `Int8Array`, `DataView`                           |
| `[]u16`          | `Unt16Array`, `DataView`                          |
| `[]i16`          | `Int16Array`, `DataView`                          |
| `[]u32`          | `Uint32Array`, `DataView`,                        |
| `[]i32`          | `Int32Array`, `DataView`,                         |
| `[]u64`          | `BigUint64Array`, `DataView`,                     |
| `[]i64`          | `BigInt64Array`, `DataView`,                      |
| `[]f32`          | `Float32Array`, `DataView`,                       |
| `[]f64`          | `Float64Array`, `DataView`,                       |

The following example exports a number of functions, each of which set a slice to a particular
value, using Zig's built-in function `@memset`:

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

## Object creation


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

## Limitations

* Pointers with no length or terminator are not accessible - Zigar only exposes memory when it knows the extent. Pointers that points to a single object (`*T`) or slices (`[]T`), and those with sentinel value (`[*:0]T`) are OK. Pointers that can pointer to arbitrary numbers of objects (`[*]T` and `[*c]T`) are not.
* Pointers within bare and extern (i.e. C-compatible) unions are not accessible - Zigar simply cannot figure out if these pointers are pointing to valid memory regions. Pointers are only accessible inside tagged unions.
* Pointers cannot point to partially overlapping memory regions. Pointers pointing to an item within a slice must come after the slice when passed as arguments. E.g.:

```zig
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