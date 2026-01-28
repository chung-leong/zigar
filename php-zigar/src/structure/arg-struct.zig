const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClass = @import("../class.zig").ZigClass;
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

        pub fn init(self: *@This(), class: *ZigClass) !void {
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
        const class = ZigClass.fromStructure(self);
        const static = class.getStaticData(@This());
        if (arg_iter.len != static.arg_accessors.len) return error.IncorrectArgumentCount;
        // use accessors to write into the argument struct
        var index: usize = 0;
        while (arg_iter.next()) |arg| : (index += 1) {
            const accessors = static.arg_accessors[index];
            try accessors.set(self, arg);
        }
    }

    pub fn getReturnValue(self: *@This()) !Value {
        const class = ZigClass.fromStructure(self);
        const static = class.getStaticData(@This());
        return static.retval_accessors.get(self);
    }

    pub const fromObject = Super.fromObject;
    pub const setStorage = Super.setStorage;
    pub const readSelf = Super.readSelf;
    pub const freeObject = Super.freeObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
};
