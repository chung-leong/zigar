const std = @import("std");

pub var number: i32 = 1234;

pub const StructA = packed struct {
    ptr1: *i32,
    ptr2: *i32,
    number: u10,
    ptr3: *i32,
};

// struct cannot be initialized since non-byte-aligned relocation is not allowed
pub var struct_a: StructA = undefined;

pub fn init() void {
    struct_a = .{
        .ptr1 = &number,
        .ptr2 = &number,
        .ptr3 = &number,
        .number = 200,
    };
}
