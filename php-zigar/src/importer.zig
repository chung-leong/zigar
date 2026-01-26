const std = @import("std");

const ByteBuffer = @import("buffer.zig").ByteBuffer;
const hooks = @import("module/native/hooks.zig");
const ModuleGeneric = @import("module/native/interface.zig").Module;
const ModuleHost = @import("host.zig").ModuleHost;
const php = @import("php.zig");
const HashTable = php.HashTable;
const HashPosition = php.HashPosition;
const String = php.String;
const Value = php.Value;
const ZigClass = @import("class.zig").ZigClass;

pub const StructureImporter = struct {
    value_list: std.ArrayList(Value),
    structure_map: HashTable,
    instance_list: HashTable,
    class_list: HashTable,
    key_memory: *String,
    key_slots: *String,
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
        self.* = .{
            .value_list = try .initCapacity(php.allocator, 64),
            .structure_map = php.createHashTable(null),
            .instance_list = php.createHashTable(null),
            .class_list = php.createHashTable(null),
            .key_memory = php.createInternedString("memory"),
            .key_slots = php.createInternedString("slots"),
            .host = host,
        };
        return self;
    }

    pub fn deinit(self: *@This()) void {
        for (self.value_list.items) |*item| {
            if (php.getValuePointer(*ByteBuffer, item)) |b|
                b.release()
            else |_|
                php.release(item);
        }
        self.value_list.deinit(php.allocator);
        php.destroyHashTable(&self.structure_map);
        php.destroyHashTable(&self.instance_list);
        php.destroyHashTable(&self.class_list);
        php.allocator.destroy(self);
    }

    pub fn activateStructures(self: *@This()) !*Value {
        // the last class to get finalized is the root namespace
        var last: ?*Value = null;
        var pos: HashPosition = undefined;
        php.initializeHashPosition(&self.class_list, &pos);
        while (php.getHashPositionValue(&self.class_list, &pos)) |value| {
            // initially, the host holds references to ZigClass objects through the "class"
            // property in the info hash tables; prior to destroying these we'll flip the
            // relationship so that these objects own the host instead;
            ZigClass.activate(value);
            last = value;
            if (!php.moveHashPositionForward(&self.class_list, &pos)) break;
        }
        const root = last orelse return error.NoRoot;
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

    pub fn createView(self: *@This(), bytes: ?[*]const u8, len: usize, copying: bool, _: usize) !Handle {
        var buffer: *ByteBuffer = undefined;
        if (bytes) |b| {
            const slice = b[0..len];
            if (copying) {
                buffer = try ByteBuffer.createCopy(slice, 1);
                buffer.protect();
            } else {
                buffer = try ByteBuffer.createExternal(@constCast(slice));
            }
        } else {
            buffer = try ByteBuffer.createExternal("");
        }
        const value = php.createValuePointer(buffer);
        return self.allocateValue(value);
    }

    pub fn createInstance(self: *@This(), structure: Handle, dv: Handle, prefilled_slots: ?Handle) !Handle {
        var value = try ZigClass.createInstance(
            self.dereference(structure),
            self.dereference(dv),
            if (prefilled_slots) |s| self.dereference(s) else null,
        );
        _ = php.appendHashEntry(&self.instance_list, &value);
        return self.allocateValue(value);
    }

    pub fn createTemplate(self: *@This(), dv: ?Handle, slots: ?Handle) !Handle {
        var value: Value = php.createValueArray(null);
        if (dv) |v| try php.setPropertyRef(
            &value,
            self.key_memory,
            self.dereference(v),
        );
        if (slots) |v| try php.setPropertyRef(
            &value,
            self.key_slots,
            self.dereference(v),
        );
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

    pub fn appendList(self: *@This(), list: Handle, element: Handle) !void {
        try php.addElementRef(
            self.dereference(list),
            self.dereference(element),
        );
    }

    pub fn getProperty(self: *@This(), object: Handle, key_bytes: [*]const u8, key_len: usize) !Handle {
        const value = try php.getProperty(
            self.dereference(object),
            php.createInternedString(key_bytes[0..key_len]),
        );
        return self.allocateValue(value.*);
    }

    pub fn setProperty(self: *@This(), object: Handle, key_bytes: [*]const u8, key_len: usize, value: ?Handle) !void {
        const key = php.createInternedString(key_bytes[0..key_len]);
        if (value) |v|
            try php.setPropertyRef(
                self.dereference(object),
                key,
                self.dereference(v),
            )
        else
            try php.deleteProperty(
                self.dereference(object),
                key,
            );
    }

    pub fn getSlotValue(self: *@This(), object: Handle, slot: usize) !Handle {
        const value = try php.getProperty(
            self.dereference(object),
            slot,
        );
        return self.allocateValue(value.*);
    }

    pub fn setSlotValue(self: *@This(), object: Handle, slot: usize, value: ?Handle) !void {
        if (value) |v|
            try php.setPropertyRef(
                self.dereference(object),
                slot,
                self.dereference(v),
            )
        else
            try php.deleteProperty(
                self.dereference(object),
                slot,
            );
    }

    pub fn getStructure(self: *@This(), key_bytes: [*]const u8, key_len: usize) !Handle {
        const key = key_bytes[0..key_len];
        const structure = try php.getHashEntry(&self.structure_map, key);
        if (structure.u1.type_info == 0xaaaaaaaa) @panic("WTF??????");
        return self.allocateValue(structure.*);
    }

    pub fn setStructure(self: *@This(), key_bytes: [*]const u8, key_len: usize, value: ?Handle) !void {
        const key = key_bytes[0..key_len];
        if (value) |v|
            try php.setHashEntryRef(
                &self.structure_map,
                key,
                self.dereference(v),
            )
        else
            try php.deleteHashEntry(&self.structure_map, key);
    }

    pub fn beginStructure(self: *@This(), structure: Handle) !void {
        try ZigClass.define(
            self.host,
            self.dereference(structure),
        );
    }

    pub fn finishStructure(self: *@This(), structure: Handle) !void {
        const class = try ZigClass.finalize(
            self.dereference(structure),
        );
        _ = php.appendHashEntry(&self.class_list, class);
    }

    pub fn enableCallback(self: *@This(), structure: Handle, template: Handle, member_flags: Handle) !void {
        _ = self;
        _ = structure;
        _ = template;
        _ = member_flags;
    }
};
