const std = @import("std");

const ByteBuffer = @import("buffer.zig").ByteBuffer;
const Comptime = @import("structure.zig").Comptime;
const Function = @import("structure.zig").Function;
const hooks = @import("module/native/hooks.zig");
const ModuleGeneric = @import("module/native/interface.zig").Module;
const ModuleHost = @import("host.zig").ModuleHost;
const php = @import("php.zig");
const N = php.getStaticString;
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("structure.zig");
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;

pub const StructureImporter = struct {
    value_list: std.ArrayList(Value),
    class_list: std.ArrayList(*Object),
    structure_map: HashTable,
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
        self.* = .{
            .value_list = value_list,
            .class_list = class_list,
            .structure_map = php.createHashTable(null),
            .host = host,
        };
        return self;
    }

    pub fn deinit(self: *@This()) void {
        for (self.value_list.items) |*item| {
            if (php.getValuePointer(*ByteBuffer, item) catch null) |b| {
                b.release();
            } else {
                php.release(item);
            }
        }
        for (self.class_list.items) |class_obj| {
            php.release(class_obj);
        }
        self.value_list.deinit(php.allocator);
        self.class_list.deinit(php.allocator);
        php.destroyHashTable(&self.structure_map);
        php.allocator.destroy(self);
    }

    pub fn activateStructures(self: *@This()) !*Object {
        // the last class to get finalized is the root namespace
        if (self.class_list.items.len == 0) return error.NoRoot;
        const root_obj = self.class_list.items[0];
        // initially, the host holds references to class objects through class_list
        // prior to destroying that list we need to flip the relationship so that
        // these objects own the host instead
        for (self.class_list.items) |class_obj| try ZigClassEntry.activate(class_obj);
        const root_class = ZigClassEntry.fromObject(root_obj);
        const root_static = root_class.getStaticData(structure.Struct);
        try root_static.markAsRoot();
        return php.reuse(root_obj);
    }

    fn allocateHandle(self: *@This(), value: Value) Handle {
        const handle_value = for (self.value_list.items, 0..) |*item, i| {
            if (item.u1.v.type == value.u1.v.type and item.value.ptr == value.value.ptr)
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
        return self.allocateHandle(value);
    }

    pub fn createInteger(self: *@This(), initializer: i32, unsigned: bool) !Handle {
        const value = if (unsigned)
            php.createValueAnyInt(@as(u32, @bitCast(initializer)))
        else
            php.createValueAnyInt(initializer);
        return self.allocateHandle(value);
    }

    pub fn createBigInteger(self: *@This(), initializer: i64, unsigned: bool) !Handle {
        const value = if (unsigned)
            php.createValueAnyInt(@as(u64, @bitCast(initializer)))
        else
            php.createValueAnyInt(initializer);
        return self.allocateHandle(value);
    }

    pub fn createString(self: *@This(), bytes: [*]const u8, len: usize) !Handle {
        const value = php.createValueStringContent(bytes[0..len]);
        return self.allocateHandle(value);
    }

    pub fn createView(self: *@This(), bytes: ?[*]const u8, len: usize, copying: bool, read_only: bool, _: usize, alignment: usize) !Handle {
        if (!std.math.isPowerOfTwo(alignment)) return error.InvalidAlignment;
        const buffer = try ByteBuffer.create(std.mem.Alignment.fromByteUnits(alignment));
        if (bytes) |b| {
            const slice = b[0..len];
            if (copying) {
                try buffer.allocate(null, len);
                try buffer.copyBytes(slice);
            } else {
                buffer.referenceExternal(slice);
            }
        } else {
            buffer.referenceExternal(&.{});
        }
        if (read_only) buffer.protect();
        const value = php.createValuePointer(buffer);
        return self.allocateHandle(value);
    }

    pub fn createInstance(self: *@This(), structure_h: Handle, dv_h: Handle, prefilled_table_h: ?Handle) !Handle {
        const structure_v = self.dereference(structure_h);
        const class_value = try php.getProperty(structure_v, N("class"));
        const class_obj = try php.getValueObject(class_value);
        const class = ZigClassEntry.fromObject(class_obj);
        const memory = self.dereference(dv_h);
        const buf = try php.getValuePointer(*ByteBuffer, memory);
        const prefilled_table = if (prefilled_table_h) |vh| self.dereference(vh) else null;
        const instance = try class.createObjectFromBuffer(buf, prefilled_table);
        const value = php.createValueObject(instance);
        return self.allocateHandle(value);
    }

    pub fn createTemplate(self: *@This(), dv_h: ?Handle, slots_h: ?Handle) !Handle {
        const ht = php.createNonDestructiveArray();
        if (dv_h) |vh| {
            const dv = self.dereference(vh);
            php.setHashEntry(ht, N("buffer"), dv);
        }
        if (slots_h) |vh| {
            const slots = self.dereference(vh);
            php.setHashEntry(ht, N("table"), slots);
        }
        const value: Value = php.createValueArray(ht);
        return self.allocateHandle(value);
    }

    pub fn createList(self: *@This()) !Handle {
        return self.createObject();
    }

    pub fn createObject(self: *@This()) !Handle {
        const ht = php.createNonDestructiveArray();
        const value = php.createValueArray(ht);
        return self.allocateHandle(value);
    }

    pub fn appendList(self: *@This(), list_h: Handle, element_h: Handle) !void {
        const list = self.dereference(list_h);
        const element = self.dereference(element_h);
        try php.addElement(list, element);
    }

    pub fn getProperty(self: *@This(), object_h: Handle, key_bytes: [*]const u8, key_len: usize) !Handle {
        const key = key_bytes[0..key_len];
        const key_str = php.createInternedString(key);
        const object = self.dereference(object_h);
        const value = try php.getProperty(object, key_str);
        return self.allocateHandle(value.*);
    }

    pub fn setProperty(self: *@This(), object_h: Handle, key_bytes: [*]const u8, key_len: usize, value_h: ?Handle) !void {
        const key = key_bytes[0..key_len];
        const key_str = php.createInternedString(key);
        const object = self.dereference(object_h);
        if (value_h) |vh| {
            const value = self.dereference(vh);
            // the exporter uses structure arrays to refer to types, replace them with class objects
            const actual_value = php.getProperty(value, "class") catch value;
            try php.setProperty(object, key_str, actual_value);
        } else {
            try php.deleteProperty(object, key_str);
        }
    }

    pub fn getSlotValue(self: *@This(), object_h: Handle, slot: usize) !Handle {
        const object = self.dereference(object_h);
        const value = try php.getProperty(object, slot);
        return self.allocateHandle(value.*);
    }

    pub fn setSlotValue(self: *@This(), object_h: Handle, slot: usize, value_h: ?Handle) !void {
        const object = self.dereference(object_h);
        if (value_h) |vh| {
            const value = self.dereference(vh);
            const actual_value = php.getProperty(value, "class") catch value;
            try php.setProperty(object, slot, actual_value);
        } else {
            try php.deleteProperty(object, slot);
        }
    }

    pub fn getStructure(self: *@This(), key_bytes: [*]const u8, key_len: usize) !Handle {
        const key = key_bytes[0..key_len];
        const key_str = php.createInternedString(key);
        const structure_v = try php.getHashEntry(&self.structure_map, key_str);
        return self.allocateHandle(structure_v.*);
    }

    pub fn setStructure(self: *@This(), key_bytes: [*]const u8, key_len: usize, handle: ?Handle) !void {
        const key = key_bytes[0..key_len];
        const key_str = php.createInternedString(key);
        if (handle) |structure_h| {
            const structure_v = self.dereference(structure_h);
            php.setHashEntry(&self.structure_map, key_str, structure_v);
            const class_obj = try ZigClassEntry.create(self.host, structure_v);
            var class_value = php.createValueObject(class_obj);
            try php.setProperty(structure_v, N("class"), &class_value);
            try self.class_list.append(php.allocator, class_obj);
        } else {
            php.deleteHashEntry(&self.structure_map, key_str);
        }
    }

    pub fn beginStructure(self: *@This(), structure_h: Handle) !void {
        const structure_v = self.dereference(structure_h);
        const class_value = try php.getProperty(structure_v, N("class"));
        const class_obj = try php.getValueObject(class_value);
        try ZigClassEntry.defineStructure(class_obj, structure_v);
    }

    pub fn finishStructure(self: *@This(), structure_h: Handle) !void {
        const structure_v = self.dereference(structure_h);
        const class_value = try php.getProperty(structure_v, N("class"));
        const class_obj = try php.getValueObject(class_value);
        try ZigClassEntry.finalizeStructure(class_obj, structure_v);
    }

    pub fn enableCallback(self: *@This(), structure_h: Handle, template_h: Handle, member_flags_h: Handle) !void {
        const structure_v = self.dereference(structure_h);
        const template = self.dereference(template_h);
        const member_flags = self.dereference(member_flags_h);
        const func_value = try php.getProperty(structure_v, N("class"));
        const func_obj = try php.getValueObject(func_value);
        const func_class = ZigClassEntry.fromObject(func_obj);
        try func_class.enableCallback(template, member_flags);
    }
};
