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

    pub const Super = structure.StructLike(@This());
    pub const Static = struct {
        constant_acc: *accessor.Constant = undefined,
        available_tags: HashTable = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member = try class.getMember(.instance, 0);
            if (member.accessors != .constant) return error.Unexpected;
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
        }

        pub fn deinit(self: *@This()) void {
            php.destroyHashTable(&self.available_tags);
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
                    } else if (php.isGmpClass(obj.ce)) {
                        return self.findCanonical(value) catch php.createValueNull();
                    }
                },
                .string => return null,
                else => {},
            }
            return failure.report("casting operation expects an interger, a string, or a tagged union as argument, received {s}", .{
                @tagName(php.getValueType(value)),
            });
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
                        php.addRef(obj);
                        return key.*;
                    } else if (php.isGmpClass(obj.ce)) {
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

        pub fn findCanonicalInt(self: *@This(), value: *const Value) !Value {
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
            const tag_obj = try php.getValueObject(&tag);
            defer php.release(tag_obj);
            const tag_struct = fromObject(tag_obj);
            return self.constant_acc.int.get(tag_struct);
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
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return switch (transform) {
            .none, .plain, .string => |t| get: {
                var value = try static.constant_acc.get(self.buffer);
                if (t != .none) {
                    const obj = try php.getValueObject(&value);
                    defer php.release(obj);
                    const enum_struct = fromObject(obj);
                    const str = enum_struct.canonical.?.name;
                    php.addRef(str);
                    value = php.createValueString(str);
                }
                break :get value;
            },
            .integer => try static.constant_acc.int.get(self),
            .boolean => php.createValueBool(true),
            else => Super.getValue(self, transform),
        };
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
        return try iterator.PropertyIterator(@This()).create(obj);
    }

    pub const getExtent = Super.getExtent;
    pub const setStorage = Super.setStorage;
    pub const initialize = Super.initialize;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const checkArguments = Super.checkArguments;
    pub const getProperty = Super.getProperty;
    pub const setProperty = Super.setProperty;
    pub const propertyExists = Super.propertyExists;
    pub const visitPointers = Super.visitPointers;
    pub const getConstructor = Super.getConstructor;
    pub const castObject = Super.castObject;
    pub const getMethod = Super.getMethod;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getProperties = Super.getProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const getGarbageCollection = Super.getGarbageCollection;
    const fromObject = Super.fromObject;
    const copySelf = Super.copySelf;
};
