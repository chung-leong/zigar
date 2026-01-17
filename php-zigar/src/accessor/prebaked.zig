const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const HashTable = php.HashTable;
const Value = php.Value;
const zig_class = @import("../zig-class.zig");
const ZigClass = zig_class.ZigClass;
const zig_object = @import("../zig-object.zig");
const ZigObject = zig_object.ZigObject;

pub const Attributes = struct {};

pub fn get(comptime _: Attributes, params: accessor.Prebaked.Parameters) accessor.Prebaked {
    const ns = struct {
        pub fn get(acc: *const accessor.Prebaked, slots: *HashTable) Error!Value {
            const entry = try php.getHashEntry(slots, acc.params.slot);
            return read(entry, acc.params.transform);
        }

        pub fn set(acc: *const accessor.Prebaked, slots: *HashTable, value: *Value) Error!void {
            const entry = try php.getHashEntry(slots, acc.params.slot);
            try write(entry, value);
        }
    };
    return .{ .getter = &ns.get, .setter = &ns.set, .params = params };
}

pub fn read(entry: *Value, transform: accessor.Transform) Value {
    switch (transform) {
        .none => return entry.*,
        .to_string, .to_plain => {
            unreachable; // TODO
        },
        .to_value => {
            const obj = php.getValueObject(entry) catch unreachable;
            const handlers: *const zig_object.ObjectHandlers = @ptrCast(obj.handlers);
            return handlers.read_self.?(obj);
        },
    }
}

pub fn write(entry: *Value, value: *Value) Error!void {
    const obj = php.getValueObject(entry) catch unreachable;
    const handlers: *const zig_object.ObjectHandlers = @ptrCast(obj.handlers);
    handlers.write_self.?(obj, value);
}
