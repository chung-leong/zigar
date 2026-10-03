const std = @import("std");

const BufferMap = @import("BufferMap.zig");
const ByteBuffer = @import("ByteBuffer.zig");
const hooks = @import("module/native/hooks.zig");
const ModuleGeneric = @import("module/native/interface.zig").Module;
const ModuleHost = @import("ModuleHost.zig");
const php_ng = @import("php/root.zig");
const php_al = php_ng.allocator;
const Array = php_ng.Array;
const Object = php_ng.Object;
const String = php_ng.String;
const N = String.static;
const Value = php_ng.Value;

pub fn init(host: *ModuleHost) !*@This() {
    const self = try php_al.create(@This());
    errdefer php_al.destroy(self);
    var value_list: std.ArrayList(Value) = try .initCapacity(php_al, 64);
    errdefer value_list.deinit(php_al);
    var class_list: std.ArrayList(*Object) = try .initCapacity(php_al, 32);
    errdefer class_list.deinit(php_al);
    self.* = .{
        .value_list = value_list,
        .class_list = class_list,
        .buffer_map = .{},
        .structure_map = Array.createNonDestructive(),
        .host = host,
    };
    return self;
}

pub fn deinit(self: *@This()) void {
    // we don't need to worry about buffers stored in value_list, since the buffer map owns them
    for (self.value_list.items) |*item| item.release();
    for (self.class_list.items) |class_obj| class_obj.release();
    self.value_list.deinit(php_al);
    self.class_list.deinit(php_al);
    self.buffer_map.deinit();
    self.structure_map.release();
    php_al.destroy(self);
}

pub fn activateStructures(self: *@This()) !*Object {
    if (self.has_deferred) {
        var iter = .init(&self.structure_map, .{});
        while (iter.next()) |s| {
            const class_value = try s.get(N("class"));
            const class_obj = try class_value.getObject();
            _ = class_obj;
            // TODO
        }
    }
    // the last class to get finalized is the root namespace
    if (self.class_list.items.len == 0) return error.NoRoot;
    const root_obj = self.class_list.items[0];
    // initially, the host holds references to class objects through class_list
    // prior to destroying that list we need to flip the relationship so that
    // these objects own the host instead
    for (self.class_list.items) |class_obj| {
        const class = ZigClassEntry.fromObject(class_obj);
        try class.activate();
    }
    const root_class = ZigClassEntry.fromObject(root_obj);
    const root_static = root_class.getStaticData(structure.Struct);
    try root_static.markAsRoot();
    return root_obj.retain();
}

fn obtainHandle(self: *@This(), value: Value) Handle {
    return self.findHandle(value) orelse self.addHandle(value);
}

fn addHandle(self: *@This(), value: Value) Handle {
    self.value_list.append(php_al, value) catch @panic("Unable to allocate value");
    return @ptrFromInt(self.value_list.items.len);
}

fn findHandle(self: *@This(), value: Value) ?Handle {
    return for (self.value_list.items, 0..) |*item, i| {
        if (item.u1.v.type == value.u1.v.type and item.value.ptr == value.value.ptr) {
            break @ptrFromInt(i + 1);
        }
    } else null;
}

fn dereference(self: *@This(), handle: Handle) *Value {
    const handle_value = @intFromPtr(handle);
    return &self.value_list.items[handle_value - 1];
}

pub fn createBool(self: *@This(), initializer: bool) !Handle {
    const value: Value = .fromBoolean(initializer);
    return self.obtainHandle(value);
}

pub fn createInteger(self: *@This(), initializer: i32, unsigned: bool) !Handle {
    const value: Value = switch (unsigned) {
        true => .fromUnsigned(@as(u32, @bitCast(initializer))),
        false => .fromInteger(initializer),
    };
    return self.obtainHandle(value);
}

pub fn createBigInteger(self: *@This(), initializer: i64, unsigned: bool) !Handle {
    const value: Value = switch (unsigned) {
        true => .fromUnsigned(@as(u64, @bitCast(initializer))),
        false => .fromInteger(initializer),
    };
    return self.obtainHandle(value);
}

