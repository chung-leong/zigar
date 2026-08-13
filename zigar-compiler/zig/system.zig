const std = @import("std");
var threaded_io = std.Io.Threaded.init_single_threaded;

pub const io = threaded_io.io();
