const std = @import("std");
const assert = std.debug.assert;
const exporter = @import("exporter");

export const zig_module = exporter.createModule(@import("./module.zig"));

fn strcmp(s1: [*]const u8, s2: [*]const u8) i32 {
    var i: usize = 0;
    while (s1[i] != 0 and s2[i] != 0) : (i += 1) {
        if (s1[i] < s2[i]) {
            return -1;
        } else if (s1[i] > s2[i]) {
            return 1;
        }
    }
    return 0;
}

test "version number" {
    assert(zig_module.version == exporter.api_version);
}

test "has entries" {
    assert(zig_module.table.count > 0);
}

test "only exporting public items" {
    const entries = zig_module.table.entries;
    assert(strcmp(entries[0].name, "a") == 0);
    assert(strcmp(entries[1].name, "c") == 0);
}

test "entry for i32 constant has the right properties" {
    const entry = zig_module.table.entries[0];
    assert(strcmp(entry.name, "a") == 0);
    assert(entry.content.type == .variable);
    const variable = entry.content.params.variable.*;
    assert(variable.getter_thunk != null);
    assert(variable.setter_thunk == null);
    assert(variable.class_name == null);
    assert(variable.default_type.number);
    assert(variable.possible_types.number);
    assert(variable.possible_types.bigInt);
}

test "entry for bool variable has the right properties" {
    const entry = zig_module.table.entries[1];
    assert(strcmp(entry.name, "c") == 0);
    assert(entry.content.type == .variable);
    const variable = entry.content.params.variable.*;
    assert(variable.getter_thunk != null);
    assert(variable.setter_thunk != null);
    assert(variable.class_name == null);
    assert(variable.default_type.boolean);
    assert(variable.possible_types.boolean);
    assert(!variable.possible_types.number);
}

test "entry for f64 constant has the right properties" {
    const entry = zig_module.table.entries[2];
    assert(strcmp(entry.name, "d") == 0);
    assert(entry.content.type == .variable);
    const variable = entry.content.params.variable.*;
    assert(variable.getter_thunk != null);
    assert(variable.setter_thunk == null);
    assert(variable.class_name == null);
    assert(variable.default_type.number);
    assert(variable.possible_types.number);
    assert(!variable.possible_types.bigInt);
}

test "entry for array constant has the right properties" {
    const entry = zig_module.table.entries[3];
    assert(strcmp(entry.name, "e") == 0);
    assert(entry.content.type == .variable);
    const variable = entry.content.params.variable.*;
    assert(variable.getter_thunk != null);
    assert(variable.setter_thunk == null);
    assert(variable.class_name == null);
    assert(variable.default_type.i32Array == true);
    assert(variable.possible_types.array);
    assert(variable.possible_types.arrayBuffer);
    assert(variable.possible_types.i32Array == true);
}

test "entry for enumeration has the right properties" {
    const entry = zig_module.table.entries[4];
    assert(strcmp(entry.name, "f") == 0);
    assert(entry.content.type == .enumeration);
    const enumeration = entry.content.params.enumeration.*;
    assert(enumeration.count == 3);
    assert(!enumeration.is_signed);
    assert(enumeration.default_type.number);
    assert(!enumeration.default_type.bigInt);
    assert(enumeration.possible_types.number);
    assert(enumeration.possible_types.bigInt);
    const items = enumeration.items;
    assert(strcmp(items[0].name, "Dog") == 0);
    assert(items[0].value == 0);
    assert(strcmp(items[1].name, "Cat") == 0);
    assert(items[1].value == 1);
    assert(strcmp(items[2].name, "Chicken") == 0);
    assert(items[2].value == 2);
}

test "entry for enumeration with negative values has the right properties" {
    const entry = zig_module.table.entries[5];
    assert(strcmp(entry.name, "g") == 0);
    assert(entry.content.type == .enumeration);
    const enumeration = entry.content.params.enumeration.*;
    assert(enumeration.count == 3);
    assert(enumeration.is_signed);
    assert(enumeration.default_type.number);
    assert(!enumeration.default_type.bigInt);
    assert(enumeration.possible_types.number);
    assert(enumeration.possible_types.bigInt);
    const items = enumeration.items;
    assert(strcmp(items[0].name, "Dog") == 0);
    assert(items[0].value == -100);
    assert(strcmp(items[1].name, "Cat") == 0);
    assert(items[1].value == -99);
    assert(strcmp(items[2].name, "Chicken") == 0);
    assert(items[2].value == -98);
}

test "entry for function has the right properties" {
    const entry = zig_module.table.entries[6];
    assert(strcmp(entry.name, "h") == 0);
    assert(entry.content.type == .function);
    const function = entry.content.params.function.*;
    assert(function.argument_count == 2);
    assert(function.return_default_type.boolean);
    assert(function.return_possible_types.boolean);
    assert(!function.return_possible_types.number);
    const args = function.arguments;
    assert(!args[0].possible_types.boolean);
    assert(args[0].possible_types.number);
    assert(args[0].possible_types.bigInt);
}

test "entry for function using memory allocator has the right properties" {
    const entry = zig_module.table.entries[7];
    assert(strcmp(entry.name, "i") == 0);
    assert(entry.content.type == .function);
    const function = entry.content.params.function.*;
    assert(function.argument_count == 2);
    assert(function.return_default_type.boolean);
    assert(function.return_possible_types.boolean);
    assert(!function.return_possible_types.number);
    const args = function.arguments;
    assert(!args[0].possible_types.boolean);
    assert(args[0].possible_types.number);
    assert(args[0].possible_types.bigInt);
}
