// struct-pointer.zig
pub const StructA = struct {
    dog: i32,
    cat: i32,
};

pub const StructAPtr = *StructA;
pub const StructAConstPtr = *const StructA;
