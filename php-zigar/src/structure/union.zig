const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClass = @import("../class.zig").ZigClass;
const php = @import("../php.zig");
const HashTable = php.HashTable;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Union = struct {
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        selector: ?struct {
            accessors: *accessor.Primitive,
            class: *ZigClass,
            possible_names: HashTable,
        } = null,

        pub fn init(self: *@This(), class: *ZigClass) !void {
            var iter = class.getMemberIterator(.instance);
            const selector_member = while (iter.next()) |member| {
                if (member.flags.is_selector) break member;
            } else null;
            if (selector_member) |sm| {
                if (sm.accessors != .primitive) return error.InvalidAccessor;
                const selector_class = sm.class orelse return error.MissingClass;
                // go through the list of members again and get the possible selector values
                var name_ht = php.createHashTable(php.destructor.value);
                var index: c_long = 0;
                iter.reset();
                while (iter.next()) |member| {
                    if (member.flags.is_selector) continue;
                    const name = iter.currentName() orelse return error.MissingName;
                    const selector_code = switch (selector_class.type) {
                        .@"enum" => find: {
                            const enum_static = selector_class.getStaticData(structure.Enum);
                            const tag = try enum_static.findTag(name);
                            const tag_value = try enum_static.readTagValue(tag);
                            break :find try php.getValueLong(&tag_value);
                        },
                        else => index,
                    };
                    php.setHashEntryRef(&name_ht, selector_code, iter.currentKey());
                    php.addRef(name);
                    index += 1;
                }
                self.selector = .{
                    .accessors = &sm.accessors.primitive,
                    .class = selector_class,
                    .possible_names = name_ht,
                };
            }
        }

        pub fn deinit(self: *@This()) void {
            if (self.selector) |*selector| {
                php.destroyHashTable(&selector.possible_names);
            }
        }

        pub fn readSelectorValue(self: *@This(), obj: *Object) !?Value {
            const selector = self.selector orelse return null;
            const union_struct = fromObject(obj);
            return try selector.accessors.get(union_struct.bytes);
        }

        pub fn getActiveField(self: *@This(), obj: *Object) !?*String {
            const selector_value = try self.readSelectorValue(obj) orelse return null;
            const selector_code = try php.getValueLong(&selector_value);
            const selector = self.selector.?;
            const current_name = php.getHashEntry(&selector.possible_names, selector_code) catch
                return error.InvalidEnumValid;
            return try php.getValueString(current_name);
        }
    };

    pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) *Value {
        if (checkSelector(obj, name)) {
            return Super.readProperty(obj, name, prop_type, cache_slot, retval);
        } else |err| {
            throwFieldError(obj, name, err);
            retval.* = php.createValueNull();
            return retval;
        }
    }

    pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) *Value {
        if (checkSelector(obj, name)) {
            return Super.writeProperty(obj, name, value, cache_slot);
        } else |err| {
            throwFieldError(obj, name, err);
            return value;
        }
    }

    fn checkSelector(obj: *Object, name: *String) !void {
        const class = ZigClass.fromObject(obj);
        const static = class.getStaticData(@This());
        const active = try static.getActiveField(obj) orelse return;
        const active_c = php.getStringContent(active);
        const name_c = php.getStringContent(name);
        if (!std.mem.eql(u8, name_c, active_c)) return error.InactiveField;
    }

    fn throwFieldError(obj: *Object, name: *String, err: anytype) void {
        const accessors = Super.findAccessors(obj, name, null) catch null;
        if (accessors != null and err == error.InactiveField) {
            const class = ZigClass.fromObject(obj);
            const static = class.getStaticData(@This());
            const active = (static.getActiveField(obj) catch unreachable).?;
            php.throwExceptionFmt("access of {s} field '{s}' while field '{s}' is active", .{
                class.getStructureName(),
                php.getStringContent(name),
                php.getStringContent(active),
            });
        } else {
            Super.throwFieldError(obj, name, err);
        }
    }

    pub const fromObject = Super.fromObject;
    pub const setStorage = Super.setStorage;
    pub const readSelf = Super.readSelf;
    pub const freeObject = Super.freeObject;
};
