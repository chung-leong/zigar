
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
    std.debug.print("Hello world");
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
console.log(greeting);
console.log(greeting.string);
console.log([ ...greeting ]);

// console output
// [object []const u8]
// Hello, Bigus!
// [ TODO ]
```

Zigar will automatically provide the allocator. It allocates memory from the JavaScript engine in the
form of `ArrayBuffer`. It should only be used for returning data to the caller and not other
purposes, as it is not able to free memory (discarded blocks must await garbaged collection).

The Zig slice `[]const u8` is represented by an object on the JavaScript side by an object. To get
the actual text string you have to access its `string` property.

Functions returning error unions will throw when errors returned:

```zig
// add-error.zig
const MathError = error {
    UnexpectedSpanishInquisition,
};

pub fn add(a: i32, b: i32) !i32 {
    if (a == 0 or b == 0) {
        return MathError.UnexpectedSpanishInquisition;
    }
    return a + b;
}
```
```js
import { add } from './add-error.zig';

console.log(add(1, 2));
console.log(add(0, 1));

// console output:
// 3
// TODO
```

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
printTag('Cow');

// console output:
// Dog: 0
// Chicken: 3
// ERROR TODO
```

You can also use items from an exported enum set:

```js
// print-enum-from-set.js
import { printTag, Pet } from './print-enum.zig';

printTag(Pet.Dog);
printTag(Pet.Cat);
printTag(Pet.Snake);

// console output:
// Dog: 0
// Cat: 1
// Snake: 2
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
// TODO
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
// TODO
```

Functions with pointer arguments can accept certain JavaScript objects directly. The mapping goes as
follows:

| Zig pointer type | JavaScript object types                                     |
----------------------------------------------------------------------------------
| `[]u8`           | `ArrayBuffer`, `Uint8Array`, `Buffer`, `DataView`, `string` |
| `[]i8`           | `Int8Array`, `DataView`                                     |
| `[]u16`          | `Unt16Array`, `DataView`, `string`                          | 
| `[]i16`          | `Int16Array`, `DataView`                                    |  
| `[]u32`          | `Uint32Array`, `DataView`,                                  |
| `[]i32`          | `Int32Array`, `DataView`,                                   |
| `[]u64`          | `BigUint64Array`, `DataView`,                               |
| `[]i64`          | `BigInt64Array`, `DataView`,                                |
| `[]f32`          | `Float32Array`, `DataView`,                                 |
| `[]f64`          | `Float64Array`, `DataView`,                                 |

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