const std = @import("std");

const assessor = @import("../accessor.zig");
const Error = assessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClass = @import("../class.zig").ZigClass;
const php = @import("../php.zig");
const HashTableIterator = php.HashTableIterator;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Struct = struct {
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,

    const Super = structure.Parent(@This());

    pub fn copyArguments(self: *@This(), arg_iter: *php.ArgumentIterator) !void {
        if (arg_iter.len != 1) {
            php.throwExceptionFmt("struct constructor expects an array as argument or named arguments", .{});
        }
        const arg = arg_iter.next() orelse unreachable;
        return self.writeSelf(arg);
    }

    pub fn writeSelf(self: *@This(), value: *const Value) Error!void {
        const ht = try php.getValueHashTable(value);
        var iter: HashTableIterator = .init(ht, .{});
        while (iter.next()) |field_value| {
            const name = iter.currentName() orelse return error.NotStringKey;
            self.writeMember(name, field_value, null) catch |err| self.throwFieldError(name, err);
        }
    }

    pub const object = Super.object;
    pub const setStorage = Super.setStorage;
    pub const readSelf = Super.readSelf;
    pub const freeObject = Super.freeObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const getPropertyPointer = Super.getPropertyPointer;
    const writeMember = Super.writeMember;
    const throwFieldError = Super.throwFieldError;
};
