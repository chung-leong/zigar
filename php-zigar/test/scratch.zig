const std = @import("std");

const zigar = @import("zigar");

pub const Tuple = std.meta.Tuple(&.{ i32, f64, bool });
