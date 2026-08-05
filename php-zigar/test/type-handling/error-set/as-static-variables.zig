const std = @import("std");

pub const StrangeError = error{
    SystemIsOnFire,
    DogAteAllMemory,
    AlienInvasion,
    CondomBrokeYouPregnant,
    NoMoreBeer,
};

pub const NormalError = error{
    FileNotFound,
    OutOfMemory,
};

pub const CommonError = error{
    OutOfMemory,
    NoMoreBeer,
};

pub const PossibleError = NormalError || StrangeError;

pub var error_var = NormalError.FileNotFound;

pub fn print() void {
    std.debug.print("{any}\n", .{error_var});
}
