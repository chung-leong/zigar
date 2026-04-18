const std = @import("std");

const accessor = @import("../accessor.zig");
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
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    const Super = structure.Parent(@This());

    pub const Static = struct {
        payload_acc: *accessor.Any = undefined,
        payload_class: *ZigClassEntry = undefined,
        error_acc: *accessor.Any = undefined,
        error_class: *ZigClassEntry = undefined,

        pub const StaticPropId = enum { payload, error_set };
        pub const StaticPropCacheEntry = struct {
            id: usize,
            prop_id: StaticPropId,

            const name = "static:error_set";

            pub inline fn find(cache_slot: ?[*]?*anyopaque) !?StaticPropId {
                const self: *@This() = if (cache_slot) |ptr| @ptrCast(ptr) else return null;
                return if (self.id == @intFromPtr(name))
                    self.prop_id
                else if (self.id != 0)
                    error.ForAnotherCache
                else
                    null;
            }

            pub inline fn set(cache_slot: ?[*]?*anyopaque, prop_id: StaticPropId) void {
                const self: *@This() = if (cache_slot) |ptr| @ptrCast(ptr) else return;
                self.* = .{ .id = @intFromPtr(name), .prop_id = prop_id };
            }
        };

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member0 = try class.getMember(.instance, 0);
            self.payload_acc = &member0.accessors;
            const member1 = try class.getMember(.instance, 1);
            self.error_acc = &member1.accessors;
            self.error_class = member1.class;
        }

        pub fn getStaticProperty(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) !Value {
            if (findStaticPropId(name, cache_slot)) |id| {
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
            return findStaticPropId(name, cache_slot) != null;
        }

        fn findStaticPropId(name: *String, cache_slot: ?[*]?*anyopaque) ?StaticPropId {
            if (StaticPropCacheEntry.find(cache_slot) catch return null) |id| return id;
            inline for (std.meta.fields(StaticPropId)) |field| {
                if (php.matchString(name, "__" ++ field.name)) {
                    const id = @field(StaticPropId, field.name);
                    StaticPropCacheEntry.set(cache_slot, id);
                    return id;
                }
            }
            return null;
        }
    };

    pub fn getValue(self: *@This(), transform: accessor.Transform) !Value {
        if (transform == .none) {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            const err = try static.error_acc.get(self);
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
            const null_value = php.createValueNull();
            if (err_maybe) |err| {
                try static.error_acc.set(self, err);
                try static.payload_acc.set(self, &null_value);
            } else {
                try static.payload_acc.set(self, value);
                try static.error_acc.set(self, &null_value);
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
                const err = try static.error_acc.get(self);
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
    pub const getGarbageCollection = Super.getGarbageCollection;
    const fromObject = Super.fromObject;
    const copySelf = Super.copySelf;
};
