pub const Error = error{ GoldfishDied, NoMoney };

pub fn getSomething() Error!i32 {
    return 1234;
}

pub fn getFailure() Error!i32 {
    return Error.GoldfishDied;
}
