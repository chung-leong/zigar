const std = @import("std");

const accessor = @import("../accessor.zig");
const Transform = accessor.Transform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const failure = @import("../failure.zig");
const iterator = @import("../iterator.zig");
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Enum = struct {
    canonical: ?*Canonical = null,
    buffer: *ByteBuffer = undefined,

    const Canonical = struct {
        name: *String,
        unknown: bool = false,

        pub fn release(self: *@This()) void {
            php.release(self.name);
            php.allocator.destroy(self);
        }
    };

    const Super = structure.StructLike(@This());

    pub const Static = struct {
        prop_names: []*String = &.{},
        constant_acc: *accessor.Constant = undefined,
        available_tags: HashTable = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member = try class.getMember(.instance, 0);
            if (member.accessors != .constant) {
                std.debug.print("member type = {}\n", .{member.type});
                std.debug.print("bit size = {}\n", .{member.bit_size});
                std.debug.print("byte size = {?}\n", .{member.byte_size});
                std.debug.print("bit offset = {?}\n", .{member.bit_offset});
                std.debug.print("structure type = {}\n", .{member.class.type});
                std.debug.print("access type = {}\n", .{member.accessors.getType()});
                return error.Unexpected;
            }
            self.constant_acc = &member.accessors.constant;
            // loop through static members and add them to a hash table, keyed by
            // their integer values and names
            self.available_tags = php.createHashTable(null);
            if (class.static.template.table) |*static_table| {
                var iter = class.getMemberIterator(.static);
                while (iter.next()) |static_member| {
                    const slot = static_member.slot orelse continue;
                    const tag = try php.getProperty(static_table, slot);
                    const tag_obj = try php.getValueObject(tag);
                    // enums can have methods so we need to check the structure type
                    if (ZigClassEntry.fromObject(tag_obj).type != .@"enum") continue;
                    const name = iter.currentName() orelse return error.MissingName;
                    try self.addCanonical(name, tag_obj);
                }
            }
            // create a list of property names for use by iterator
            self.prop_names = try class.createPropertyList(.instance);
        }

        pub fn deinit(self: *@This()) void {
            php.destroyHashTable(&self.available_tags);
            if (self.prop_names.len > 0) php.allocator.free(self.prop_names);
        }

        pub fn castValue(self: *@This(), value: *Value) !?Value {
            switch (php.getValueType(value)) {
                .long => return self.findCanonical(value) catch php.createValueNull(),
                .object => {
                    const obj = php.getValueObject(value) catch unreachable;
                    if (ZigClassEntry.get(obj, false)) |value_class| {
                        if (value_class.type == .@"union") {
                            // see if the union uses this enum as its tag
                            const value_static = value_class.getStaticData(structure.Union);
                            if (value_static.getEnumClass() == ZigClassEntry.fromStatic(self)) {
                                return try value_static.getEnum(obj);
                            }
                        }
                    } else if (php.isGMP(obj)) {
                        return self.findCanonical(value) catch php.createValueNull();
                    }
                },
                else => {},
            }
            return null;
        }

        pub fn getCastArgs(_: *@This()) []const u8 {
            return "an integer, tagged union, or string";
        }

        pub fn findCanonical(self: *@This(), key: *const Value) !Value {
            const class = ZigClassEntry.fromStatic(self);
            switch (php.getValueType(key)) {
                .long => {
                    const tag_code = php.getValueLong(key) catch unreachable;
                    if (php.getHashEntry(&self.available_tags, tag_code)) |tag| {
                        php.addRef(tag);
                        return tag.*;
                    } else |err| {
                        if (class.flags.@"enum".is_open_ended) {
                            // create new item
                            const tag_obj = try class.createObject(null, null, false);
                            const tag_struct = fromObject(tag_obj);
                            try self.constant_acc.int.set(tag_struct, key);
                            tag_struct.buffer.protect(true);
                            var buffer: [48]u8 = undefined;
                            const text = std.fmt.bufPrint(&buffer, "@enumFromInt({d})", .{tag_code}) catch unreachable;
                            const name = php.createString(text);
                            defer php.release(name);
                            try self.addCanonical(name, tag_obj);
                            // add object to template table, which owns the other items as well
                            var tag_value = php.createValueObject(tag_obj);
                            var table = class.static.template.table orelse init: {
                                const new_table = php.createValueArray(null);
                                class.static.template.table = new_table;
                                break :init new_table;
                            };
                            try php.addElementRef(&table, &tag_value);
                            // tag_obj should have refcount = 2 at this point
                            return php.createValueObject(tag_obj);
                        } else {
                            return err;
                        }
                    }
                },
                .string => {
                    const name = php.getValueStringContent(key) catch unreachable;
                    const tag = try php.getHashEntry(&self.available_tags, name);
                    php.addRef(tag);
                    return tag.*;
                },
                .object => {
                    const obj = php.getValueObject(key) catch unreachable;
                    if (obj.ce == class.entry()) {
                        return key.*;
                    } else if (php.isGMP(obj)) {
                        var key_copy = key.*;
                        php.addRef(&key_copy);
                        try php.convertValue(&key_copy, .string);
                        defer php.release(&key_copy);
                        const tag_code_str = php.getValueString(&key_copy) catch unreachable;
                        if (php.getHashEntry(&self.available_tags, tag_code_str)) |tag| {
                            php.addRef(tag);
                            return tag.*;
                        } else |err| {
                            if (class.flags.@"enum".is_open_ended) {
                                // create new item
                                const tag_obj = try class.createObject(null, null, false);
                                const tag_struct = fromObject(tag_obj);
                                try self.constant_acc.int.set(tag_struct, key);
                                tag_struct.buffer.protect(true);
                                const text = try std.fmt.allocPrint(php.allocator, "@enumFromInt({s})", .{
                                    php.getStringContent(tag_code_str),
                                });
                                defer php.allocator.free(text);
                                const name = php.createString(text);
                                defer php.release(name);
                                try self.addCanonical(name, tag_obj);
                                // tag_obj has refcount = 2 at this point, which is correct
                                return php.createValueObject(tag_obj);
                            } else {
                                return err;
                            }
                        }
                    } else {
                        return failure.report("'{s}' is not a tag of enum '{s}'", .{
                            php.getStringContent(obj.ce.*.name),
                            class.getName(),
                        });
                    }
                },
                else => return error.InvalidType,
            }
        }

        pub fn findCanonicalBytes(self: *@This(), value: *const Value) !*ByteBuffer {
            const tag = self.findCanonical(value) catch |err| {
                const class = ZigClassEntry.fromStatic(self);
                return switch (err) {
                    error.NotFound => switch (php.getValueType(value)) {
                        .string => failure.report("enum '{s}' has no tag named '{s}'", .{
                            class.getName(),
                            php.getValueStringContent(value) catch unreachable,
                        }),
                        .long => failure.report("enum '{s}' has no tag with value {d}", .{
                            class.getName(),
                            php.getValueLong(value) catch unreachable,
                        }),
                        else => unreachable,
                    },
                    else => err,
                };
            };
            defer php.release(&tag);
            const tag_obj = try php.getValueObject(&tag);
            const tag_struct = fromObject(tag_obj);
            return tag_struct.buffer;
        }

        fn addCanonical(self: *@This(), name: *String, tag_obj: *Object) !void {
            const tag_struct = fromObject(tag_obj);
            // reference tag by integer value
            var tag_value = try self.constant_acc.int.get(tag_struct);
            // tag_value might contain a GMP object, so we need to release it
            defer php.release(&tag_value);
            const tag = php.createValueObject(tag_obj);
            // reference tag by value
            switch (php.getValueType(&tag_value)) {
                .long => {
                    const tag_code = try php.getValueLong(&tag_value);
                    php.setHashEntry(&self.available_tags, tag_code, &tag);
                },
                .object => {
                    // GMP object
                    try php.convertValue(&tag_value, .string);
                    const tag_code_str = try php.getValueString(&tag_value);
                    php.setHashEntry(&self.available_tags, tag_code_str, &tag);
                },
                else => return error.Unexpected,
            }
            // reference tag by name
            php.setHashEntry(&self.available_tags, name, &tag);
            // attach canonical info to tag
            const props = try php.allocator.create(Canonical);
            props.* = .{ .name = name };
            php.addRef(name);
            tag_struct.canonical = props;
        }
    };

    pub fn getValue(self: *@This(), transform: accessor.Transform) !Value {
        if (transform == .none) {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            return try static.constant_acc.get(self.buffer);
        } else {
            return Super.getValue(self, transform);
        }
    }

    pub fn setValue(self: *@This(), value: *const Value, transform: accessor.Transform) !void {
        if (try self.copySelf(value)) return;
        if (transform == .none) {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            try static.constant_acc.set(self.buffer, value);
        } else {
            try Super.setValue(self, value, transform);
        }
    }

    pub fn freeObject(obj: *Object) void {
        const self = fromObject(obj);
        if (self.canonical) |props| {
            props.release();
        }
        Super.freeObject(obj);
    }

    pub fn getIterator(obj: *Object) !?*ObjectIterator {
        const class = ZigClassEntry.fromObject(obj);
        const static = class.getStaticData(@This());
        return try iterator.PropertyIterator(@This()).create(obj, static.prop_names, &.{});
    }

    pub const getExtent = Super.getExtent;
    pub const setStorage = Super.setStorage;
    pub const initialize = Super.initialize;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const checkArguments = Super.checkArguments;
    pub const getProperty = Super.getProperty;
    pub const setProperty = Super.setProperty;
    pub const visitPointers = Super.visitPointers;
    pub const castObject = Super.castObject;
    pub const getMethod = Super.getMethod;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const getGarbageCollection = Super.getGarbageCollection;
    const fromObject = Super.fromObject;
    const copySelf = Super.copySelf;
    const returnBytes = Super.returnBytes;
};
