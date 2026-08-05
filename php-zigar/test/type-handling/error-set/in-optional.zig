const std = @import("std");

pub const StrangeError = error{
    SystemIsOnFire,
    DogAteAllMemory,
    AlienInvasion,
    CondomBrokeYouPregnant,
    NoMoreBeer,
};
pub var optional: ?StrangeError = StrangeError.SystemIsOnFire;

pub fn print() void {
    std.debug.print("{any}\n", .{optional});
}
