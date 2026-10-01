const std = @import("std");

const accessor = @import("../accessor.zig");
const Transform = accessor.Transform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const interface = @import("../module/native/interface.zig");
const StructFlags = interface.StructureFlags.Struct;
const StructurePurpose = interface.StructurePurpose;
const php_ng = @import("../php/root.zig");
const Array = php_ng.Array;
const Class = php_ng.Class;
const Object = php_ng.Object;
const String = php_ng.String;
const N = String.static;
const Value = php_ng.Value;

pub const @"struct" = Object.Custom(struct {
    pub const Static = struct {
        flags: StructFlags,
        alignment: std.mem.Alignment,
        byte_size: usize,
        purpose: StructurePurpose,
        backing_int: ?struct {
            class: *Class,
            accessors: *accessor.Any,
        } = null,
        required_field_count: usize = 0,
        total_field_count: usize = 0,

        member: *Class,
    };

    pub fn @"static get child"(static: *const Static) *Object {
        return static.element_class.object.retain();
    }

    pub fn @"static get length"(static: *const Static) usize {
        return static.length;
    }

    pub fn staticInit(args: struct { type_info: *Array }) @This() {
        const flags_v = try type_info.get(N("flags"));
        const flags_v = try type_info.get(N("align"));

    }

    pub fn countElements(self: *@This()) usize {
        const zig_class = self.class();
        return zig_class.length();
    }

    pub fn readDimension(self: *@This(), offset: Value, access: Value.Access) !Value {
        _ = access;
        const static = self.class().static();
        const index = try offset.getUnsigned();
        return try static.value_acc.getElement(self, index);
    }

    pub fn writeDimension(self: *@This(), offset: Value, value: Value) !void {
        const static = self.class().static();
        const index = try offset.getUnsigned();
        try static.value_acc.setElement(self, index, value);
    }

    buffer: *ByteBuffer,
    table: Value,
});
