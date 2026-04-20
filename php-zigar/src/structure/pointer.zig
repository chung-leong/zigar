const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const cache = @import("../cache.zig");
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const failure = @import("../failure.zig");
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const HashTable = php.HashTable;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");
const invokeMethod = structure.invokeMethod;

pub const Pointer = struct {
    last_address: usize = 0,
    last_length: usize = 0,
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    const Super = structure.OptionalLike(@This());
    const prop_id_aliases = .{ .@"*" = .target };

    pub const Static = struct {
        target_class: *ZigClassEntry = undefined,
        address_acc: *accessor.Int(.{ .bit_size = @bitSizeOf(usize), .signedness = .unsigned }) = undefined,
        length_acc: ?*accessor.Int(.{ .bit_size = @bitSizeOf(usize), .signedness = .unsigned }) = null,

        pub const StaticPropCache = cache.IdCache(.{.child}, .{});

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const target_member = try class.getMember(.instance, 0);
            self.target_class = target_member.class;
            const address_member = try class.getMember(.instance, 1);
            const usize_tag = switch (@bitSizeOf(usize)) {
                64 => .u64,
                32 => .u32,
                else => @compileError("Unsupported pointer size"),
            };
            if (address_member.accessors != usize_tag) return error.Unexpected;
            self.address_acc = &@field(address_member.accessors, @tagName(usize_tag));
            if (class.getMember(.instance, 2) catch null) |length_member| {
                if (length_member.accessors != usize_tag) return error.Unexpected;
                self.length_acc = &@field(length_member.accessors, @tagName(usize_tag));
            }
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
            const extent = try invokeMethod(target_obj, "getExtent", .{});
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

        pub fn getStaticProperty(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) !Value {
            if (StaticPropCache.idFromString(name, cache_slot)) |id| {
                const prop_obj = switch (id) {
                    .child => self.target_class.object,
                };
                php.addRef(prop_obj);
                return php.createValueObject(prop_obj);
            } else {
                return error.Missing;
            }
        }

        pub fn staticPropertyExists(_: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) bool {
            return StaticPropCache.idFromString(name, cache_slot) != null;
        }
    };
    pub const PropCache = cache.IdCache(.{.target}, .{ .@"*" = .target });

    pub fn getValue(self: *@This(), transform: accessor.Transform) accessor.Error!Value {
        if (self.buffer.flags.inaccessible) return self.reportInaccessiblePointer();
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.loadTarget(self);
        const target_obj = php.getValueObject(&self.table) catch return error.NullPointer;
        switch (transform) {
            .none => {
                php.addRef(target_obj);
                return php.createValueObject(target_obj);
            },
            else => {
                return try invokeMethod(target_obj, "getValue", .{transform});
            },
        }
    }

    pub fn setValue(self: *@This(), value: *const Value, transform: accessor.Transform) accessor.Error!void {
        if (self.buffer.flags.inaccessible) {
            if (!php.isValueNull(value)) return self.reportInaccessiblePointer();
        }
        if (transform == .none) {
            if (try Super.copySelf(self, value)) return;
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            const target_obj = init: {
                // using the allocator associated with the pointer for autovivification new target,
                const allocator = self.buffer.getSourceAllocator();
                const target_class = static.target_class;
                switch (php.getValueType(value)) {
                    .object => {
                        const obj = php.getValueObject(value) catch unreachable;
                        if (php.instanceOf(obj.ce, target_class.entry())) {
                            // point to existing object
                            php.addRef(obj);
                            break :init obj;
                        }
                    },
                    .pointer => {
                        const ptr = php.getValuePointer(*anyopaque, value) catch unreachable;
                        const address = @intFromPtr(ptr);
                        try static.setAddress(self, address);
                        return;
                    },
                    .null => {
                        php.release(&self.table);
                        self.table = php.createValueNull();
                        try static.setAddress(self, 0);
                        return;
                    },
                    else => {},
                }
                // autovivificate new target,
                const read_only = class.flags.pointer.is_const;
                break :init try target_class.createObject(allocator, value, read_only);
            };
            try static.saveTarget(self, target_obj);
        } else {
            return Super.setValue(self, value, transform);
        }
    }

    pub fn visitPointers(self: *@This(), cb: anytype, args: anytype, comptime _: structure.VisitOptions) accessor.Error!void {
        try @call(.auto, cb, .{self} ++ args);
    }

    pub fn getProperty(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) accessor.Error!Value {
        const target_obj = try self.getTarget();
        if (PropCache.idFromString(name, cache_slot)) |id| {
            const prop_obj = switch (id) {
                .target => target_obj,
            };
            php.addRef(prop_obj);
            return php.createValueObject(prop_obj);
        } else {
            try self.checkDoubleReference();
            return try invokeMethod(target_obj, "getProperty", .{ name, cache_slot });
        }
    }

    pub fn setProperty(self: *@This(), name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) accessor.Error!void {
        if (PropCache.idFromString(name, cache_slot)) |id| {
            switch (id) {
                .target => try self.setValue(value, .none),
            }
        } else {
            const target_obj = try self.getTarget();
            try self.checkDoubleReference();
            try invokeMethod(target_obj, "setProperty", .{ name, value, cache_slot });
        }
    }

    pub fn propertyExists(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) bool {
        return PropCache.idFromString(name, cache_slot) != null or check: {
            const target_obj = self.getTarget() catch return false;
            self.checkDoubleReference() catch return false;
            break :check invokeMethod(target_obj, "propertyExists", .{ name, cache_slot }) catch unreachable;
        };
    }

    pub fn externalizeTarget(self: *@This()) accessor.Error!void {
        const obj = php.getValueObject(&self.table) catch return;
        try invokeMethod(obj, "externalize", .{});
    }

    pub fn restrictAccess(self: *@This()) !void {
        self.buffer.flags.inaccessible = true;
    }

    fn getTarget(self: *@This()) !*Object {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.loadTarget(self);
        return php.getValueObject(&self.table) catch return error.NullPointer;
    }

    fn checkDoubleReference(self: *@This()) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        if (static.target_class.type == .pointer) {
            return self.reportNoAutoDereference();
        }
    }

    fn reportInaccessiblePointer(_: *@This()) error{Unexpected} {
        return failure.report("pointer is inaccessible because it's in an untagged union", .{});
    }

    fn reportNoAutoDereference(self: *@This()) error{Unexpected} {
        const class = ZigClassEntry.fromStructure(self);
        return failure.report("cannot access properties through pointer '{s}', only one level of automatic dereferencing", .{
            class.getName(),
        });
    }

    pub const getExtent = Super.getExtent;
    pub const setStorage = Super.setStorage;
    pub const initialize = Super.initialize;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const checkArguments = Super.checkArguments;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const getIterator = Super.getIterator;
    const fromObject = Super.fromObject;
    const reportFieldError = Super.reportFieldError;
};
