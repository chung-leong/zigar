const std = @import("std");

pub var number: i32 = 1234;

pub const StructA = packed struct {
    ptr1: *i32 = &number,
    ptr2: *i32 = &number,
    number: u10 = 100,
    ptr3: *i32 = &number,
};

// struct cannot be initialized since non-byte-aligned relocation is not allowed
pub var struct_a: StructA = undefined;

pub fn init() void {
    struct_a = .{ .number = 200 };
}
