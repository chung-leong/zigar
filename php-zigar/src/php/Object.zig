pub const std = @import("std");

pub const Custom = @import("Object/Custom.zig").@"fn";
pub const Iterator = @import("Object/Iterator.zig");
pub const MethodSet = @import("Object/MethodSet.zig").@"fn";
const php = @import("root.zig");
const Array = php.Array;
const c = php.c;
const pi = php.imports;
const deref = php.deref;
const Class = php.Class;
const failure = php.failure;
const unsupported = failure.unsupported;
const Function = php.Function;
const String = php.String;
const Value = php.Value;
pub const Handlers = c.zend_object_handlers;

pub fn class(self: *const @This()) *const Class {
    return @ptrCast(self.impl.ce);
}

pub fn create(ce: *const Class, params: []const Value) !*@This() {
    var zval: c.zval = undefined;
    const result = pi.object_init_ex(&zval, @ptrCast(@constCast(ce)));
    if (result != c.SUCCESS) return error.CannotCreateObject;
    const zobj = zval.value.obj;
    const handlers = zobj.*.handlers;
    const handler = handlers.*.get_constructor;
    const ctor = handler.?(zobj);
    if (ctor) |f| {
        const zparams: [*]c.zval = @ptrCast(@constCast(params.ptr));
        const len: u32 = @truncate(params.len);
        switch (@hasDecl(c, "zend_call_known_function_ex")) {
            true => pi.zend_call_known_function_ex(f, zobj, zobj.*.ce, null, len, zparams, null, 0),
            false => pi.zend_call_known_function(f, zobj, zobj.*.ce, null, len, zparams, null),
        }
    }
    return @ptrCast(zobj);
}

pub fn createFromName(name: anytype, params: []const Value) !*@This() {
    const ce = Class.find(name) orelse return error.ClassNotFound;
    return .create(ce, params);
}

pub fn retain(self: *@This()) *@This() {
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

pub fn isInstanceOf(self: *const @This(), ce: *const Class) bool {
    const zobj = &self.impl;
    const zce: *const c.zend_class_entry = @ptrCast(ce);
    return (zobj.ce == zce) or pi.instanceof_function_slow(zobj.ce, zce);
}

pub fn hasInterface(self: *const @This(), iface: Class.InterfaceId) bool {
    return self.isInstanceOf(iface.get());
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
    const rv = handler(zobj, @ptrCast(k.value), c.BP_VAR_IS, &value);
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
    const zk: *c.zval = @ptrCast(&k.value);
    const rv = handler(zobj, zk, c.BP_VAR_R, &value);
    if (rv == null) return error.Missing;
    return rv.*;
}

pub fn getProperty(self: *const @This(), name: anytype) !Value {
    const zobj = @constCast(&self.impl);
    const n: *String = .createFromAny(name);
    defer n.release();
    var value: Value = undefined;
    const zn: *c.zend_string = @ptrCast(n);
    const zval: *c.zval = @ptrCast(&value);
    const result = pi.zend_read_property_ex(zobj.ce, zobj, zn, true, zval);
    if (result != c.SUCCESS) return error.Missing;
    return value;
}

pub fn getProperties(self: *const @This()) *Array {
    var value = self.toValue();
    const zval: *c.zval = @ptrCast(&value);
    const ht = pi.zend_get_properties_for(zval, c.ZEND_PROP_PURPOSE_ARRAY_CAST).?;
    return @ptrCast(ht);
}

pub fn toCustom(self: *const @This(), comptime C: type) *C.Custom {
    if (C == @This()) return @constCast(self);
    std.debug.assert(self.class() == C.class());
    const custom_obj: *C = @ptrCast(@constCast(self));
    return &custom_obj.custom;
}

pub fn fromCustom(self: anytype) *@This() {
    const T = @TypeOf(self.*);
    const C = *Custom(T);
    const custom_obj: *C = @ptrCast(@constCast(self));
    std.debug.assert(custom_obj.object.class() == C.class());
    return &custom_obj.object;
}

pub fn standardHandlers() *const Handlers {
    return deref(&pi.std_object_handlers).?;
}

pub const GarbageCollectionResult = struct {
    slice: []const *Value = &.{},
    array: ?*Array = null,
};
pub const ClosureResult = struct {
    class: ?*Class = null,
    function: ?*Function = null,
    object: ?*Object = null,
};
/// Purpose the data to be returned by getProperties()
pub const PropertiesPurpose = enum(c_int) {
    /// Used for debugging. Supersedes get_debug_info handler.
    debug = c.ZEND_PROP_PURPOSE_DEBUG,
    /// Used for (array) casts.
    array = c.ZEND_PROP_PURPOSE_ARRAY_CAST,
    /// Used for serialization using the "O" scheme.
    /// Unserialization will use __wakeup().
    serialize = c.ZEND_PROP_PURPOSE_SERIALIZE,
    /// Used for var_export().
    /// The data will be passed to __set_state() when evaluated.
    var_export = c.ZEND_PROP_PURPOSE_VAR_EXPORT,
    /// Used for json_encode().
    json = c.ZEND_PROP_PURPOSE_JSON,
    /// Used for get_object_vars().
    get_object_vars = switch (@hasDecl(c, "ZEND_PROP_PURPOSE_GET_OBJECT_VARS")) {
        true => c.ZEND_PROP_PURPOSE_GET_OBJECT_VARS,
        false => c.ZEND_PROP_PURPOSE_JSON + 1,
    },
    default,
};
/// Opcodes supported by doOperation()
pub const Opcode = enum(u8) {
    add = c.ZEND_ADD,
    sub = c.ZEND_SUB,
    mul = c.ZEND_MUL,
    div = c.ZEND_DIV,
    MOD = c.ZEND_MOD,
    POW = c.ZEND_POW,
    _,
};
pub const PropertyStatus = enum(c_int) {
    isset = c.ZEND_PROPERTY_ISSET,
    not_empty = c.ZEND_PROPERTY_NOT_EMPTY,
    exists = c.ZEND_PROPERTY_EXISTS,
};

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
const Object = @This();

impl: c.zend_object,
