const std = @import("std");

pub const StrangeError = error{
    SystemIsOnFire,
    DogAteAllMemory,
    AlienInvasion,
    CondomBrokeYouPregnant,
    NoMoreBeer,
};

pub fn print(value: StrangeError) void {
    std.debug.print("{any}\n", .{value});
}

pub fn printAny(value: anyerror) void {
    std.debug.print("{any}\n", .{value});
}
