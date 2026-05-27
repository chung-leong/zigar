const std = @import("std");

pub const ErrorSet = error{ PantsOnFire, ChickenCameBeforeEgg, DingoAteBaby };
pub const Enum = enum { alpha, beta, theta };

pub fn hello() !void {
    return error.PantsOnFire;
}
