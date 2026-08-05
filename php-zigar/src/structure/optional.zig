const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const Error = @import("../failure.zig").Error;
const php = @import("../php.zig");
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const Optional = struct {
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    pub const Super = structure.OptionalLike(@This());
    pub const Static = struct {
        payload_acc: *accessor.Any = undefined,
        payload_class: *ZigClassEntry = undefined,
        present_acc: *accessor.Any = undefined,

        pub const props = .{.child};
        pub const prefix = "__";
        pub const aliases = .{};

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member0 = try class.getMember(.instance, 0);
            self.payload_acc = &member0.accessors;
            self.payload_class = member0.class;
            const member1 = try class.getMember(.instance, 1);
            self.present_acc = &member1.accessors;
        }

        pub fn getStaticProperty(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) !Value {
            const class = ZigClassEntry.fromStatic(self);
            const id_cache = class.getIdCache(props, prefix, aliases);
            if (id_cache.idFromString(name, cache_slot)) |id| {
                const prop_obj = switch (id) {
                    .child => self.payload_class.object,
                };
                return php.createValueObject(php.reuse(prop_obj));
            } else {
                return error.Missing;
            }
        }

        pub fn staticPropertyExists(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) bool {
            const class = ZigClassEntry.fromStatic(self);
            const id_cache = class.getIdCache(props, prefix, aliases);
            return id_cache.idFromString(name, cache_slot) != null;
        }
    };

    pub fn getValue(self: *@This(), transform: accessor.Transform) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const present = try static.present_acc.get(self);
        if (try php.getValueLong(&present) == 0) {
            return php.createValueNull();
        }
        var value = try static.payload_acc.get(self);
        if (transform != .none) try transform.apply(&value);
        return value;
    }

    pub fn setValue(self: *@This(), value: *const Value, transform: accessor.Transform) !void {
        if (transform == .none) {
            if (try self.copySelf(value)) return;
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            const is_present = !php.isValueNull(value);
            if (is_present) {
                try static.payload_acc.set(self, value);
            }
            // optionals of error sets and pointers don't use a separate present flag
            // non-zero value indiciate whether a value is present
            if (static.present_acc.* == .u8 or !is_present) {
                const present = php.createValueLong(if (is_present) 1 else 0);
                try static.present_acc.set(self, &present);
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
        if (class.flags.common.has_pointer) {
            const static = class.getStaticData(@This());
            const run = !options.ignore_inactive or check: {
                const present = try static.present_acc.get(self);
                break :check try php.getValueLong(&present) != 0;
            };
            if (run) {
                if (try static.payload_acc.getObject(self, options.ignore_uncreated)) |obj| {
                    try structure.invokeMethod(obj, "visitPointers", .{ cb, args, options });
                }
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
    pub const getElement = Super.getElement;
    pub const setElement = Super.setElement;
    pub const getLength = Super.getLength;
    pub const findMethod = Super.findMethod;
    pub const getConstructor = Super.getConstructor;
    pub const cloneObject = Super.cloneObject;
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
    pub const compare = Super.compare;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const getIterator = Super.getIterator;
    pub const fromObject = Super.fromObject;
    pub const fromValue = Super.fromValue;
    const copySelf = Super.copySelf;
};
