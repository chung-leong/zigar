const std = @import("std");

pub var utf16: [5]u16 = .{ 0x43, 0x7a, 0x119, 0x15b, 0x107 };

pub var utf16_slice: []u16 = &utf16;

pub var utf8_slice: []const u8 = "Hello world";
