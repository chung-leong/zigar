var number: i32 = 1234;

pub const Opaque = opaque {};

pub const UnionA = union {
    ptr: *Opaque,
    number: i32,
};

pub var union_a: UnionA = .{ .ptr = @ptrCast(&number) };
