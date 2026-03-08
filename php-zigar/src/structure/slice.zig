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
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        value_acc: *accessor.Any = undefined,
        element_size: usize = undefined,
        element_shift: ?u6 = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member = try class.getMember(.instance, 0);
            self.value_acc = &member.accessors;
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
            .len = self.getLength() catch unreachable,
        };
    }

    pub fn getLength(self: *@This()) !usize {
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
        return try static.value_acc.getElement(self, index);
    }

    pub fn setElement(self: *@This(), index: usize, value: *Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.value_acc.setElement(self, index, value);
    }

    pub const copyArguments = Super.copyArguments;
    pub const readSelf = Super.readVector;
    pub const writeSelf = Super.writeVector;
    pub const readElement = Super.readVectorElement;
    pub const writeElement = Super.writeVectorElement;
    pub const hasElement = Super.hasVectorElement;
    pub const countElements = Super.countVectorElements;
    pub const getProperties = Super.getVectorProperties;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const getIterator = Super.getVectorIterator;
    pub const readProperty = Super.readGenericProperty;
    pub const writeProperty = Super.writeGenericProperty;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
    const getIndex = Super.getIndex;
};
