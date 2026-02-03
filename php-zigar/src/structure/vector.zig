const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const Iterator = @import("../iterator.zig").Iterator;
const php = @import("../php.zig");
const ClassEntry = php.ClassEntry;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Vector = struct {
    bytes: *ByteBuffer = undefined,

    const Super = structure.Parent(@This());

    pub const Static = struct {
        value_acc: *accessor.Vector = undefined,

        pub fn init(self: *@This(), class: *ZigClassEntry) !void {
            // fetch the accessor in advance since we know it can only be a of the vector type
            const member = try class.getMember(.instance, 0);
            if (member.accessors != .vector) return error.InvalidAccessor;
            self.value_acc = &member.accessors.vector;
        }
    };

    pub fn writeSelf(self: *@This(), value: *const Value) !void {
        _ = self;
        _ = value;
        unreachable;
    }

    pub fn readElement(obj: *Object, key: *Value, _: c_int, retval: *Value) !?*Value {
        const self = Super.fromObject(obj);
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const index = try getIndex(key);
        retval.* = try static.value_acc.get(self.bytes, index);
        return retval;
    }

    pub fn writeElement(obj: *Object, key: *Value, value: *Value) !void {
        const self = Super.fromObject(obj);
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const index = try getIndex(key);
        try static.value_acc.set(self.bytes, index, value);
    }

    pub const setStorage = Super.setStorage;
    pub const copyArguments = Super.copyArguments;
    pub const readSelf = Super.readSelf;
    pub const hasElement = Super.hasVectorElement;
    pub const countElements = Super.countVectorElements;
    pub const getProperties = Super.getVectorProperties;
    pub const freeObject = Super.freeObject;
    pub const getIterator = Super.getVectorIterator;
    const getIndex = Super.getIndex;
};