pub fn createString(self: *@This(), byte_ptr: [*]const u8, len: usize) !Handle {
    const value: Value = .create(byte_ptr[0..len]);
    return self.addHandle(value);
}

pub fn createView(self: *@This(), byte_ptr: ?[*]const u8, len: usize, copying: bool, read_only: bool, _: usize, byte_align: usize) !Handle {
    if (!std.math.isPowerOfTwo(byte_align)) return error.InvalidAlignment;
    const alignment = std.mem.Alignment.fromByteUnits(byte_align);
    const bytes = if (byte_ptr) |ptr| ptr[0..len] else &.{};
    const buffer, const insertion_pos = init: {
        if (copying) {
            const buf = try ByteBuffer.create(alignment);
            errdefer buf.release();
            try buf.allocate(null, len);
            try buf.copyBytes(bytes);
            const result = self.buffer_map.find(.{
                .bytes = buf.bytes,
                .read_only = read_only,
                .alignment = alignment,
            });
            break :init .{ buf, result };
        } else {
            const result = self.buffer_map.find(.{
                .bytes = bytes,
                .read_only = read_only,
                .alignment = alignment,
            });
            if (self.buffer_map.get(result)) |buf| {
                const value: Value = .fromPointer(buf);
                return self.findHandle(value) orelse error.Unexpected;
            }
            const parent = self.buffer_map.getParentBuffer(.{ .bytes = bytes }, result);
            const buf = try ByteBuffer.create(alignment);
            buf.referenceBytes(bytes, parent);
            break :init .{ buf, result };
        }
    };
    errdefer buffer.release();
    try self.buffer_map.insert(insertion_pos, buffer);
    if (read_only) buffer.protect();
    const value: Value = .fromPointer(buffer);
    return self.addHandle(value);
}

pub fn createInstance(self: *@This(), structure_h: Handle, dv_h: Handle, prefilled_table_h: ?Handle) !Handle {
    const structure_v = self.dereference(structure_h);
    const class_value = try structure_v.get(N("class"));
    const class_obj = try class_value.getObject();
    // const class = ZigClassEntry.fromObject(class_obj);
    if (!class.status.defined) {
        self.has_deferred = true;
        const deferred_args = try php.allocator.alloc(?Handle, 3);
        deferred_args[0] = structure_h;
        deferred_args[1] = dv_h;
        deferred_args[2] = prefilled_table_h;
        const deferred = php.createValuePointer(@ptrCast(deferred_args.ptr));
        return self.addHandle(deferred);
    }
    const memory = self.dereference(dv_h);
    const prefilled_table = if (prefilled_table_h) |vh| self.dereference(vh) else null;
    const buf = try php.getValuePointer(*ByteBuffer, memory);
    const instance = try class.obtainObjectFromBuffer(buf, prefilled_table);
    const value = php.createValueObject(instance);
    if (instance.gc.refcount > 1) {
        if (self.findHandle(value)) |handle| {
            // existing object--decrement ref count
            instance.subtractRef;
            return handle;
        }
    }
    return self.addHandle(value);
}

pub fn createTemplate(self: *@This(), dv_h: ?Handle, slots_h: ?Handle) !Handle {
    const arr: *Array = .createNonDestructive();
    if (dv_h) |vh| {
        const dv = self.dereference(vh);
        arr.set(N("buffer"), dv);
    }
    if (slots_h) |vh| {
        const slots = self.dereference(vh);
        arr.set(N("table"), slots);
    }
    const value: Value = .fromArray(arr);
    return self.addHandle(value);
}

pub fn createList(self: *@This()) !Handle {
    return self.createObject();
}

pub fn createObject(self: *@This()) !Handle {
    const arr = .createNonDestructive();
    const value: Value = .fromArray(arr);
    return self.addHandle(value);
}

pub fn appendList(self: *@This(), list_h: Handle, element_h: Handle) !void {
    const list_v = self.dereference(list_h);
    const list = try list_v.getArray();
    const element = self.dereference(element_h);
    try list.append(element);
}

pub fn getProperty(self: *@This(), container_h: Handle, key_bytes: [*]const u8, key_len: usize) !Handle {
    const key = key_bytes[0..key_len];
    const key_str: String = .createInterned(key);
    const container_v = self.dereference(container_h);
    const container = try container_v.getArray();
    const value = try container.get(key_str);
    return self.findHandle(value.*) orelse error.Unexpected;
}

