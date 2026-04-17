const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const Value = php.Value;
const structure = @import("../structure.zig");

const Attributes = struct {};

pub const Constant = struct {
    int: *accessor.Any = undefined,
    class: *ZigClassEntry = undefined,
    comptime type: accessor.Type = .constant,
    comptime attributes: Attributes = .{},

    pub fn init(int_accessor: accessor.Any, class: *ZigClassEntry) !@This() {
        var self: @This() = undefined;
        self.int = try php.allocator.create(accessor.Any);
        self.int.* = int_accessor;
        self.class = class;
        return self;
    }

    pub fn deinit(self: *@This()) void {
        php.allocator.destroy(self.int);
    }

    pub fn get(self: @This(), buffer: *ByteBuffer) Error!Value {
        var source = .{ .buffer = buffer };
        const int_value = try self.int.get(&source);
        return inline for (.{ .@"enum", .error_set }) |object_type| {
            if (self.class.type == object_type) {
                const S = @field(structure.by_enum, @tagName(object_type));
                const static = self.class.getStaticData(S);
                break try static.findCanonical(&int_value);
            }
        } else unreachable;
    }

    pub fn set(self: @This(), buffer: *ByteBuffer, value: *const Value) Error!void {
        const int_value = inline for (.{ .@"enum", .error_set }) |t| {
            if (self.class.type == t) {
                const S = @field(structure.by_enum, @tagName(t));
                const static = self.class.getStaticData(S);
                break try static.findCanonicalInt(value);
            }
        } else unreachable;
        var source = .{ .buffer = buffer };
        try self.int.set(&source, &int_value);
    }
};
