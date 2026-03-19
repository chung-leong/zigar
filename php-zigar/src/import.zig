const std = @import("std");

const ByteBuffer = @import("buffer.zig").ByteBuffer;
const Comptime = @import("structure.zig").Comptime;
const Function = @import("structure.zig").Function;
const hooks = @import("module/native/hooks.zig");
const ModuleGeneric = @import("module/native/interface.zig").Module;
const ModuleHost = @import("host.zig").ModuleHost;
const php = @import("php.zig");
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigObject = @import("object.zig").ZigObject;

pub const StructureImporter = struct {
    value_list: std.ArrayList(Value),
    instance_list: std.ArrayList(*Object),
    class_list: std.ArrayList(*Object),
    structure_map: HashTable,
    keys: struct {
        memory: *String,
        slots: *String,
        class: *String,
    },
    counters: struct {
        @"struct": usize = 0,
        @"union": usize = 0,
        error_set: usize = 0,
        @"enum": usize = 0,
        @"opaque": usize = 0,
    } = .{},
    host: *ModuleHost,

    pub const Handle = *opaque {};

    pub fn init(host: *ModuleHost) !*@This() {
        const self = try php.allocator.create(@This());
        errdefer php.allocator.destroy(self);
        var value_list: std.ArrayList(Value) = try .initCapacity(php.allocator, 64);
        errdefer value_list.deinit(php.allocator);
        var class_list: std.ArrayList(*Object) = try .initCapacity(php.allocator, 32);
        errdefer class_list.deinit(php.allocator);
        var instance_list: std.ArrayList(*Object) = try .initCapacity(php.allocator, 32);
        errdefer instance_list.deinit(php.allocator);
        self.* = .{
            .value_list = value_list,
            .instance_list = instance_list,
            .class_list = class_list,
            .structure_map = php.createHashTable(php.destructor.value),
            .keys = .{
                .memory = php.createInternedString("memory"),
                .slots = php.createInternedString("slots"),
                .class = php.createInternedString("class"),
            },
            .host = host,
        };
        return self;
    }

    pub fn deinit(self: *@This()) void {
        php.destroyHashTable(&self.structure_map);
        for (self.value_list.items) |*item| {
            if (php.getValuePointer(*ByteBuffer, item)) |b| {
                b.release();
            } else |_| {
                php.release(item);
            }
        }
        self.value_list.deinit(php.allocator);
        self.instance_list.deinit(php.allocator);
        self.class_list.deinit(php.allocator);
        php.allocator.destroy(self);
    }

    pub fn activateStructures(self: *@This()) !*Object {
        // initially, the host holds references to ZigClassEntry objects through the "class"
        // property in the structure arrays; prior to destroying these we need to flip the
        // relationship so that these objects own the host instead
        for (self.class_list.items) |class_obj| try ZigClassEntry.activate(class_obj);
        // the exporter uses structure arrays to refer to types, since their class object
        // (i.e. their constructor) would have been created yet when a struct has a pointer
        // to its own kind; we're going to fix that here
        for (self.instance_list.items) |instance_obj| {
            const class = ZigClassEntry.fromObject(instance_obj);
            if (class.type == .@"comptime") {
                const ct_struct = ZigObject(Comptime).fromObject(instance_obj).structure();
                // comptime only uses one slot; so if slots is an array, it's a structure array
                const arr = php.getValueArray(&ct_struct.slots) catch continue;
                // replace the array with the class ref and release it
                const class_value = try php.getHashEntry(arr, self.keys.class);
                ct_struct.slots = class_value.*;
                php.addRef(class_value);
                php.release(arr);
                // TODO: find out why there's an extra reference on the array
                // php.release(arr);
            }
        }
        // the last class to get finalized is the root namespace
        if (self.class_list.items.len == 0) return error.NoRoot;
        const root = self.class_list.items[0];
        php.addRef(root);
        return root;
    }

    fn allocateValue(self: *@This(), value: Value) Handle {
        const handle_value = for (self.value_list.items, 0..) |*item, i| {
            if (item.u1.type_info == value.u1.type_info and item.value.ptr == value.value.ptr)
                break i + 1;
        } else insert: {
            self.value_list.append(php.allocator, value) catch
                @panic("Unable to allocate value");
            break :insert self.value_list.items.len;
        };
        return @ptrFromInt(handle_value);
    }

    fn dereference(self: *@This(), handle: Handle) *Value {
        const handle_value = @intFromPtr(handle);
        return &self.value_list.items[handle_value - 1];
    }

    pub fn createBool(self: *@This(), initializer: bool) !Handle {
        const value = php.createValueBool(initializer);
        return self.allocateValue(value);
    }

    pub fn createInteger(self: *@This(), initializer: i32, unsigned: bool) !Handle {
        const value = if (unsigned)
            php.createValueAnyInt(@as(u32, @bitCast(initializer)))
        else
            php.createValueAnyInt(initializer);
        return self.allocateValue(value);
    }

    pub fn createBigInteger(self: *@This(), initializer: i64, unsigned: bool) !Handle {
        const value = if (unsigned)
            php.createValueAnyInt(@as(u64, @bitCast(initializer)))
        else
            php.createValueAnyInt(initializer);
        return self.allocateValue(value);
    }

    pub fn createString(self: *@This(), bytes: [*]const u8, len: usize) !Handle {
        const value = php.createValueStringContent(bytes[0..len]);
        return self.allocateValue(value);
    }

    pub fn createView(self: *@This(), bytes: ?[*]const u8, len: usize, copying: bool, _: usize, alignment: usize) !Handle {
        var buffer: *ByteBuffer = undefined;
        if (bytes) |b| {
            const slice = b[0..len];
            if (!std.math.isPowerOfTwo(alignment)) {
                return error.InvalidAlignment;
            }
            const align_enum = std.mem.Alignment.fromByteUnits(alignment);
            if (copying) {
                buffer = try ByteBuffer.createCopy(slice, align_enum);
                buffer.protect();
            } else {
                buffer = try ByteBuffer.createExternal(@constCast(slice), align_enum);
            }
        } else {
            buffer = try ByteBuffer.createExternal(&.{}, .@"1");
            if (copying) buffer.protect();
        }
        const value = php.createValuePointer(buffer);
        return self.allocateValue(value);
    }

    pub fn createInstance(self: *@This(), structure_h: Handle, dv_h: Handle, prefilled_slots_h: ?Handle) !Handle {
        const structure = self.dereference(structure_h);
        const class_value = try php.getProperty(structure, self.keys.class);
        const class_obj = try php.getValueObject(class_value);
        const class = ZigClassEntry.fromObject(class_obj);
        const memory = self.dereference(dv_h);
        const bytes = try php.getValuePointer(*ByteBuffer, memory);
        const prefilled_slots = if (prefilled_slots_h) |vh| self.dereference(vh) else null;
        const instance = try class.obtainObjectFromBuffer(bytes, prefilled_slots);
        try self.instance_list.append(php.allocator, instance);
        const value = php.createValueObject(instance);
        return self.allocateValue(value);
    }

    pub fn createTemplate(self: *@This(), dv_h: ?Handle, slots_h: ?Handle) !Handle {
        var value: Value = php.createValueArray(null);
        if (dv_h) |vh| {
            const dv = self.dereference(vh);
            try php.setPropertyRef(&value, self.keys.memory, dv);
        }
        if (slots_h) |vh| {
            const slots = self.dereference(vh);
            try php.setPropertyRef(&value, self.keys.slots, slots);
        }
        return self.allocateValue(value);
    }

    pub fn createList(self: *@This()) !Handle {
        const value = php.createValueArray(null);
        return self.allocateValue(value);
    }

    pub fn createObject(self: *@This()) !Handle {
        const value = php.createValueArray(null);
        return self.allocateValue(value);
    }

    pub fn appendList(self: *@This(), list_h: Handle, element_h: Handle) !void {
        const list = self.dereference(list_h);
        const element = self.dereference(element_h);
        try php.addElementRef(list, element);
    }

    pub fn getProperty(self: *@This(), object_h: Handle, key_bytes: [*]const u8, key_len: usize) !Handle {
        const object = self.dereference(object_h);
        const key = php.createInternedString(key_bytes[0..key_len]);
        const value = try php.getProperty(object, key);
        return self.allocateValue(value.*);
    }

    pub fn setProperty(self: *@This(), object_h: Handle, key_bytes: [*]const u8, key_len: usize, value_h: ?Handle) !void {
        const key = php.createInternedString(key_bytes[0..key_len]);
        const object = self.dereference(object_h);
        if (value_h) |vh| {
            const value = self.dereference(vh);
            try php.setPropertyRef(object, key, value);
        } else {
            try php.deleteProperty(object, key);
        }
    }

    pub fn getSlotValue(self: *@This(), object_h: Handle, slot: usize) !Handle {
        const object = self.dereference(object_h);
        const value = try php.getProperty(object, slot);
        return self.allocateValue(value.*);
    }

    pub fn setSlotValue(self: *@This(), object_h: Handle, slot: usize, value_h: ?Handle) !void {
        const object = self.dereference(object_h);
        if (value_h) |vh| {
            const value = self.dereference(vh);
            try php.setPropertyRef(object, slot, value);
        } else {
            try php.deleteProperty(object, slot);
        }
    }

    pub fn getStructure(self: *@This(), key_bytes: [*]const u8, key_len: usize) !Handle {
        const key = key_bytes[0..key_len];
        const structure = try php.getHashEntry(&self.structure_map, key);
        return self.allocateValue(structure.*);
    }

    pub fn setStructure(self: *@This(), key_bytes: [*]const u8, key_len: usize, value_h: ?Handle) !void {
        const key = key_bytes[0..key_len];
        if (value_h) |vh| {
            const value = self.dereference(vh);
            php.setHashEntryRef(&self.structure_map, key, value);
        } else {
            try php.deleteHashEntry(&self.structure_map, key);
        }
    }

    pub fn beginStructure(self: *@This(), structure_h: Handle) !void {
        const structure = self.dereference(structure_h);
        const class_obj = try ZigClassEntry.define(self.host, structure);
        var class_value = php.createValueObject(class_obj);
        try php.setProperty(structure, self.keys.class, &class_value);
        try self.class_list.append(php.allocator, class_obj);
    }

    pub fn finishStructure(self: *@This(), structure_h: Handle) !void {
        const structure = self.dereference(structure_h);
        const class_value = try php.getProperty(structure, self.keys.class);
        const class_obj = try php.getValueObject(class_value);
        try ZigClassEntry.finalize(class_obj, structure);
    }

    pub fn enableCallback(self: *@This(), structure_h: Handle, template_h: Handle, member_flags_h: Handle) !void {
        const structure = self.dereference(structure_h);
        const template = self.dereference(template_h);
        const member_flags = self.dereference(member_flags_h);
        const func_value = try php.getProperty(structure, self.keys.class);
        const func_obj = try php.getValueObject(func_value);
        const func_class = ZigClassEntry.fromObject(func_obj);
        try func_class.enableCallback(template, member_flags);
    }
};
