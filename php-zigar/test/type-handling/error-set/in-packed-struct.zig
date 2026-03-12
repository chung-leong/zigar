const std = @import("std");

pub const StrangeError = error{
    SystemIsOnFire,
    DogAteAllMemory,
    AlienInvasion,
    CondomBrokeYouPregnant,
    NoMoreBeer,
};
pub const StructA = packed struct {
    err1: StrangeError = StrangeError.SystemIsOnFire,
    err2: StrangeError = StrangeError.DogAteAllMemory,
    number: u10 = 100,
    err3: StrangeError = StrangeError.AlienInvasion,
};

pub var struct_a: StructA = .{
    .err1 = StrangeError.AlienInvasion,
    .err2 = StrangeError.SystemIsOnFire,
    .number = 200,
    .err3 = StrangeError.CondomBrokeYouPregnant,
};

pub fn print() void {
    std.debug.print("{any}\n", .{struct_a});
}
