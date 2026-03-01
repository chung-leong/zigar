const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Array = struct {
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        value_acc: *accessor.Any = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            if (class.length == null) return error.Unexpected;
            const member = try class.getMember(.instance, 0);
            self.value_acc = &member.accessors;
        }
    };

    pub fn writeSelf(self: *@This(), value: *const Value) !void {
        if (try self.copySelf(value)) return;
        const class = ZigClassEntry.fromStructure(self);
        const ht = try php.getValueArray(value);
        var iter: HashTableIterator = .init(ht, .{});
        const static = class.getStaticData(@This());
        while (iter.next()) |field_value| {
            const key = iter.currentIndex() orelse return error.KeyIsNotInteger;
            if (key < 0) return error.NegativeIndex;
            const index: usize = @intCast(key);
            if (index >= class.length.?) return error.OutOfBound;
            try static.value_acc.setElement(self, index, field_value);
        }
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
        // need bound check needed here because element might be zero-bit
        if (index >= class.length.?) return error.OutOfBound;
        retval.* = try static.value_acc.getElement(self, index);
        return retval;
    }

    pub fn writeElement(obj: *Object, key: *Value, value: *Value) !void {
        const self = Super.fromObject(obj);
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const index = try getIndex(key);
        if (index >= class.length.?) return error.OutOfBound;
        try static.value_acc.setElement(self, index, value);
    }

    pub fn castObject(obj: *Object, retval: *Value, type_id: c_int) !c_int {
        const value_type = php.Type.fromInt(type_id) catch return php.FAILURE;
        if (value_type == .string) {
            const self = Super.fromObject(obj);
            const value = self.stringify() catch return php.FAILURE;
            retval.* = value;
            return php.SUCCESS;
        }
        return php.FAILURE;
    }

    pub const setStorage = Super.setStorage;
    pub const getExtent = Super.getExtent;
    pub const copyArguments = Super.copyArguments;
    pub const readSelf = Super.readSelf;
    pub const copySelf = Super.copySelf;
    pub const hasElement = Super.hasVectorElement;
    pub const countElements = Super.countVectorElements;
    pub const getProperties = Super.getVectorProperties;
    pub const freeObject = Super.freeObject;
    pub const getIterator = Super.getVectorIterator;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
    const getIndex = Super.getIndex;
};
