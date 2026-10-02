const std = @import("std");

const accessor = @import("../accessor.zig");
const Transform = accessor.Transform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const interface = @import("../module/native/interface.zig");
const PrimitiveFlags = interface.StructureFlags.Primitive;
const php_ng = @import("../php/root.zig");
const Array = php_ng.Array;
const Class = php_ng.Class;
const Object = php_ng.Object;
const String = php_ng.String;
const Value = php_ng.Value;

pub const @"struct" = Object.Custom(struct {
    pub const Static = struct {
        flags: PrimitiveFlags,
        length: usize,
        alignment: std.mem.Alignment,
        value_acc: *accessor.Any,
    };

    pub fn staticInit(args: struct { type_info_array: *Array }) !@This() {
        const type_info = args.type_info_array.extract(struct {
            flags: PrimitiveFlags,
            length: usize,
            @"align": usize,
            instance: struct {
                member: [1]struct {},
            },
        });
    }

    pub fn getValue(self: *@This(), transform: accessor.Transform) !Value {
        return switch (transform) {
            .none, .plain => get: {
                const class = ZigClassEntry.fromStructure(self);
                const static = class.getStaticData(@This());
                break :get try static.value_acc.get(self);
            },
            else => Super.getValue(self, transform),
        };
    }

    pub fn setValue(self: *@This(), value: *const Value, transform: accessor.Transform) !void {
        if (transform == .none) {
            if (try self.copySelf(value)) return;
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            try static.value_acc.set(self, value);
        } else {
            return Super.setValue(self, value, transform);
        }
    }

    pub fn getProperties(self: *@This(), purpose: Object.PropertiesPurpose) !*Array {
        const arr: *Array = .create();
        errdefer arr.release();
        switch (purpose) {
            .debug, .json => {
                const value = try self.getValue(.none);
                defer value.release();
                arr.set("value", value);
            },
            else => {},
        }
        return arr;
    }

    pub fn compareWith(self: *@This(), other: Value) !c_int {
        const op1 = try self.getValue(.none);
        defer op1.release();
        const op2 = try getPrimitiveValue(other);
        defer op2.release();
        return op1.compareWith(op2);
    }

    pub fn doOperation(opcode: Object.Opcode, a: Value, b: Value) !Value {
        const op1 = try getPrimitiveValue(a);
        const op2 = try getPrimitiveValue(b);
        return opcode.perform(op1, op2);
    }

    fn getPrimitiveValue(operand: Value) !Value {
        if (operand.getObject() catch null) |ptr_obj| {
            if (ZigClassEntry.isZigInstance(ptr_obj)) {
                const class = ZigClassEntry.fromObject(ptr_obj);
                if (class.type == .primitive) {
                    const self = fromObject(ptr_obj);
                    return try self.getValue(.none);
                }
            }
        }
        return operand.retain();
    }
});
