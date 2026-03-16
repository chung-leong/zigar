const std = @import("std");

const accessor = @import("../accessor.zig");
const ObjectTransform = accessor.ObjectTransform;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");
const error_set = @import("error-set.zig");
const ErrorSet = error_set.ErrorSet;

pub const ErrorUnion = struct {
    slots: Value = undefined,
    bytes: *ByteBuffer = undefined,

    const Super = structure.Parent(@This());
    pub const Static = struct {
        payload_acc: *accessor.Any = undefined,
        payload_transform: ?ObjectTransform = null,
        error_acc: *accessor.Primitive = undefined,
        error_class: *ZigClassEntry = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member0 = try class.getMember(.instance, 0);
            self.payload_acc = &member0.accessors;
            self.payload_transform = member0.objectTransform();
            const member1 = try class.getMember(.instance, 1);
            if (member1.accessors != .primitive) return error.InvalidAccessor;
            self.error_acc = &member1.accessors.primitive;
            self.error_class = member1.class orelse return error.MissingClass;
        }
    };

    pub fn readSelf(self: *@This(), transform: ObjectTransform) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const err = try static.error_acc.get(self.bytes);
        if (php.getType(&err) == .object) {
            const err_obj = php.getValueObject(&err) catch unreachable;
            const err_struct = ZigObject(ErrorSet).fromObject(err_obj).structure();
            try err_struct.acquireDebugInfo();
            _ = &php.throwExceptionObject(err_obj);
            return php.createValueNull();
        } else {
            var value = try static.payload_acc.get(self);
            if (static.payload_transform) |ot| {
                try ot.apply(&value);
            } else if (transform != .to_value) {
                try transform.apply(&value);
            }
            return value;
        }
    }

    pub fn writeSelf(self: *@This(), value: *const Value) !void {
        if (try self.copySelf(value)) return;
        const class = ZigClassEntry.fromStructure(self);
        var static = class.getStaticData(@This());
        const err_maybe = switch (php.getType(value)) {
            .object => check: {
                // see if value is an Throwable
                const obj = php.getValueObject(value) catch unreachable;
                const is_throwable = php.instanceOf(obj.ce, php.getInterface(.throwable));
                break :check if (is_throwable) value else null;
            },
            else => null,
        };
        const null_value = php.createValueNull();
        if (err_maybe) |err| {
            try static.error_acc.set(self.bytes, err);
            try static.payload_acc.set(self, &null_value);
        } else {
            try static.error_acc.set(self.bytes, &null_value);
            try static.payload_acc.set(self, value);
        }
    }

    pub const setStorage = Super.setStorage;
    pub const getExtent = Super.getExtent;
    pub const copyArguments = Super.copyArguments;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getReferencedObjects = Super.getReferencedObjects;
    const fromObject = Super.fromObject;
    const copySelf = Super.copySelf;
};
