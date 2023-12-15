const std = @import("std");

pub const StrangeError = error{
    SystemIsOnFire,
    DogAteAllMemory,
    AlienInvasion,
    CondomBrokeYouPregnant,
    NoMoreBeer,
};
pub const StructA = struct {
    err1: StrangeError = StrangeError.SystemIsOnFire,
    err2: StrangeError = StrangeError.DogAteAllMemory,
};

pub var struct_a: StructA = .{
    .err1 = StrangeError.AlienInvasion,
    .err2 = StrangeError.SystemIsOnFire,
};

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
