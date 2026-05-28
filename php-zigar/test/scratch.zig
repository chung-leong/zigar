//const PrivateError = error{JustBeingEvil};

pub const Enum = enum { alpha, beta, theta };

pub const Int32 = i32;

pub fn fail() !bool {
    return error.JustBeingEvil;
}
