const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Slice = struct {
    slots: Value = undefined,
    bytes: *ByteBuffer = undefined,

    const Super = structure.ArrayLike(@This());
    pub const Static = struct {
        value_acc: *accessor.Any = undefined,
        value_transform: ?ObjectTransform = null,
        element_size: usize = undefined,
        element_shift: ?u6 = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member = try class.getMember(.instance, 0);
            self.value_acc = &member.accessors;
            self.value_transform = member.objectTransform();
            self.element_size = class.byte_size orelse 1;
            self.element_shift = init: {
                const shift = std.math.log2_int(usize, self.element_size);
                const one: usize = 1;
                break :init if (one << shift == self.element_size) shift else null;
            };
        }
    };

    pub fn setStorage(self: *@This(), bytes: *ByteBuffer, slots: *const Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        const byte_size = class.byte_size orelse return error.Unexpected;
        const remainder = @rem(bytes.bytes.len, byte_size);
        if (remainder != 0) {
            return php.throwExceptionFmt("'{s}'' has elements that are {d} byte{s} in length, received {d}", .{
                class.getName(),
                byte_size,
                if (byte_size != 1) "s" else "",
                bytes.bytes.len,
            });
        }
        self.bytes = bytes;
        self.bytes.addRef();
        self.slots = slots.*;
        php.addRef(&self.slots);
    }

    pub fn getExtent(self: *@This()) Super.ByteExtent {
        return .{
            .address = @intFromPtr(self.bytes.bytes.ptr),
            .len = self.getLength(),
        };
    }

    pub fn getLength(self: *@This()) usize {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const len = self.bytes.bytes.len;
        return if (static.element_shift) |shift|
            len >> shift
        else
            len / static.element_size;
    }

    pub fn getElement(self: *@This(), index: usize) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        var value = try static.value_acc.getElement(self, index);
        if (static.value_transform) |ot| try ot.apply(&value);
        return value;
    }

    pub fn setElement(self: *@This(), index: usize, value: *Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.value_acc.setElement(self, index, value);
    }

    pub const copyArguments = Super.copyArguments;
    pub const readSelf = Super.readSelf;
    pub const writeSelf = Super.writeSelf;
    pub const readElement = Super.readElement;
    pub const writeElement = Super.writeElement;
    pub const hasElement = Super.hasElement;
    pub const countElements = Super.countElements;
    pub const getProperties = Super.getProperties;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const getIterator = Super.getIterator;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
    const getIndex = Super.getIndex;
};
