const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
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
            class: *ZigClassEntry,
            possible_names: HashTable,
        } = null,

        pub fn init(self: *@This(), class: *ZigClassEntry) !void {
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
    };
    pub const constructor_args = "an array as argument or one named argument";

    pub fn writeSelf(self: *@This(), value: *const Value) Error!void {
        const ht = try php.getValueHashTable(value);
        var iter: HashTableIterator = .init(ht, .{});
        if (iter.len != 1) {
            php.throwExceptionFmt("union can only have 1 active field, received {d} initializers", .{
                iter.len,
            });
            return error.ExceptionThrown;
        }
        while (iter.next()) |field_value| {
            const name = iter.currentName() orelse return error.NotStringKey;
            self.writeMember(name, field_value, null) catch |err| {
                self.throwFieldError(name, err);
                return error.ExceptionThrown;
            };
            try self.setActiveField(name);
        }
    }

    pub fn getActiveField(self: *@This()) !?*String {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const selector = static.selector orelse return null;
        const selector_value = try selector.accessors.get(self.bytes);
        const selector_code = try php.getValueLong(&selector_value);
        const current_name = php.getHashEntry(&selector.possible_names, selector_code) catch
            return error.InvalidEnumValid;
        return try php.getValueString(current_name);
    }

    pub fn setActiveField(self: *@This(), name: *String) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const selector = &(static.selector orelse return);
        var iter: HashTableIterator = .init(&selector.possible_names, .{});
        const selector_code = while (iter.next()) |other_name_value| {
            const other_name = try php.getValueString(other_name_value);
            if (php.compareStrings(name, other_name)) {
                break iter.currentIndex().?;
            }
        } else unreachable;
        const selector_value = php.createValueLong(selector_code);
        return selector.accessors.set(self.bytes, &selector_value);
    }

    fn checkSelector(self: *@This(), name: *String) !void {
        const active = try self.getActiveField() orelse return;
        if (!php.compareStrings(active, name)) return error.InactiveField;
    }

    fn throwFieldError(self: *@This(), name: *String, err: anytype) void {
        const accessors = self.findAccessors(name, null) catch null;
        if (accessors != null and err == error.InactiveField) {
            const active = (self.getActiveField() catch unreachable).?;
            php.throwExceptionFmt("access of union field '{s}' while field '{s}' is active", .{
                php.getStringContent(name),
                php.getStringContent(active),
            });
        } else {
            Super.throwFieldError(self, name, err);
        }
    }

    pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) !*Value {
        const self = fromObject(obj);
        self.checkSelector(name) catch |err| {
            self.throwFieldError(name, err);
            return retval;
        };
        return Super.readContainerProperty(obj, name, prop_type, cache_slot, retval);
    }

    pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !*Value {
        const self = fromObject(obj);
        self.checkSelector(name) catch |err| {
            self.throwFieldError(name, err);
            return error.ExceptionThrown;
        };
        return Super.writeContainerProperty(obj, name, value, cache_slot);
    }

    pub const setStorage = Super.setStorage;
    pub const copyArguments = Super.copyArguments;
    pub const readSelf = Super.readSelf;
    pub const freeObject = Super.freeObject;
    pub const getPropertyPointer = Super.getPropertyPointer;
    const fromObject = Super.fromObject;
    const writeMember = Super.writeMember;
    const findAccessors = Super.findAccessors;
};
