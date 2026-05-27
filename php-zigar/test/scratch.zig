const std = @import("std");

pub const ErrorSet = error{ PantsOnFire, ChickenCameBeforeEgg, DingoAteBaby };

pub fn hello() !void {
    return error.PantsOnFire;
}
