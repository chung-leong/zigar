const std = @import("std");

const zigar = @import("zigar");

var work_queue: zigar.thread.WorkQueue(ns) = .{};

pub const shutdown = work_queue.promisify(.shutdown);
pub const returnString = work_queue.promisify(ns.returnString);
pub const returnInt = work_queue.promisify(ns.returnInt);
pub const returnPoint = work_queue.promisify(ns.returnPoint);

const ns = struct {
    pub fn returnString(allocator: std.mem.Allocator) ![]const u8 {
        return try allocator.dupe(u8, "Hello world!");
    }

    pub fn returnInt() i32 {
        return 1234;
    }

    pub fn returnPoint() struct {
        x: f64,
        y: f64,
    } {
        return .{ .x = 0.1234, .y = 0.4567 };
    }
};

const module = @This();
pub const @"meta(zigar)" = struct {
    pub fn isDeclString(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        return switch (T) {
            module => decl == .returnString,
            else => false,
        };
    }

    pub fn isDeclPlain(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        return switch (T) {
            module => decl == .returnPoint,
            else => false,
        };
    }
};
