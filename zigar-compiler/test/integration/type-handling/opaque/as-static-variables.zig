pub const Apple = opaque {};
pub const Orange = opaque {};
var number: i32 = 1234;

pub var int_ptr = &number;
pub var orange_ptr: *Orange = @ptrCast(&number);
