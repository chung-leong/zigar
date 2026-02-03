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

        pub fn init(self: *@This(), class: *ZigClassEntry) !void {
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
                const tag_struct = fromObject(tag_obj);
                // reference tag by integer value
                const tag_value = try self.value_acc.get(tag_struct.bytes);
                const tag_code = try php.getValueLong(&tag_value);
                php.setHashEntryRef(&self.available_tags, tag_code, tag);
                // reference tag by name
                const name = iter.currentName() orelse return error.MissingName;
                php.setHashEntryRef(&self.available_tags, name, tag);
                // attach canonical info to tag
                const props = try php.allocator.create(Canonical);
                props.* = .{ .name = name };
                php.addRef(name);
                tag_struct.canonical = props;
                // decrement ref count on class (since the class holds a ref on the tag)
                class.release();
            }
        }

        pub fn deinit(self: *@This()) void {
            php.destroyHashTable(&self.available_tags);
        }

        pub fn readTagValue(self: *@This(), err_obj: *Object) !Value {
            const err_struct = fromObject(err_obj);
            return try self.value_acc.get(err_struct.bytes);
        }

        pub fn findTag(self: *Static, key: anytype) !*Object {
            const tag = try php.getHashEntry(&self.available_tags, key);
            return try php.getValueObject(tag);
        }
    };

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

    pub fn readSelf(self: *@This()) !Value {
        const tag_struct = try self.getCanonical();
        const tag_obj = tag_struct.object();
        php.addRef(tag_obj);
        return php.createValueObject(tag_obj);
    }

    pub fn writeSelf(self: *@This(), value: *const Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        var static = class.getStaticData(@This());
        const tag_value = find: {
            if (php.getValueObject(value)) |tag_obj| {
                if (tag_obj.ce == class.entry()) {
                    const tag_struct = fromObject(tag_obj);
                    break :find try static.value_acc.get(tag_struct.bytes);
                } else {
                    php.throwExceptionFmt("'{s}' is not a tag of enum '{s}' (zig)", .{
                        php.getStringContent(tag_obj.ce.*.name),
                        class.getName(),
                    });
                    return;
                }
            } else |_| if (php.getValueLong(value)) |tag_code| {
                if (static.findTag(tag_code)) |_| {
                    break :find value.*;
                } else |_| {
                    if (class.flags.@"enum".is_open_ended) {
                        break :find value.*;
                    } else {
                        php.throwExceptionFmt("enum '{s}' has no tag with value {d} (zig)", .{
                            class.getName(),
                            tag_code,
                        });
                        return;
                    }
                }
            } else |_| if (php.getValueStringContent(value)) |name| {
                if (static.findTag(name)) |tag_obj| {
                    break :find try static.readTagValue(tag_obj);
                } else |_| {
                    php.throwExceptionFmt("enum '{s}' has no tag named '{s}' (zig)", .{
                        class.getName(),
                        name,
                    });
                    return;
                }
            } else |_| {
                return error.InvalidType;
            }
        };
        try static.value_acc.set(self.bytes, &tag_value);
    }

    fn getCanonical(self: *@This()) !*@This() {
        if (self.canonical != null) return self;
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const tag_value = try static.value_acc.get(self.bytes);
        const tag_code = try php.getValueLong(&tag_value);
        if (static.findTag(tag_code)) |tag_obj| {
            return fromObject(tag_obj);
        } else |_| {
            // unknown tag number--see if enum is open-ended
            if (!class.flags.@"enum".is_open_ended) {
                // attach a canonical struct
                var buffer: [32]u8 = undefined;
                const text = std.fmt.bufPrint(&buffer, "@enumFromInt({d})", .{tag_code}) catch unreachable;
                const name = php.createString(text);
                const props = try php.allocator.create(Canonical);
                props.* = .{ .name = name, .unknown = true };
                self.canonical = props;
            } else {
                php.throwExceptionFmt("enum '{s}' has no tag with value {d} (zig)", .{
                    class.getName(),
                    tag_code,
                });
            }
            return self;
        }
    }

    pub const setStorage = Super.setStorage;
    pub const copyArguments = Super.copyArguments;
    const fromObject = Super.fromObject;
    const object = Super.object;
};
