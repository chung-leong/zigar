pub const std = @import("std");

const php = @import("../root.zig");
const Array = php.Array;
const Dictionary = php.Dictionary;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
pub const Options = Array.Iterator.Options;

pub fn init(dict: Dictionary, options: Options) !@This() {
    const arr, const props = switch (dict) {
        .array => |a| .{ a, null },
        .object => |o| get: {
            const p = o.getProperties();
            break :get .{ p, p };
        },
    };
    return .{
        .array_iter = arr.iterate(options),
        .object_props = props,
    };
}

pub fn deinit(self: *@This()) void {
    if (self.object_props) |props| props.release();
}

pub fn next(self: *@This()) ?Value {
    return self.array_iter.next();
}

pub fn name(self: *@This()) *String {
    const key = self.array_iter.key();
    std.debug.assert(key.kind() == .string);
    return key.string();
}

array_iter: Array.Iterator,
object_props: ?*Array,
