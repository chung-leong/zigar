const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const ArgStruct = struct {
    bytes: *ByteBuffer = undefined,
    slots: Value = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        arg_accessors: []*accessor.Any = undefined,
        retval_accessors: *accessor.Any = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            var iter = class.getMemberIterator(.instance);
            if (iter.len == 0) return error.Unexpected;
            self.arg_accessors = try php.allocator.alloc(*accessor.Any, iter.len - 1);
            var index: usize = 0;
            while (iter.next()) |member| {
                if (index == 0)
                    self.retval_accessors = &member.accessors
                else
                    self.arg_accessors[index - 1] = &member.accessors;
                index += 1;
            }
        }

        pub fn deinit(self: *@This()) void {
            php.allocator.free(self.arg_accessors);
        }
    };

    pub fn copyArguments(self: *@This(), arg_iter: *php.ArgumentIterator) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        if (arg_iter.len != static.arg_accessors.len) return error.IncorrectArgumentCount;
        // use accessors to write into the argument struct
        var index: usize = 0;
        while (arg_iter.next()) |arg| : (index += 1) {
            const acc = static.arg_accessors[index];
            try acc.set(self, arg);
        }
    }

    pub fn getReturnValue(self: *@This()) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return try static.retval_accessors.get(self);
    }

    pub fn getArguments(self: *@This()) ![]Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const len = static.arg_accessors.len;
        const list = try php.allocator.alloc(Value, len);
        for (static.arg_accessors, 0..) |acc, i| list[i] = try acc.get(self);
        return list;
    }

    pub fn setReturnValue(self: *@This(), value: *const Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return try static.retval_accessors.set(self, value);
    }

    pub const setStorage = Super.setStorage;
    pub const readSelf = Super.readGeneric;
    pub const getExtent = Super.getExtent;
    pub const freeObject = Super.freeObject;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
};
