const std = @import("std");

pub const StrangeError = error{
    SystemIsOnFire,
    DogAteAllMemory,
    AlienInvasion,
    CondomBrokeYouPregnant,
    NoMoreBeer,
};
pub var vector: @Vector(4, StrangeError) = .{
    StrangeError.SystemIsOnFire,
    StrangeError.DogAteAllMemory,
    StrangeError.AlienInvasion,
    StrangeError.CondomBrokeYouPregnant,
};
pub const vector_const: @Vector(4, void) = .{
    StrangeError.SystemIsOnFire,
    StrangeError.DogAteAllMemory,
    StrangeError.AlienInvasion,
    StrangeError.CondomBrokeYouPregnant,
};

pub fn print() void {
    std.debug.print("{any}\n", .{vector});
}
