const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");
const Class = structure.Class;

pub const Union = struct {
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        selector: ?struct {
            class: *ZigClassEntry,
            accessors: *accessor.Primitive,
            possible_values: HashTable,
        } = null,

        pub fn init(self: *@This(), class: *ZigClassEntry) !void {
            var iter = class.getMemberIterator(.instance);
            const selector_member = while (iter.next()) |member| {
                if (member.flags.is_selector) break member;
            } else null;
            if (selector_member) |sm| {
                if (sm.accessors != .primitive) return error.InvalidAccessor;
                const sel_class = sm.class orelse return error.MissingClass;
                const sel_class_struct = ZigObject(Class(Union)).fromObject(sel_class.object).structure();
                // go through the list of members again and get the possible selector values
                var sel_ht = php.createHashTable(php.destructor.value);
                var index: c_long = 0;
                iter.reset();
                while (iter.next()) |un_member| {
                    if (un_member.flags.is_selector) continue;
                    var selector = try un_member.accessors.get(sel_class_struct);
                    php.setHashEntry(&sel_ht, iter.currentKey(), &selector);
                    index += 1;
                }
                self.selector = .{
                    .accessors = &sm.accessors.primitive,
                    .class = sel_class,
                    .possible_values = sel_ht,
                };
            }
        }

        pub fn deinit(self: *@This()) void {
            if (self.selector) |*selector| {
                php.destroyHashTable(&selector.possible_values);
            }
        }
    };
    pub const constructor_args = "an array as argument or one named argument";

    pub fn writeSelf(self: *@This(), value: *const Value) Error!void {
        const ht = try php.getValueHashTable(value);
        var iter: HashTableIterator = .init(ht, .{});
        if (iter.len != 1) {
            return php.throwExceptionFmt("union can only have 1 active field, received {d} initializers", .{
                iter.len,
            });
        }
        const field_value = iter.next().?;
        const name = iter.currentName() orelse return error.KeyIsNotString;
        self.writeMember(name, field_value, null) catch |err| {
            return self.throwFieldError(name, err);
        };
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        if (static.selector) |selector| {
            const sel_value = try php.getHashEntry(&selector.possible_values, name);
            try selector.accessors.set(self.bytes, sel_value);
        }
    }

    pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: ?[*]?*anyopaque, retval: *Value) !*Value {
        const self = fromObject(obj);
        self.checkSelector(name) catch |err| {
            // we have to return a valid pointer here
            const es = self.throwFieldError(name, err);
            _ = &es;
            return retval;
        };
        return Super.readContainerProperty(obj, name, prop_type, cache_slot, retval);
    }

    pub fn writeProperty(obj: *Object, name: *String, value: *Value, cache_slot: ?[*]?*anyopaque) !*Value {
        const self = fromObject(obj);
        self.checkSelector(name) catch |err| {
            return self.throwFieldError(name, err);
        };
        return Super.writeContainerProperty(obj, name, value, cache_slot);
    }

    fn checkSelector(self: *@This(), name: *String) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const selector = static.selector orelse return;
        const sel_value = try php.getHashEntry(&selector.possible_values, name);
        const active_sel_value = try selector.accessors.get(self.bytes);
        if (!compareSelectors(sel_value, &active_sel_value)) return error.InactiveField;
    }

    fn compareSelectors(sel1: *const Value, sel2: *const Value) bool {
        return switch (php.getType(sel1)) {
            .long => sel1.value.lval == sel2.value.lval,
            .object => sel1.value.obj == sel2.value.obj,
            else => unreachable,
        };
    }

    fn throwFieldError(self: *@This(), name: *String, err: anytype) error{ExceptionThrown} {
        const accessors = self.findAccessors(name, null) catch null;
        if (accessors != null and err == error.InactiveField) {
            const active_name = find: {
                const class = ZigClassEntry.fromStructure(self);
                const static = class.getStaticData(@This());
                const selector = static.selector.?;
                const active_sel_value = selector.accessors.get(self.bytes) catch unreachable;
                var iter: HashTableIterator = .init(&selector.possible_values, .{});
                break :find while (iter.next()) |sel_value| {
                    if (compareSelectors(sel_value, &active_sel_value)) {
                        break iter.currentName().?;
                    }
                } else unreachable;
            };
            return php.throwExceptionFmt("access of union field '{s}' while field '{s}' is active", .{
                php.getStringContent(name),
                php.getStringContent(active_name),
            });
        } else {
            return Super.throwFieldError(self, name, err);
        }
    }

    pub const setStorage = Super.setStorage;
    pub const getExtent = Super.getExtent;
    pub const copyArguments = Super.copyArguments;
    pub const readSelf = Super.readSelf;
    pub const freeObject = Super.freeObject;
    pub const getPropertyPointer = Super.getPropertyPointer;
    const fromObject = Super.fromObject;
    const writeMember = Super.writeMember;
    const findAccessors = Super.findAccessors;
};
