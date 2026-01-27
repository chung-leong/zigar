const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClass = @import("../class.zig").ZigClass;
const php = @import("../php.zig");
const HashPosition = php.HashPosition;
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

        pub fn init(self: *@This(), class: *ZigClass) !void {
            const member = try class.getMember(.instance, 0);
            if (member.accessors != .primitive) return error.InvalidAccessor;
            self.value_acc = &member.accessors.primitive;
            // loop through static members and add them to a hash table, keyed by
            // their integer values and names
            self.available_tags = php.createHashTable(php.destructor.value);
            var pos: HashPosition = undefined;
            const member_ht = &class.static.members;
            const static_slots = class.static.template.slots orelse return error.MissingSlots;
            php.initializeHashPosition(member_ht, &pos);
            while (php.getHashPositionValue(member_ht, &pos)) |member_value| {
                const static_member = try php.getValuePointer(*ZigClass.Member, member_value);
                if (static_member.slot) |slot| {
                    const tag = try php.getProperty(static_slots, slot);
                    const tag_obj = try php.getValueObject(tag);
                    const tag_struct = fromObject(tag_obj);
                    // reference tag by integer value
                    const tag_value = try self.value_acc.get(tag_struct.bytes);
                    const tag_code = try php.getValueLong(&tag_value);
                    try php.setHashEntryRef(&self.available_tags, tag_code, tag);
                    // reference tag by name
                    var name_key = php.getHashPositionKey(member_ht, &pos);
                    defer php.release(&name_key);
                    const name = try php.getValueString(&name_key);
                    try php.setHashEntryRef(&self.available_tags, name, tag);
                    // attach canonical info to tag
                    const props = try php.allocator.create(Canonical);
                    props.* = .{ .name = name };
                    php.addRef(name);
                    tag_struct.canonical = props;
                    // decrement ref count on class (since the class holds a ref on the tag)
                    class.release();
                    if (!php.moveHashPositionForward(member_ht, &pos)) break;
                }
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
            const class = ZigClass.fromObject(obj);
            class.release();
        }
        if (self.canonical) |props| {
            props.release();
        }
    }

    pub fn readSelf(obj: *Object) !Value {
        const tag_obj = try getCanonical(obj);
        php.addRef(tag_obj);
        return php.createValueObject(tag_obj);
    }

    fn getCanonical(obj: *Object) !*Object {
        const self = fromObject(obj);
        if (self.canonical != null) return obj;
        const class = ZigClass.fromObject(obj);
        const static = class.getStaticData(@This());
        const tag_value = try static.value_acc.get(self.bytes);
        const tag_code = try php.getValueLong(&tag_value);
        return static.findTag(tag_code) catch new: {
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
            break :new obj;
        };
    }

    pub fn writeSelf(obj: *Object, value: *const Value) !void {
        const self = fromObject(obj);
        const class = ZigClass.fromObject(obj);
        var static = class.getStaticData(@This());
        const tag_value = find: {
            if (php.getValueObject(value)) |tag_obj| {
                if (tag_obj.ce == class.entry()) {
                    const tag_struct = fromObject(tag_obj);
                    break :find try static.value_acc.get(tag_struct.bytes);
                } else {
                    php.throwExceptionFmt("'{s}' is not a tag of enum '{s}' (zig)", .{
                        php.getStringContent(obj.ce.*.name),
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

    pub const fromObject = Super.fromObject;
    pub const setStorage = Super.setStorage;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
};
