const std = @import("std");

pub const Error = error{ GoldfishDied, NoMoney };

pub const error_union1: Error!comptime_int = 1234;
pub const error_union2: Error!comptime_int = Error.GoldfishDied;
