const std = @import("std");
const builtin = @import("builtin");

const php = @import("../root.zig");
const c = php.c;
const pi = php.imports;
const ClassEntry = php.ClassEntry;
const Function = php.Function;
const Value = php.Value;

pub fn create(func: *const Function, scope: ?*ClassEntry, called_scope: ?*ClassEntry, this: ?Value) @This() {
    var result: Value = undefined;
    const CreateClosureFn = @TypeOf(c.zend_create_closure);
    const Arg4 = @typeInfo(CreateClosureFn).@"fn".param_types[4].?;
    const zfunc: *c.zend_function = @ptrCast(@constCast(&func));
    const zcls: ?*c.zend_class_entry = if (scope) |cls| @ptrCast(cls) else null;
    const zccls: ?*c.zend_class_entry = if (called_scope) |cls| @ptrCast(cls) else null;
    if (Arg4 == [*c]c.zend_object) { // 8.6
        const obj = if (this) |tv| tv.object() catch null;
        pi.zend_create_closure(@ptrCast(&result), zfunc, zcls, zccls, @ptrCast(obj));
    } else {
        pi.zend_create_closure(@ptrCast(&result), zfunc, zcls, zccls, @ptrCast(@constCast(&this)));
    }
    return .{ .value = result };
}

pub fn addRef(self: *const @This()) void {
    self.value.addRef();
}

pub fn release(self: *const @This()) void {
    self.value.release();
}

pub fn subtractRef(self: *const @This()) void {
    self.value.subtractRef();
}

pub fn fromValue(value: Value) @This() {
    return .{ .value = value };
}

pub fn toValue(self: *const @This()) Value {
    return self.value;
}

value: Value,
