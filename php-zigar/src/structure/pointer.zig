const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const Object = php.Object;
const Value = php.Value;
const structure = @import("../structure.zig");
const invokeFunction = structure.invokeMethod;

pub const Pointer = struct {
    last_address: usize = 0,
    last_length: usize = 0,
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    const Super = structure.Parent(@This());

    pub const Static = struct {
        target_class: *ZigClassEntry = undefined,
        address_acc: *accessor.Primitive = undefined,
        length_acc: ?*accessor.Primitive = null,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const target_member = try class.getMember(.instance, 0);
            self.target_class = target_member.class;
            const address_member = try class.getMember(.instance, 1);
            if (address_member.accessors != .primitive) return error.InvalidAccessor;
            self.address_acc = &address_member.accessors.primitive;
            if (class.getMember(.instance, 2)) |length_member| {
                if (length_member.accessors != .primitive) return error.InvalidAccessor;
                self.length_acc = &length_member.accessors.primitive;
            } else |_| {}
        }

        pub fn loadTarget(self: *@This(), pointer: *Pointer) !void {
            const address_value = try self.address_acc.get(pointer.buffer);
            const address: usize = try php.getValueUsize(&address_value);
            const length: usize = if (self.length_acc) |acc| get: {
                const value = try acc.get(pointer.buffer);
                break :get @intCast(try php.getValueLong(&value));
            } else 1;
            if (pointer.last_address != address and pointer.last_length != length) {
                php.release(&pointer.table);
                if (address >= 0) {
                    const class = ZigClassEntry.fromStatic(self);
                    const flags = class.getFlags(Pointer);
                    const byte_size = length * (self.target_class.byte_size orelse 0);
                    const target = try self.target_class.obtainObjectAtAddress(address, byte_size, flags.is_const);
                    pointer.table = php.createValueObject(target);
                } else {
                    pointer.table = php.createValueNull();
                }
                pointer.last_address = address;
                pointer.last_length = length;
            }
        }

        pub fn saveTarget(self: *@This(), pointer: *Pointer, target_obj: *Object) !void {
            php.release(&pointer.table);
            pointer.table = php.createValueObject(target_obj);
            const extent = try invokeFunction(target_obj, "getExtent", .{});
            try self.setAddress(pointer, extent.address);
            try self.setLength(pointer, extent.len);
            pointer.last_address = extent.address;
            pointer.last_length = extent.len;
        }

        pub fn getAddress(self: *@This(), pointer: *Pointer) !usize {
            const address_value = try self.address_acc.get(pointer.buffer);
            return try php.getValueUsize(&address_value);
        }

        pub fn setAddress(self: *@This(), pointer: *Pointer, address: usize) !void {
            const address_value = php.createValueLong(@bitCast(address));
            try self.address_acc.set(pointer.buffer, &address_value);
        }

        pub fn setLength(self: *@This(), pointer: *Pointer, len: usize) !void {
            if (self.length_acc) |acc| {
                const len_value = php.createValueLong(@bitCast(len));
                try acc.set(pointer.buffer, &len_value);
            }
        }
    };

    pub fn readSelf(self: *@This(), transform: ObjectTransform) accessor.Error!Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.loadTarget(self);
        var value = self.table;
        php.addRef(&value);
        if (transform != .to_value) try transform.apply(&value);
        return value;
    }

    pub fn writeSelf(self: *@This(), value: *const Value) accessor.Error!void {
        if (try Super.copySelf(self, value)) return;
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const target_obj = init: {
            // using the allocator associated with the pointer for autovivification new target,
            const allocator = self.buffer.getSourceAllocator();
            const target_class = static.target_class;
            switch (php.getType(value)) {
                .object => {
                    const obj = php.getValueObject(value) catch unreachable;
                    if (php.instanceOf(obj.ce, target_class.entry())) {
                        // point to existing object
                        php.addRef(obj);
                        break :init obj;
                    }
                },
                .string => {
                    if (target_class.type != .function) {
                        const str = php.getValueString(value) catch unreachable;
                        try target_class.checkByteLength(str.len);
                        const buf = try ByteBuffer.create(target_class.alignment);
                        if (allocator != null) {
                            // allocate
                            const sc = php.getStringContent(str);
                            try buf.allocate(allocator, sc.len);
                            try buf.copyBytes(sc);
                        } else {
                            // autocast from string when there's no allocator
                            buf.referenceString(str);
                        }
                        const new_obj = try target_class.createObjectFromBuffer(buf, null);
                        break :init new_obj;
                    }
                },
                .pointer => {
                    const ptr = php.getValuePointer(*anyopaque, value) catch unreachable;
                    const address = @intFromPtr(ptr);
                    try static.setAddress(self, address);
                    return;
                },
                else => {},
            }
            // autovivificate new target,
            break :init try target_class.createObject(allocator, value);
        };
        try static.saveTarget(self, target_obj);
    }

    pub fn visitChildren(self: *@This(), cb: fn (anytype) bool) accessor.Error!void {
        if (cb(self)) {
            const obj = php.getValueObject(&self.table) catch return;
            try structure.invokeMethod(obj, "visitChildren", .{cb});
        }
    }

    pub const getExtent = Super.getExtent;
    pub const initialize = Super.initialize;
    pub const checkArguments = Super.checkArguments;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
};
