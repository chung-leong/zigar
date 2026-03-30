const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const HashTable = php.HashTable;
const Object = php.Object;
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

    const Super = structure.Parent(@This());

    pub const Static = struct {
        value_acc: *accessor.Primitive = undefined,
        available_tags: HashTable = undefined,
        class_obj: *Object = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member = try class.getMember(.instance, 0);
            if (member.accessors != .primitive) return error.InvalidAccessor;
            self.value_acc = &member.accessors.primitive;
            // loop through static members and add them to a hash table, keyed by
            // their integer values and names
            self.available_tags = php.createHashTable(php.destructor.value);
            if (class.static.template.table) |static_table| {
                var iter = class.getMemberIterator(.static);
                while (iter.next()) |static_member| {
                    const slot = static_member.slot orelse continue;
                    const tag = try php.getProperty(static_table, slot);
                    const tag_obj = try php.getValueObject(tag);
                    // enums can have methods so we need to check the structure type
                    if (ZigClassEntry.fromObject(tag_obj).type != .@"enum") continue;
                    const name = iter.currentName() orelse return error.MissingName;
                    try self.addCanonical(name, tag_obj);
                    // decrement ref count on class (since the class holds a ref on the tag)
                    class.release();
                }
            }
            // because methods are really static functions, we need to maintain a ref on the class object
            self.class_obj = class_obj;
            php.addRef(self.class_obj);
        }

        pub fn deinit(self: *@This()) void {
            php.destroyHashTable(&self.available_tags);
            php.release(self.class_obj);
        }

        pub fn castValue(self: *@This(), value: *Value) !?Value {
            switch (php.getType(value)) {
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
            switch (php.getType(key)) {
                .long => {
                    const tag_code = php.getValueLong(key) catch unreachable;
                    if (php.getHashEntry(&self.available_tags, tag_code)) |tag| {
                        php.addRef(tag);
                        return tag.*;
                    } else |err| {
                        if (class.flags.@"enum".is_open_ended) {
                            // create new item
                            const buf = try ByteBuffer.create(class.alignment);
                            try buf.allocate(null, class.byte_size.?);
                            const tag_obj = try class.createPreinitializedObject(buf, null);
                            try self.value_acc.transform(null).set(buf, key);
                            var buffer: [48]u8 = undefined;
                            const text = std.fmt.bufPrint(&buffer, "@enumFromInt({d})", .{tag_code}) catch unreachable;
                            const name = php.createString(text);
                            defer php.release(name);
                            try self.addCanonical(name, tag_obj);
                            // tag_obj has refcount = 2 at this point, which is correct
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
                                const buf = try ByteBuffer.create(class.alignment);
                                try buf.allocate(null, class.byte_size.?);
                                try self.value_acc.transform(null).set(buf, key);
                                const tag_obj = try class.createPreinitializedObject(buf, null);
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
                        return php.throwExceptionFmt("'{s}' is not a tag of enum '{s}' (zig)", .{
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
                    error.NotFound => switch (php.getType(value)) {
                        .string => php.throwExceptionFmt("enum '{s}' has no tag named '{s}' (zig)", .{
                            class.getName(),
                            php.getValueStringContent(value) catch unreachable,
                        }),
                        .long => php.throwExceptionFmt("enum '{s}' has no tag with value {d} (zig)", .{
                            class.getName(),
                            php.getValueLong(value) catch unreachable,
                        }),
                        else => unreachable,
                    },
                    else => err,
                };
            };
            const tag_obj = try php.getValueObject(&tag);
            const tag_struct = fromObject(tag_obj);
            return tag_struct.buffer;
        }

        fn addCanonical(self: *@This(), name: *String, tag_obj: *Object) !void {
            const tag_struct = fromObject(tag_obj);
            // reference tag by integer value
            var tag_value = try self.value_acc.transform(null).get(tag_struct.buffer);
            // tag_value might contain a GMP object, so we need to release it
            defer php.release(&tag_value);
            const tag = php.createValueObject(tag_obj);
            // reference tag by value
            switch (php.getType(&tag_value)) {
                .long => {
                    const tag_code = try php.getValueLong(&tag_value);
                    php.setHashEntryRef(&self.available_tags, tag_code, &tag);
                },
                .object => {
                    // GMP object
                    try php.convertValue(&tag_value, .string);
                    const tag_code_str = try php.getValueString(&tag_value);
                    php.setHashEntryRef(&self.available_tags, tag_code_str, &tag);
                },
                else => return error.Unexpected,
            }
            // reference tag by name
            php.setHashEntryRef(&self.available_tags, name, &tag);
            // attach canonical info to tag
            const props = try php.allocator.create(Canonical);
            props.* = .{ .name = name };
            php.addRef(name);
            tag_struct.canonical = props;
        }
    };

    pub fn readSelf(self: *@This(), transform: ObjectTransform) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const enum_value = try static.value_acc.get(self.buffer);
        if (transform == .to_value) return enum_value;
        const enum_obj = try php.getValueObject(&enum_value);
        defer php.release(enum_obj);
        const enum_struct = fromObject(enum_obj);
        return switch (transform) {
            .to_value => unreachable,
            .to_string, .to_plain => create: {
                const props = enum_struct.canonical orelse return error.Unexpected;
                break :create php.createValueString(props.name);
            },
            .to_integer => try static.value_acc.transform(null).get(enum_struct.buffer),
            .to_bytes => try self.returnBytes(),
        };
    }

    pub fn writeSelf(self: *@This(), value: *const Value) !void {
        if (try self.copySelf(value)) return;
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.value_acc.set(self.buffer, value);
    }

    pub fn freeObject(obj: *Object) void {
        const self = fromObject(obj);
        self.buffer.release();
        if (self.canonical == null or self.canonical.?.unknown) {
            const class = ZigClassEntry.fromObject(obj);
            class.release();
        }
        if (self.canonical) |props| {
            props.release();
        }
    }

    pub const getExtent = Super.getExtent;
    pub const initialize = Super.initialize;
    pub const checkArguments = Super.checkArguments;
    pub const castObject = Super.castObject;
    pub const getMethod = Super.getMethod;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
    const copySelf = Super.copySelf;
    const returnBytes = Super.returnBytes;
};