pub fn setProperty(self: *@This(), container_h: Handle, key_bytes: [*]const u8, key_len: usize, value_h: ?Handle) !void {
    const key = key_bytes[0..key_len];
    const key_str: String = .createInterned(key);
    const container_v = self.dereference(container_h);
    const container = try container_v.getArray();
    if (value_h) |vh| {
        const value = self.dereference(vh);
        try container.set(key_str, value);
    } else {
        try container.delete(key_str);
    }
}

pub fn getSlotValue(self: *@This(), container_h: Handle, slot: usize) !Handle {
    const container_v = self.dereference(container_h);
    const container = try container_v.getArray();
    const value = try container.get(slot);
    return self.findHandle(value.*) orelse error.Unexpected;
}

pub fn setSlotValue(self: *@This(), container_h: Handle, slot: usize, value_h: ?Handle) !void {
    const container_v = self.dereference(container_h);
    const container = try container_v.getArray();
    if (value_h) |vh| {
        const value = self.dereference(vh);
        try container.set(slot, value);
    } else {
        try container.delete(slot);
    }
}

pub fn getStructure(self: *@This(), key_bytes: [*]const u8, key_len: usize) !Handle {
    const key = key_bytes[0..key_len];
    const key_str: *String = .createInterned(key);
    const structure_v = try self.structure_map.get(key_str);
    return self.findHandle(structure_v.*) orelse error.Unexpected;
}

pub fn setStructure(self: *@This(), key_bytes: [*]const u8, key_len: usize, handle: ?Handle) !void {
    const key = key_bytes[0..key_len];
    const key_str: *String = .createInterned(key);
    if (handle) |structure_h| {
        const structure_v = self.dereference(structure_h);
        const structure = try structure_v.getArray();
        self.structure_map.set(key_str, structure_v);
        // const class_obj = try ZigClassEntry.create(self.host, structure_v);
        const class_v: Value = .fronObject(class_obj);
        try structure.set(N("class"), &class_v);
        try self.class_list.append(php_al, class_obj);
    } else {
        self.structure_map.delete.delete(key_str);
    }
}

pub fn beginStructure(self: *@This(), structure_h: Handle) !void {
    const structure_v = self.dereference(structure_h);
    const structure = try structure_v.getArray();
    const class_v = try structure.get(N("class"));
    const class_obj = try class_v.getObject();
    const class = try ZigClassEntry.fromValue(class_value);
    try class.define(structure_v);
}

pub fn finishStructure(self: *@This(), structure_h: Handle) !void {
    const structure_v = self.dereference(structure_h);
    const structure = try structure_v.getArray();
    const class_value = try structure.get(N("class"));
    const class_obj = try class_v.getObject();
    const class = try ZigClassEntry.fromValue(class_value);
    try class.finalize(structure_v);
}

pub fn enableCallback(self: *@This(), structure_h: Handle, template_h: Handle, member_flags_h: Handle) !void {
    const structure_v = self.dereference(structure_h);
    const structure = try structure_v.getArray();
    const template = self.dereference(template_h);
    const member_flags = self.dereference(member_flags_h);
    // attach static template, which holds the JS controller pointer
    const class_v = try structure.get(N("class"));
    const class_obj = try class_v.getObject();
    const class = try ZigClassEntry.fromValue(class_v);
    if (class.status.finalized) {
        try class.setStaticTemplate(template);
    } else {
        const func_static_v = try structure_v.get(N("static"));
        const func_static_obj = try func_static_v.getObject();
        try func_static_obj.set(N("template"), template);
    }
    // set argument flags
    try class.setArgumentFlags(member_flags);
}

pub const Handle = *opaque {};

value_list: std.ArrayList(Value),
class_list: std.ArrayList(*Object),
buffer_map: BufferMap,
structure_map: *Array,
counters: struct {
    @"struct": usize = 0,
    @"union": usize = 0,
    error_set: usize = 0,
    @"enum": usize = 0,
    @"opaque": usize = 0,
} = .{},
host: *ModuleHost,
has_deferred: bool = false,
