const std = @import("std");

const ValueType = enum { string, integer, float };
pub const Variant = union(ValueType) {
    string: []const u8,
    integer: u32,
    float: f64,
};

pub const variant_a: Variant = .{ .string = "apple" };
pub const variant_b: Variant = .{ .integer = 123 };
pub const variant_c: Variant = .{ .float = 3.14 };

pub fn printVariant(arg: Variant) void {
    switch (arg) {
        .string => |s| std.debug.print("{s}\n", .{s}),
        .integer => |i| std.debug.print("{d}\n", .{i}),
        .float => |f| std.debug.print("{d}\n", .{f}),
    }
}

pub fn printVariantPtr(arg: *const Variant) void {
    printVariant(arg.*);
}

const ExternUnion = extern union {
    dog: i32,
    cat: i32,
    pig: f64,
};
pub var extern_union: ExternUnion = .{ .cat = 100 };

const BareUnion = union {
    dog: i32,
    cat: i32,
    pig: f64,
    monkey: i64,
};
pub var bare_union: BareUnion = .{ .dog = 123 };

pub fn useDog() void {
    bare_union = .{ .dog = 777 };
}

pub fn useCat() void {
    bare_union = .{ .cat = 777 };
}

pub fn usePig() void {
    bare_union = .{ .pig = 777 };
}

pub fn useMonkey() void {
    bare_union = .{ .monkey = 777 };
}
