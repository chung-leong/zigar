const print = @import("std").debug.print;

pub fn hello(number: f16) i16 {
    print("Hello world ({d})\n", .{number});
    return 789;
}
