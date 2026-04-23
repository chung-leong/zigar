const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const cache = @import("../cache.zig");
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
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    const Super = structure.OptionalLike(@This());

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
                php.addRef(prop_obj);
                return php.createValueObject(prop_obj);
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
                const err_obj = php.getValueObject(&err) catch unreachable;
                const err_struct = ZigObject(ErrorSet).fromObject(err_obj).structure();
                try err_struct.acquireDebugInfo();
                _ = &php.throwExceptionObject(err_obj);
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
            const err_maybe = switch (php.getValueType(value)) {
                .object => check: {
                    // see if value is an Throwable
                    const obj = php.getValueObject(value) catch unreachable;
                    const is_throwable = php.instanceOf(obj.ce, php.getInterface(.throwable));
                    break :check if (is_throwable) value else null;
                },
                else => null,
            };
            if (err_maybe) |err| {
                try static.error_acc.set(self.buffer, err);
            } else {
                try static.payload_acc.set(self, value);
                const zero = php.createValueLong(0);
                try static.error_acc.int.set(self, &zero);
            }
        } else {
            try Super.setValue(self, value, transform);
        }
    }

    pub fn visitPointers(self: *@This(), cb: anytype, args: anytype, comptime options: structure.VisitOptions) accessor.Error!void {
        const class = ZigClassEntry.fromStructure(self);
        if (class.flags.common.has_slot) {
            const static = class.getStaticData(@This());
            const run = options.include_inactive or check: {
                const err = try static.error_acc.get(self.buffer);
                break :check php.getValueType(&err) != .object;
            };
            if (run) {
                const value = try static.payload_acc.get(self);
                defer php.release(&value);
                const obj = php.getValueObject(&value) catch return;
                try structure.invokeMethod(obj, "visitPointers", .{ cb, args, options });
            }
        }
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
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getProperties = Super.getProperties;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const getIterator = Super.getIterator;
    const fromObject = Super.fromObject;
    const copySelf = Super.copySelf;
};
