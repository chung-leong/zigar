var number: i32 = 1234;

pub const UnionA = union {
    ptr: *anyopaque,
    number: i32,
};

pub var union_a: UnionA = .{ .ptr = @ptrCast(&number) };
