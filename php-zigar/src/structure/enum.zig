const std = @import("std");

const accessor = @import("../accessor.zig");
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
    bytes: *ByteBuffer = undefined,
    canonical: ?*Canonical = null,

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
            const static_slots = class.static.template.slots orelse return error.MissingSlots;
            var iter = class.getMemberIterator(.static);
            while (iter.next()) |static_member| {
                const slot = static_member.slot orelse continue;
                const tag = try php.getProperty(static_slots, slot);
                const tag_obj = try php.getValueObject(tag);
                // enums can have methods so we need to check the structure type
                if (ZigClassEntry.fromObject(tag_obj).type != .@"enum") continue;
                const name = iter.currentName() orelse return error.MissingName;
                try self.addCanonical(name, tag_obj);
                // decrement ref count on class (since the class holds a ref on the tag)
                class.release();
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
                .long => return try self.findCanonical(value),
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
                    const enum_code = php.getValueLong(key) catch unreachable;
                    if (php.getHashEntry(&self.available_tags, enum_code)) |tag| {
                        php.addRef(tag);
                        return tag.*;
                    } else |_| {
                        if (class.flags.@"enum".is_open_ended) {
                            // create new item
                            const bytes = try ByteBuffer.createNew(class.byte_size.?, class.alignment);
                            var acc = self.value_acc.*;
                            acc.params.transform = null;
                            try acc.set(bytes, key);
                            const tag_code = php.getValueLong(key) catch unreachable;
                            const tag_obj = try class.createObjectFromBuffer(bytes, null);
                            var buffer: [32]u8 = undefined;
                            const text = std.fmt.bufPrint(&buffer, "@enumFromInt({d})", .{tag_code}) catch unreachable;
                            const name = php.createString(text);
                            defer php.release(name);
                            try self.addCanonical(name, tag_obj);
                            // tag_obj has refcount = 2 at this point, which is correct
                            return php.createValueObject(tag_obj);
                        } else {
                            return php.throwExceptionFmt("enum '{s}' has no tag with value {d} (zig)", .{
                                class.getName(),
                                enum_code,
                            });
                        }
                    }
                },
                .string => {
                    const name = php.getValueStringContent(key) catch unreachable;
                    if (php.getHashEntry(&self.available_tags, name)) |tag| {
                        php.addRef(tag);
                        return tag.*;
                    } else |_| {
                        return php.throwExceptionFmt("enum '{s}' has no tag named '{s}' (zig)", .{
                            class.getName(),
                            name,
                        });
                    }
                },
                .object => {
                    const tag_obj = php.getValueObject(key) catch unreachable;
                    if (tag_obj.ce == class.entry()) {
                        return key.*;
                    } else {
                        return php.throwExceptionFmt("'{s}' is not a tag of enum '{s}' (zig)", .{
                            php.getStringContent(tag_obj.ce.*.name),
                            class.getName(),
                        });
                    }
                },
                else => return error.InvalidType,
            }
        }

        pub fn findCanonicalBytes(self: *@This(), value: *const Value) !*ByteBuffer {
            const tag = try self.findCanonical(value);
            const tag_obj = try php.getValueObject(&tag);
            const tag_struct = fromObject(tag_obj);
            return tag_struct.bytes;
        }

        fn addCanonical(self: *@This(), name: *String, tag_obj: *Object) !void {
            const tag_struct = fromObject(tag_obj);
            // reference tag by integer value
            const tag_value = try tag_struct.numerify();
            var tag = php.createValueObject(tag_obj);
            // reference tag by value
            const tag_code = try php.getValueLong(&tag_value);
            php.setHashEntryRef(&self.available_tags, tag_code, &tag);
            // reference tag by name
            php.setHashEntryRef(&self.available_tags, name, &tag);
            // attach canonical info to tag
            const props = try php.allocator.create(Canonical);
            props.* = .{ .name = name };
            php.addRef(name);
            tag_struct.canonical = props;
        }
    };

    pub fn readSelf(self: *@This()) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return try static.value_acc.get(self.bytes);
    }

    pub fn writeSelf(self: *@This(), value: *const Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        try static.value_acc.set(self.bytes, value);
    }

    pub fn stringify(self: *@This()) !Value {
        const props = self.canonical orelse return error.Unexpected;
        return php.createValueString(props.name);
    }

    pub fn numerify(self: *@This()) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        var acc = static.value_acc.*;
        acc.params.transform = null;
        return try acc.get(self.bytes);
    }

    pub fn freeObject(obj: *Object) void {
        const self = fromObject(obj);
        self.bytes.release();
        if (self.canonical == null or self.canonical.?.unknown) {
            const class = ZigClassEntry.fromObject(obj);
            class.release();
        }
        if (self.canonical) |props| {
            props.release();
        }
    }

    pub fn castObject(obj: *Object, retval: *Value, type_id: c_int) !c_int {
        const value_type = php.Type.fromInt(type_id) catch return php.FAILURE;
        const self = Super.fromObject(obj);
        retval.* = switch (value_type) {
            .string => try self.stringify(),
            .long => try self.numerify(),
            else => return php.FAILURE,
        };
        return php.SUCCESS;
    }

    pub const setStorage = Super.setStorage;
    pub const getExtent = Super.getExtent;
    pub const copyArguments = Super.copyArguments;
    pub const getMethod = Super.getMethod;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
    const object = Super.object;
};
