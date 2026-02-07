const std = @import("std");

const string: []const u8 = "Hello world!\n";

pub var opaque_ptr: *const anyopaque = string.ptr;
