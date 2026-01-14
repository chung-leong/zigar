const std = @import("std");

const byte_buffer = @import("../byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const php = @import("../php.zig");
const HashPosition = php.HashPosition;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Function = php.Function;
const HashTable = php.HashTable;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");
const zig_class = @import("../zig-class.zig");
const ZigClass = zig_class.ZigClass;
const zig_object = @import("../zig-object.zig");
const ZigObject = zig_object.ZigObject;

pub const Static = struct {
    fields: HashTable = undefined,

    const Super = structure.Parent(@This());

    pub fn setStorage(self: *@This(), _: *ByteBuffer, _: ?*HashTable) !void {
        // transfer values from static template slots into hash table
        self.fields = php.createHashTable(php.destructor.value);
    }

    pub fn setFields(self: *@This(), members: *HashTable, slots: ?*HashTable) !void {
        var pos: php.HashPosition = undefined;
        php.initializeHashPosition(members, &pos);
        while (try php.getHashPositionPointer(*ZigClass.Member, members, &pos)) |member| {
            if (member.slot) |s| {
                const key = php.getHashPositionKey(members, &pos);
                const name = try php.getValueString(&key);
                const ht = slots orelse return error.NoStaticSlots;
                const value = try php.getHashEntry(ht, s);
                try php.setHashEntry(&self.fields, name, value);
                php.addRef(value);
                php.release(name);
            }
            if (!php.moveHashPositionForward(members, &pos)) break;
        }
    }

    pub fn readProperty(obj: *Object, name: *String, prop_type: c_int, cache_slot: *?*anyopaque, retval: *Value) !*Value {
        _ = obj;
        _ = name;
        _ = prop_type;
        _ = cache_slot;
        retval.* = php.createValueLong(456);
        return retval;
    }

    pub fn getMethod(obj_ptr: *[*c]Object, name: *String, _: *const Value) !?*Function {
        const obj = obj_ptr.*;
        const self = Super.fromObject(obj);
        const field = php.getHashEntry(&self.fields, name) catch return null;
        const field_obj = php.getValueObject(field) catch return null;
        const field_class = ZigClass.fromObject(field_obj);
        if (field_class.type != .function) return null;
        const func = structure.Function.fromObject(field_obj);
        return &func.function;
    }

    pub fn freeObject(obj: *Object) void {
        // std.debug.print("freeing class ref\n", .{});
        const self = fromObject(obj);
        php.destroyHashTable(&self.fields);
        const class = ZigClass.fromObject(obj);
        class.release();
    }

    pub const fromObject = Super.fromObject;
};
