const std = @import("std");

pub const StrangeError = error{
    SystemIsOnFire,
    DogAteAllMemory,
    AlienInvasion,
    CondomBrokeYouPregnant,
    NoMoreBeer,
};
pub var array: [4]StrangeError = .{
    StrangeError.SystemIsOnFire,
    StrangeError.DogAteAllMemory,
    StrangeError.AlienInvasion,
    StrangeError.CondomBrokeYouPregnant,
};

pub fn print() void {
    std.debug.print("{any}\n", .{array});
}
