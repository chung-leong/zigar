const std = @import("std");

const accessor = @import("../accessor.zig");
const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const HashPosition = php.HashPosition;
const HashTable = php.HashTable;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");
const zig_class = @import("../zig-class.zig");
const ZigClass = zig_class.ZigClass;

pub const Enum = struct {
    bytes: *ByteBuffer = undefined,
    name: ?*String = null,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        value_acc: *accessor.Primitive = undefined,
        available_tags: HashTable = undefined,

        pub fn initialize(self: *@This(), class: *ZigClass) !void {
            const member = try class.getMember(.instance, 0);
            if (member.accessors != .primitive) return error.InvalidAccessor;
            self.value_acc = &member.accessors.primitive;
            // loop through static members and add them to a hash table, keyed by
            // their integer values and names
            self.available_tags = php.createHashTable(null);
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
                    const tag_value = try self.value_acc.get(tag_struct.bytes);
                    // reference tag by integer value
                    const long = try php.getValueLong(&tag_value);
                    try php.setHashEntryRef(&self.available_tags, long, tag);
                    // reference tag by name
                    const name_key = php.getHashPositionKey(member_ht, &pos);
                    const name = try php.getValueString(&name_key);
                    try php.setHashEntryRef(&self.available_tags, name, tag);
                    // attach name to tag
                    tag_struct.name = name;
                    php.addRef(name);
                    if (!php.moveHashPositionForward(member_ht, &pos)) break;
                }
            }
        }

        fn findTagByValue(self: *Static, long: c_long) !*Value {
            return php.getHashEntry(&self.available_tags, long) catch |err| add: {
                const class = ZigClass.fromStatic(self);
                if (class.flags.@"enum".is_open_ended) {
                    // add new item
                }
                break :add err;
            };
        }

        fn findTagByName(self: *Static, name: []const u8) !*Value {
            return php.getHashEntry(&self.available_tags, name);
        }

        fn findTagValue(self: *Static, obj: *Object) !Value {
            var pos: HashPosition = undefined;
            const ht = &self.available_tags;
            php.initializeHashPosition(ht, &pos);
            while (php.getHashPositionValue(ht, &pos)) |tag| {
                const key = php.getHashPositionKey(ht, &pos);
                if (php.getType(&key) == .long) {
                    const tag_obj = try php.getValueObject(tag);
                    if (tag_obj == obj) return key;
                }
                if (!php.moveHashPositionForward(ht, &pos)) break;
            }
            return error.Missing;
        }
    };

    pub fn readSelf(obj: *Object) !Value {
        const self = fromObject(obj);
        const class = ZigClass.fromObject(obj);
        var static = class.getStaticData(@This());
        const value = try static.value_acc.get(self.bytes);
        const long = try php.getValueLong(&value);
        if (static.findTagByValue(long)) |tag| {
            php.addRef(tag);
            return tag.*;
        } else |_| {
            php.throwExceptionFmt("enum '{s}' has no tag with value {d} (zig)", .{
                class.getName(),
                long,
            });
            return php.createValueNull();
        }
    }

    pub fn writeSelf(obj: *Object, value: *const Value) !void {
        const self = fromObject(obj);
        const class = ZigClass.fromObject(obj);
        var static = class.getStaticData(@This());
        const tag_value = find: {
            if (php.getValueObject(value)) |tag_obj| {
                if (static.findTagValue(tag_obj)) |tv| {
                    break :find tv;
                } else |_| {
                    php.throwExceptionFmt("object of '{s}' is not a tag of enum '{s}' (zig)", .{
                        php.getStringContent(obj.ce.*.name),
                        class.getName(),
                    });
                    return;
                }
            } else |_| if (php.getValueLong(value)) |long| {
                if (static.findTagByValue(long)) |_| {
                    break :find value.*;
                } else |_| {
                    php.throwExceptionFmt("enum '{s}' has no tag with value {d} (zig)", .{
                        class.getName(),
                        long,
                    });
                    return;
                }
            } else |_| if (php.getValueStringContent(value)) |name| {
                if (static.findTagByName(name)) |tag| {
                    const tag_obj = try php.getValueObject(tag);
                    break :find try static.findTagValue(tag_obj);
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
    pub const freeObject = Super.freeObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
};
