pub const Error = error{ goldfish_died, no_money };

pub fn getSomething() Error!i32 {
    return 1234;
}

pub fn getFailure() Error!i32 {
    return Error.goldfish_died;
}
