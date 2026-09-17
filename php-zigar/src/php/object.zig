pub const std = @import("std");

const Array = @import("array.zig").Array;
const c = @import("c.zig");
const pd = c.declarations;
const pi = c.imports;
const deref = c.deref;
const castTo = c.castTo;
const castFrom = c.castFrom;
const ClassEntry = @import("class-entry.zig").ClassEntry;
const String = @import("string.zig").String;
const unsupported = @import("failure.zig").unsupported;
const Value = @import("value.zig").Value;

pub const Object = struct {
    pub fn create(ce: *const ClassEntry, params: []const Value) !*@This() {
        const zce = castFrom(ClassEntry, ce);
        var zval: pd.zval = undefined;
        const result = pi.object_init_ex(&zval, zce);
        if (result != c.SUCCESS) return error.CannotCreateObject;
        const zobj = zval.value.obj.?;
        const handlers = zobj.handlers.?;
        const handler = handlers.get_constructor.?;
        const ctor = handler(zobj);
        if (ctor) |f| {
            switch (@hasDecl(c, "zend_call_known_function_ex")) {
                true => pi.zend_call_known_function_ex(
                    f,
                    zobj,
                    zobj.ce,
                    null,
                    @intCast(params.len),
                    @constCast(params.ptr),
                    null,
                    0,
                ),
                false => pi.zend_call_known_function(
                    f,
                    zobj,
                    zobj.ce,
                    null,
                    @intCast(params.len),
                    @constCast(params.ptr),
                    null,
                ),
            }
        }
        return castTo(Object, zobj);
    }

    pub fn reuse(self: *@This()) *@This() {
        self.addRef();
        return self;
    }

    pub fn addRef(self: *@This()) void {
        self.impl.gc.refcount += 1;
    }

    pub fn release(self: *@This()) void {
        const zobj = &self.impl;
        pi.zend_object_release(zobj);
    }

    pub fn subtractRef(self: *@This()) void {
        self.impl.gc.refcount -= 1;
    }

    pub fn toValue(self: *const @This()) Value {
        return .fromObject(self);
    }

    pub fn hasElement(self: *const @This(), key: anytype) !bool {
        const zobj = @constCast(&self.impl);
        const k: Value = .createFromAny(key);
        defer k.release();
        var value: Value = undefined;
        const std_handlers = standardHandlers();
        const handlers = zobj.handlers.?;
        const handler = handlers.read_dimension orelse return error.NoArrayAccess;
        if (std_handlers.read_dimension == handler) {
            if (zobj.ce.*.arrayaccess_funcs_ptr == null) return error.NoArrayAccess;
        }
        const zk = castFrom(Value, &k.value);
        const rv = handler(zobj, zk, pd.BP_VAR_IS, &value);
        return rv != null;
    }

    pub fn getElement(self: *const @This(), key: anytype) !Value {
        const zobj = @constCast(&self.impl);
        const k: Key = .createFromAny(key);
        defer k.release();
        var value: Value = undefined;
        const std_handlers = standardHandlers();
        const handlers = zobj.handlers.?;
        const handler = handlers.read_dimension orelse return error.NoArrayAccess;
        if (std_handlers.read_dimension == handler) {
            if (zobj.ce.*.arrayaccess_funcs_ptr == null) return error.NoArrayAccess;
        }
        const zk = castFrom(Value, &k.value);
        const rv = handler(zobj, zk, pd.BP_VAR_R, &value);
        if (rv == null) return error.Missing;
        return rv.*;
    }

    pub fn getProperty(self: *const @This(), name: anytype) !Value {
        const zobj = @constCast(&self.impl);
        const n: Value = .fromString(.createFromAny(name));
        defer n.release();
        var value: Value = undefined;
        const zn = castFrom(Value, &n);
        const result = pi.zend_read_property_ex(zobj.ce, zobj, zn, true, &value);
        if (result != pd.SUCCESS) return error.Missing;
        return value;
    }

    pub fn getProperties(self: *const @This()) *Array {
        var value = self.toValue();
        const zval = castFrom(Value, &value);
        const ht = pi.zend_get_properties_for(zval, pd.ZEND_PROP_PURPOSE_ARRAY_CAST).?;
        return castTo(Array, ht);
    }

    pub fn standardHandlers() *const Handlers {
        return deref(&pi.std_object_handlers).?;
    }

    pub const Handlers = c.zend_object_handlers;
    const Key = struct {
        pub fn createFromAny(arg: anytype) @This() {
            const AT = @TypeOf(arg);
            return switch (@typeInfo(AT)) {
                .int, .comptime_int => .{ .value = .fromInteger(@intCast(arg)) },
                else => .{ .value = .fromString(.createFromAny(arg)) },
            };
        }

        pub fn release(self: @This()) void {
            self.value.release();
        }

        value: Value,
    };

    impl: pd.zend_object,
};
