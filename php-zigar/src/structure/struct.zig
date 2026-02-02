const std = @import("std");

const accessor = @import("../accessor.zig");
const Error = accessor.Error;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Struct = struct {
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        required_field_count: usize = 0,

        pub fn init(self: *@This(), class: *ZigClassEntry) !void {
            var iter = class.getMemberIterator(.instance);
            while (iter.next()) |member| {
                if (member.flags.is_required) self.required_field_count += 1;
            }
        }

        pub fn deinit(_: *@This()) void {}
    };
    pub const constructor_args = "an array as argument or named arguments";

    pub fn copyArguments(self: *@This(), arg_iter: *php.ArgumentIterator) !void {
        if (arg_iter.len == 0) {
            // check if the struct has default values for all fields
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            if (static.required_field_count == 0) return;
            // let the default implementation throw an exception
        }
        return try Super.copyArguments(self, arg_iter);
    }

    pub fn writeSelf(self: *@This(), value: *const Value) Error!void {
        const ht = try php.getValueHashTable(value);
        var iter: HashTableIterator = .init(ht, .{});

        while (iter.next()) |field_value| {
            const name = iter.currentName() orelse return error.NotStringKey;
            self.writeMember(name, field_value, null) catch |err| {
                self.throwFieldError(name, err);
                return error.ExceptionThrown;
            };
        }
    }

    pub fn getProperties(obj: *Object) !*HashTable {
        const self = fromObject(obj);
        const class = ZigClassEntry.fromObject(obj);
        const ht = php.createArray();
        var iter = class.getMemberIterator(.instance);
        while (iter.next()) |member| {
            if (iter.currentName()) |name| {
                var value = try member.accessors.get(self);
                php.setHashEntry(ht, name, &value);
            }
        }
        // caller seem to expect a hash table with zero refcount
        ht.gc.refcount = 0;
        return ht;
    }

    pub const fromObject = Super.fromObject;
    pub const setStorage = Super.setStorage;
    pub const readSelf = Super.readSelf;
    pub const freeObject = Super.freeObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const getPropertyPointer = Super.getPropertyPointer;
    const writeMember = Super.writeMember;
    const throwFieldError = Super.throwFieldError;
};
