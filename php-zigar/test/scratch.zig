const std = @import("std");

pub var number: i64 = 123;

pub const ptr_a: *i64 = &number;
pub const ptr_b: *const i64 = &number;
pub const ptr_c: *i64 = &number;
pub const ptr_d: *const i64 = &number;
