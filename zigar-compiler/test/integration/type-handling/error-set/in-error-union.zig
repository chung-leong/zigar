const std = @import("std");

pub const Error = error{ goldfish_died, no_money };
pub const StrangeError = error{
    SystemIsOnFire,
    DogAteAllMemory,
    AlienInvasion,
    CondomBrokeYouPregnant,
    NoMoreBeer,
};

pub var error_union: Error!StrangeError = StrangeError.SystemIsOnFire;

pub fn print() void {
    std.debug.print("{any}\n", .{error_union});
}
