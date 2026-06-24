const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const cache = @import("../cache.zig");
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const ZigException = @import("../exception.zig").ZigException;
const failure = @import("../failure.zig");
const Error = failure.Error;
const ZigObject = @import("../object.zig").ZigObject;
const php = @import("../php.zig");
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");
const error_set = @import("error-set.zig");
const ErrorSet = error_set.ErrorSet;

pub const ErrorUnion = struct {
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    pub const Super = structure.OptionalLike(@This());
    pub const Static = struct {
        payload_acc: *accessor.Any = undefined,
        payload_class: *ZigClassEntry = undefined,
        error_acc: *accessor.Constant = undefined,
        error_class: *ZigClassEntry = undefined,

        pub const StaticPropCache = cache.IdCache(.{ .payload, .error_set }, "__", .{});

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member0 = try class.getMember(.instance, 0);
            self.payload_acc = &member0.accessors;
            self.payload_class = member0.class;
            const member1 = try class.getMember(.instance, 1);
            if (member1.accessors != .constant) return error.Unexpected;
            self.error_acc = &member1.accessors.constant;
            self.error_class = member1.class;
        }

        pub fn getStaticProperty(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) !Value {
            if (StaticPropCache.idFromString(name, cache_slot)) |id| {
                const prop_obj = switch (id) {
                    .payload => self.payload_class.object,
                    .error_set => self.error_class.object,
                };
                return php.createValueObject(php.reuse(prop_obj));
            } else {
                return error.Missing;
            }
        }

        pub fn staticPropertyExists(_: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) bool {
            return StaticPropCache.idFromString(name, cache_slot) != null;
        }
    };

    pub fn getValue(self: *@This(), transform: accessor.Transform) !Value {
        if (transform == .none) {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            const err = try static.error_acc.get(self.buffer);
            if (php.getValueType(&err) == .object) {
                const ex_struct = try ZigException.fromValue(&err);
                ex_struct.acquireDebugInfo();
                _ = &php.throwException(ex_struct.object());
                return php.createValueNull();
            }
            return try static.payload_acc.get(self);
        } else {
            return Super.getValue(self, transform);
        }
    }

    pub fn setValue(self: *@This(), value: *const Value, transform: accessor.Transform) !void {
        if (transform == .none) {
            if (try self.copySelf(value)) return;
            const class = ZigClassEntry.fromStructure(self);
            var static = class.getStaticData(@This());
            // attempt to set payload without checking if value contains an exception,
            // since the payload could potentially be something that accepts an exception
            if (static.payload_acc.set(self, value)) {
                // clear error value
                const zero = php.createValueLong(0);
                try static.error_acc.int.set(self, &zero);
            } else |err| {
                if (!php.isValueException(value)) return err;
                // clear any error that might have been reported by payload accessor
                failure.clearMessage();
                try static.error_acc.set(self.buffer, value);
            }
        } else {
            try Super.setValue(self, value, transform);
        }
    }

    pub fn getChildObject(self: *@This()) ?*Object {
        const value = self.getValue(.none) catch return null;
        defer php.release(&value);
        return php.getValueObject(&value) catch null;
    }

    pub fn visitPointers(self: *@This(), cb: anytype, args: anytype, comptime options: structure.VisitOptions) Error!void {
        const class = ZigClassEntry.fromStructure(self);
        if (class.flags.common.has_slot) {
            const static = class.getStaticData(@This());
            const run = !options.ignore_inactive or check: {
                const err = try static.error_acc.get(self.buffer);
                break :check php.getValueType(&err) != .object;
            };
            if (run) {
                if (try static.payload_acc.getObject(self, !options.ignore_uncreated)) |obj| {
                    try structure.invokeMethod(obj, "visitPointers", .{ cb, args, options });
                }
            }
        }
    }

    pub fn compare(a: *Value, b: *Value) !c_int {
        const obj_a = php.getValueObject(a) catch return -1;
        const obj_b = php.getValueObject(b) catch return 1;
        if (obj_a == obj_b) return 0;
        if (obj_a.ce != obj_b.ce) {
            return if (@intFromPtr(obj_a.ce) < @intFromPtr(obj_b.ce)) -1 else 1;
        }
        const class = ZigClassEntry.fromObject(obj_a);
        const static = class.getStaticData(@This());
        const struct_a = fromObject(obj_a);
        const struct_b = fromObject(obj_b);
        const err_a = try static.error_acc.get(struct_a.buffer);
        defer php.release(&err_a);
        const err_b = try static.error_acc.get(struct_b.buffer);
        defer php.release(&err_b);
        if (php.getValueType(&err_a) == .object) {
            if (php.getValueType(&err_b) == .object) {
                return php.compareValues(&err_a, &err_b);
            } else {
                return -1;
            }
        } else if (php.getValueType(&err_b) == .object) {
            return 1;
        }
        const value_a = try static.payload_acc.get(struct_a);
        defer php.release(&value_a);
        const value_b = try static.payload_acc.get(struct_b);
        defer php.release(&value_b);
        return php.compareValues(&value_a, &value_b);
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
    pub const getElement = Super.getElement;
    pub const setElement = Super.setElement;
    pub const getLength = Super.getLength;
    pub const findMethod = Super.findMethod;
    pub const getConstructor = Super.getConstructor;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getProperties = Super.getProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const readElement = Super.readElement;
    pub const writeElement = Super.writeElement;
    pub const hasElement = Super.hasElement;
    pub const countElements = Super.countElements;
    pub const getMethod = Super.getMethod;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const getIterator = Super.getIterator;
    pub const fromObject = Super.fromObject;
    pub const fromValue = Super.fromValue;
    const copySelf = Super.copySelf;
};
