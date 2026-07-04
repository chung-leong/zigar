const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const php = @import("../php.zig");
const HashTable = php.HashTable;
const Object = php.Object;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Primitive = struct {
    buffer: *ByteBuffer = undefined,

    pub const Super = structure.Parent(@This());
    pub const Static = struct {
        value_acc: *accessor.Any = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member = try class.getMember(.instance, 0);
            self.value_acc = &member.accessors;
        }
    };

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

    pub fn getPropertiesFor(obj: *Object, purpose_i: c_uint) !*HashTable {
        const purpose: php.PropPurpose = @enumFromInt(purpose_i);
        const self = fromObject(obj);
        const ht = php.createArray();
        switch (purpose) {
            .debug, .json => {
                const value = try self.getValue(.none);
                php.setHashEntry(ht, "value", &value);
            },
            else => {},
        }
        return ht;
    }

    pub fn compare(a: *Value, b: *Value) !c_int {
        const op1 = try getPrimitiveValue(a);
        const op2 = try getPrimitiveValue(b);
        return php.compareValues(&op1, &op2);
    }

    pub fn doOperation(opcode: php.Uchar, retval: *Value, a: *Value, b: *Value) !c_int {
        const op1 = try getPrimitiveValue(a);
        const op2 = try getPrimitiveValue(b);
        retval.* = try php.performOperation(opcode, &op1, &op2);
        return php.SUCCESS;
    }

    fn getPrimitiveValue(operand: *const Value) !Value {
        if (php.getValueObject(operand) catch null) |ptr_obj| {
            if (ZigClassEntry.isZigInstance(ptr_obj)) {
                const class = ZigClassEntry.fromObject(ptr_obj);
                if (class.type == .primitive) {
                    const self = fromObject(ptr_obj);
                    return try self.getValue(.none);
                }
            }
        }
        return operand.*;
    }

    pub const getExtent = Super.getExtent;
    pub const setStorage = Super.setStorage;
    pub const initialize = Super.initialize;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const getProperty = Super.getProperty;
    pub const setProperty = Super.setProperty;
    pub const propertyExists = Super.propertyExists;
    pub const checkArguments = Super.checkArguments;
    pub const visitPointers = Super.visitPointers;
    pub const getConstructor = Super.getConstructor;
    pub const cloneObject = Super.cloneObject;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const getProperties = Super.getProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const fromObject = Super.fromObject;
    pub const fromValue = Super.fromValue;
    const copySelf = Super.copySelf;
};
