pub const std = @import("std");

const php = @import("../root.zig");
const Array = php.Array;
const List = php.List;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
pub const Options = Array.Iterator.Options;

pub fn init(list: List, options: Options) !@This() {
    const len = try list.getLength();
    return .{
        .current = switch (options.dir) {
            .forward => 0,
            .backward => len - 1,
        },
        .step = switch (options.dir) {
            .forward => 1,
            .backward => -1,
        },
        .length = len,
        .list = list.retain(),
    };
}

pub fn deinit(self: *@This()) void {
    if (self.source) |list| list.release();
}

pub fn next(self: *@This()) !?Value {
    if (self.current >= self.length) return null;
    const value = try self.list.read(self.current);
    self.current +%= self.step;
    return value;
}

pub fn index(self: *@This()) usize {
    return self.current;
}

current: usize,
length: usize,
list: List,
step: usize,
