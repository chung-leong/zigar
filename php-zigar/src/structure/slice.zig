const std = @import("std");

const accessor = @import("../accessor.zig");
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
            .len = self.getLength(),
        };
    }

    pub fn writeSelf(self: *@This(), value: *const Value) !void {
        if (try self.copySelf(value)) return;
        const class = ZigClassEntry.fromStructure(self);
        const ht = try php.getValueArray(value);
        const len = self.getLength();
        var iter: HashTableIterator = .init(ht, .{});
        const static = class.getStaticData(@This());
        while (iter.next()) |field_value| {
            const key = iter.currentIndex() orelse return error.KeyIsNotInteger;
            if (key < 0) return error.NegativeIndex;
            const index: usize = @intCast(key);
            if (index >= len) return error.OutOfBound;
            try static.value_acc.setElement(self, index, field_value);
        }
    }

    pub fn stringify(self: *@This()) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        if (class.flags.slice.is_string) {
            if (static.element_size == 1) {
                return php.createValueStringContent(self.bytes.bytes);
            } else if (static.element_size == 2) {
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
        // TODO: bound check for zero-length element
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
        const self = Super.fromObject(obj);
        const len = self.getLength();
        const index = getIndex(key) catch return 0;
        return if (index < len) 1 else 0;
    }

    pub fn countElements(obj: *Object, count: *php.Long) !c_int {
        const self = Super.fromObject(obj);
        const len = self.getLength();
        if (len > std.math.maxInt(php.Long)) return error.TooLarge;
        count.* = @intCast(len);
        return php.SUCCESS;
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

    fn getLength(self: *@This()) usize {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const len = self.bytes.bytes.len;
        return if (static.element_shift) |shift|
            len >> shift
        else
            len / static.element_size;
    }

    pub const copyArguments = Super.copyArguments;
    pub const readSelf = Super.readSelf;
    pub const copySelf = Super.copySelf;
    pub const getProperties = Super.getVectorProperties;
    pub const freeObject = Super.freeObject;
    pub const getIterator = Super.getVectorIterator;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
    const getIndex = Super.getIndex;
};
