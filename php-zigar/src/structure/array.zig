const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const Iterator = @import("../iterator.zig").Iterator;
const php = @import("../php.zig");
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Array = struct {
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        value_acc: *accessor.Any = undefined,

        pub fn init(self: *@This(), class: *ZigClassEntry) !void {
            const member = try class.getMember(.instance, 0);
            self.value_acc = &member.accessors;
        }
    };

    pub fn writeSelf(self: *@This(), value: *const Value) !void {
        _ = self;
        _ = value;
        unreachable;
    }

    pub fn stringify(self: *@This()) !Value {
        const class = ZigClassEntry.fromStructure(self);
        if (class.flags.array.is_string) {
            if (class.byte_size == class.length) {
                return php.createValueStringContent(self.bytes.bytes);
            } else if (class.byte_size == class.length) {
                // TODO: convert to UTF-8
            }
        }
        return error.Unsupported;
    }

    pub fn readElement(obj: *Object, key: *Value, _: c_int, retval: *Value) !?*Value {
        const self = Super.fromObject(obj);
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const index = try getIndex(key);
        retval.* = try static.value_acc.getElement(self, index);
        return retval;
    }

    pub fn writeElement(obj: *Object, key: *Value, value: *Value) !void {
        const self = Super.fromObject(obj);
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const index = try getIndex(key);
        try static.value_acc.setElement(self, index, value);
    }

    pub fn hasElement(obj: *Object, key: *Value, _: c_int) !c_int {
        const class = ZigClassEntry.fromObject(obj);
        const index = getIndex(key) catch return 0;
        const len = class.length orelse return error.MissingLength;
        return if (index < len) 1 else 0;
    }

    pub fn countElements(obj: *Object, count: *php.Long) !c_int {
        const class = ZigClassEntry.fromObject(obj);
        const len = class.length orelse return error.MissingLength;
        if (len > std.math.maxInt(php.Long)) return error.TooLarge;
        count.* = @intCast(len);
        return php.SUCCESS;
    }

    pub fn castObject(obj: *Object, retval: *Value, type_id: c_int) !c_int {
        const value_type = php.Type.fromNumber(type_id) catch return php.FAILURE;
        if (value_type == .string) {
            const self = Super.fromObject(obj);
            const value = self.stringify() catch return php.FAILURE;
            retval.* = value;
            return php.SUCCESS;
        }
        return php.FAILURE;
    }

    pub fn getIterator(_: *ClassEntry, this: *Value, _: c_int) !?*ObjectIterator {
        const obj = try php.getValueObject(this);
        return try Iterator(@This()).create(obj);
    }

    fn getIndex(key: *Value) !usize {
        const key_long = try php.getValueLong(key);
        if (key_long < 0) return error.NegativeIndex;
        return @intCast(key_long);
    }

    pub const fromObject = Super.fromObject;
    pub const setStorage = Super.setStorage;
    pub const copyArguments = Super.copyArguments;
    pub const readSelf = Super.readSelf;
    pub const getProperties = Iterator(@This()).getProperties;
    pub const freeObject = Super.freeObject;
};
