const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const Object = php.Object;
const Value = php.Value;
const structure = @import("../structure.zig");
const invokeFunction = structure.invokeFunction;

pub const Pointer = struct {
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,
    last_address: usize = 0,
    last_length: usize = 0,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        target_class: *ZigClassEntry = undefined,
        target_transform: ?accessor.ObjectTransform = undefined,
        address_acc: *accessor.Primitive = undefined,
        length_acc: ?*accessor.Primitive = null,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const target_member = try class.getMember(.instance, 0);
            self.target_class = target_member.class orelse return error.MissingClass;
            self.target_transform = target_member.objectTransform();
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
            const address: usize = @intCast(try php.getValueLong(&address_value));
            const length: usize = if (self.length_acc) |acc| get: {
                const value = try acc.get(pointer.bytes);
                break :get @intCast(try php.getValueLong(&value));
            } else 1;
            if (pointer.last_address != address and pointer.last_length != length) {
                php.release(&pointer.slots);
                if (address >= 0) {
                    const byte_size = length * (self.target_class.byte_size orelse 0);
                    const byte_ptr: [*]u8 = @ptrFromInt(address);
                    const new_buffer = try ByteBuffer.createExternal(byte_ptr[0..byte_size]);
                    defer new_buffer.release();
                    const class = ZigClassEntry.fromStatic(self);
                    try class.host.memory_map.add(new_buffer);
                    const target = try self.target_class.createObjectFromBuffer(new_buffer, null);
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
            const address_value = php.createValueLong(@intCast(extent.address));
            try self.address_acc.set(pointer.bytes, &address_value);
            if (self.length_acc) |acc| {
                const len_value = php.createValueLong(@intCast(extent.len));
                try acc.set(pointer.bytes, &len_value);
            }
            pointer.last_address = extent.address;
            pointer.last_length = extent.len;
        }
    };

    pub fn readSelf(self: *@This()) accessor.Error!Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.loadTarget(self);
        return try accessor.read(&self.slots, static.target_transform);
    }

    pub fn writeSelf(self: *@This(), value: *const Value) accessor.Error!void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const target_obj = init: {
            if (php.getValueObject(value)) |obj| {
                if (php.instanceOf(obj.ce, static.target_class.entry())) {
                    // point to existing object
                    php.addRef(obj);
                    break :init obj;
                }
            } else |_| if (php.getValueString(value)) |str| {
                if (static.target_class.type != .function) {
                    // autocast from string
                    break :init try static.target_class.createObjectFromString(str);
                }
            } else |_| {}
            // autovivificate new target
            const new_obj = try static.target_class.createNewObject();
            errdefer php.release(new_obj);
            try invokeFunction(new_obj, "writeSelf", .{value});
            break :init new_obj;
        };
        try static.saveTarget(self, target_obj);
    }

    pub fn stringify(self: *@This()) !Value {
        const class = ZigClassEntry.fromStructure(self);
        _ = class;
        std.debug.print("stringify\n", .{});
        unreachable;
    }

    pub const setStorage = Super.setStorage;
    pub const getExtent = Super.getExtent;
    pub const copyArguments = Super.copyArguments;
    pub const freeObject = Super.freeObject;
    const fromObject = Super.fromObject;
};
