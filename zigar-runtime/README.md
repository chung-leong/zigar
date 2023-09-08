
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
// hello.js
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

Zigar will automatically provide the allocator. It allocates memory from the JavaScript engine in the form of `ArrayBuffer`. It should only be used for returning data to the caller and not other purposes, as it is not able to free memory (discarded blocks must await garbaged collection).

The Zig slice `[]const u8` is represented by an object on the JavaScript side by an object. To get the actual text string you have to access its `string` property.

Functions that returning error unions will throw when errors returned:

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



### Struct

### Optional

### Bare and extern union

### Tagged union

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