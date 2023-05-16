const std = @import("std");
const assert = std.debug.assert;
const exporter = @import("exporter");

export const zig_module = exporter.createModule(@import("./module.zig"));

test "version number" {
    assert(zig_module.version == exporter.api_version);
}

test "has entries" {
    assert(zig_module.table.count > 0);
}

test "only exporting public items" {
    const entries = zig_module.table.entries;
    assert(entries[0].name[0] == 'a');
    assert(entries[1].name[0] == 'c');
}

test "entry for i32 constant has the right properties" {
    const entry = zig_module.table.entries[0];
    assert(entry.name[0] == 'a');
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
    assert(entry.name[0] == 'c');
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
    assert(entry.name[0] == 'd');
    assert(entry.content.type == .variable);
    const variable = entry.content.params.variable.*;
    assert(variable.getter_thunk != null);
    assert(variable.setter_thunk == null);
    assert(variable.class_name == null);
    assert(variable.default_type.number);
    assert(variable.possible_types.number);
    assert(!variable.possible_types.bigInt);
}
