const std = @import("std");

pub const Error = error{ goldfish_died, no_money };

pub const error_union1: Error!comptime_float = 1234;
pub const error_union2: Error!comptime_float = Error.goldfish_died;
