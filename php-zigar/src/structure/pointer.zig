const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const Object = php.Object;
const Value = php.Value;
const structure = @import("../structure.zig");
const invokeFunction = structure.invokeMethod;

pub const Pointer = struct {
    slots: Value = undefined,
    last_address: usize = 0,
    last_length: usize = 0,
    bytes: *ByteBuffer = undefined,

    const Super = structure.Parent(@This());

    pub const Static = struct {
        target_class: *ZigClassEntry = undefined,
        address_acc: *accessor.Primitive = undefined,
        length_acc: ?*accessor.Primitive = null,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const target_member = try class.getMember(.instance, 0);
            self.target_class = target_member.class orelse return error.MissingClass;
            const address_member = try class.getMember(.instance, 1);
            if (address_member.accessors != .primitive) return error.InvalidAccessor;
            self.address_acc = &address_member.accessors.primitive;
            if (class.getMember(.instance, 2)) |length_member| {
                if (length_member.accessors != .primitive) return error.InvalidAccessor;
                self.length_acc = &length_member.accessors.primitive;
            } else |_| {}
        }

        pub fn loadTarget(self: *@This(), pointer: *Pointer) !void {
            const address_value = try self.address_acc.get(pointer.bytes);
            const address: usize = try php.getValueUsize(&address_value);
            const length: usize = if (self.length_acc) |acc| get: {
                const value = try acc.get(pointer.bytes);
                break :get @intCast(try php.getValueLong(&value));
            } else 1;
            if (pointer.last_address != address and pointer.last_length != length) {
                php.release(&pointer.slots);
                if (address >= 0) {
                    const class = ZigClassEntry.fromStatic(self);
                    const flags = class.getFlags(Pointer);
                    const byte_size = length * (self.target_class.byte_size orelse 0);
                    const target = try self.target_class.obtainObjectAtAddress(address, byte_size, flags.is_const);
                    pointer.slots = php.createValueObject(target);
                } else {
                    pointer.slots = php.createValueNull();
                }
                pointer.last_address = address;
                pointer.last_length = length;
            }
        }

        pub fn saveTarget(self: *@This(), pointer: *Pointer, target_obj: *Object) !void {
            php.release(&pointer.slots);
            pointer.slots = php.createValueObject(target_obj);
            const extent = try invokeFunction(target_obj, "getExtent", .{});
            try self.setAddress(pointer, extent.address);
            try self.setLength(pointer, extent.len);
            pointer.last_address = extent.address;
            pointer.last_length = extent.len;
        }

        pub fn getAddress(self: *@This(), pointer: *Pointer) !usize {
            const address_value = try self.address_acc.get(pointer.bytes);
            return try php.getValueUsize(&address_value);
        }

        pub fn setAddress(self: *@This(), pointer: *Pointer, address: usize) !void {
            const address_value = php.createValueLong(@bitCast(address));
            try self.address_acc.set(pointer.bytes, &address_value);
        }

        pub fn setLength(self: *@This(), pointer: *Pointer, len: usize) !void {
            if (self.length_acc) |acc| {
                const len_value = php.createValueLong(@bitCast(len));
                try acc.set(pointer.bytes, &len_value);
            }
        }
    };

    pub fn readSelf(self: *@This(), transform: ObjectTransform) accessor.Error!Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.loadTarget(self);
        var value = self.slots;
        php.addRef(&value);
        if (transform != .to_value) try transform.apply(&value);
        return value;
    }

    pub fn writeSelf(self: *@This(), value: *const Value) accessor.Error!void {
        if (try Super.copySelf(self, value)) return;
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const target_obj = init: {
            switch (php.getType(value)) {
                .object => {
                    const obj = php.getValueObject(value) catch unreachable;
                    if (php.instanceOf(obj.ce, static.target_class.entry())) {
                        // point to existing object
                        php.addRef(obj);
                        break :init obj;
                    }
                },
                .string => {
                    if (static.target_class.type != .function) {
                        // autocast from string
                        const str = php.getValueString(value) catch unreachable;
                        break :init try static.target_class.obtainObjectFromString(str);
                    }
                },
                .pointer => {
                    if (static.target_class.type == .slice and static.target_class.flags.slice.is_opaque) {
                        const ptr = php.getValuePointer(*anyopaque, value) catch unreachable;
                        const address = @intFromPtr(ptr);
                        try static.setAddress(self, address);
                        return;
                    }
                },
                else => {},
            }
            // autovivificate new target
            const new_obj = try static.target_class.obtainNewObject();
            errdefer php.release(new_obj);
            try invokeFunction(new_obj, "writeSelf", .{value});
            break :init new_obj;
        };
        try static.saveTarget(self, target_obj);
    }

    pub fn getTarget(self: *@This(), comptime T: type) !*T {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const address = try static.getAddress(self);
        return @ptrFromInt(address);
    }

    pub const setStorage = Super.setStorage;
    pub const getExtent = Super.getExtent;
    pub const copyArguments = Super.copyArguments;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
};
