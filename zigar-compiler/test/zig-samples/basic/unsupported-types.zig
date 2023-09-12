const Error = error{HelloError};

pub const weird = noreturn;
//pub var frame: anyframe = undefined;
pub var fn1: ?*const fn () void = null;
pub var fn2: Error!*const fn () void = Error.HelloError;
pub const number = 77;
