const std = @import("std");

pub const StrangeError = error{
    SystemIsOnFire,
    DogAteAllMemory,
    AlienInvasion,
    CondomBrokeYouPregnant,
    NoMoreBeer,
};
pub const StructA = struct {
    number: i32,
    comptime err: StrangeError = StrangeError.SystemIsOnFire,
};

pub var struct_a: StructA = .{ .number = 123 };

pub fn print(arg: StructA) void {
    std.debug.print("{any}\n", .{arg});
}
