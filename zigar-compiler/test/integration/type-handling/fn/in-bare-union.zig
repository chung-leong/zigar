pub const Fn = *const fn () void;

fn hello() void {}

pub const UnionA = union {
    function: Fn,
    number: i32,
};

pub var union_a: UnionA = .{ .function = hello };
