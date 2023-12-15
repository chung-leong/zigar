pub const Fn = *const fn () void;

fn hello() void {}

pub fn getFunction() Fn {
    return hello;
}
