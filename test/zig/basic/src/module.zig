pub const a: i32 = 1;

const b: i32 = 2;

pub var c: bool = true;

pub const d: f64 = 3.14;

pub const e: [4]i32 = .{ 3, 4, 5, 6 };

pub fn f(arg1: i32, arg2: i32) bool {
    return arg1 < arg2;
}

pub const g = enum { dog, cat, chicken };
