
## Feautures

* Support for non-standard integer types (i29, u128, etc.)
* Support for non-standard float types (f16, f80, f128)
* Support for structs, including packed structs
* Support for different types of unions
* Support for optional and error union
* Subclassing of error sets
* Correct handling of pointers 
* Automatic provisioning of memory allocator

## Object creation


## Casting

Zigar allows you to cast a JavaScript memory buffer into a Zig structure using the following syntax:

```zig
pub const StructA = struct {
    dog: i32,
    cat: i32,
};
```

```js
import { StructA } from './test.zig';

const buffer = new ArrayBuffer(8);
const struct = StructA(buffer);
struct.dog = 123;
struct.cat = 456;
const view = new DataView(buffer);
console.log(view.getInt32(0, true), view.getInt32(4, true));

// Output:
123 456
```

Casting creates a object without allocating new memory for it. Note how the `new` operator is not used. 


## Type system

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