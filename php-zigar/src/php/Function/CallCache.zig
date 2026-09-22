const std = @import("std");
const builtin = @import("builtin");

const php = @import("../root.zig");
const Array = php.Array;
const c = php.c;
const pi = php.imports;
const efree = php.efree;
const failure = php.failure;
const String = php.String;
const Value = php.Value;

pub fn init(callable: Value) !@This() {
    var fci: c.zend_fcall_info = undefined;
    var fcc: c.zend_fcall_info_cache = undefined;
    fci.retval = null;
    fci.param_count = 0;
    fci.params = null;
    var err_msg: [*c]u8 = undefined;
    const result = pi.zend_fcall_info_init(@ptrCast(@constCast(&callable)), 0, &fci, &fcc, null, &err_msg);
    if (result != c.SUCCESS) {
        if (err_msg != null) {
            defer efree(err_msg, @src());
            return failure.report("{s}", .{err_msg});
        } else {
            return error.NotCallable;
        }
    }
    return .{ .fci = fci, .fcc = fcc };
}

pub fn initFromName(name: *const String) !@This() {
    return try init(.fromString(name));
}

pub fn deinit(self: *@This()) void {
    pi.zend_fcall_info_args_clear(&self.fci, true);
}

pub fn argumentInfo(self: *@This()) []c.zend_arg_info {
    const common = &self.fcc.function_handler.*.common;
    return if (common.*.num_args > 0) common.*.arg_info[0..common.*.num_args] else &.{};
}

pub fn useNamedArguments(self: *@This(), named_params: ?*Array) void {
    self.fci.named_params = if (named_params) |ptr| @ptrCast(ptr) else null;
}

pub fn invoke(self: *@This(), args: []const Value) !Value {
    const zargs: []const c.zval = @ptrCast(args);
    pi.zend_fcall_info_argp(&self.fci, @truncate(zargs.len), @constCast(zargs.ptr));
    defer pi.zend_fcall_info_args_clear(&self.fci, false);
    defer self.fci.named_params = null;
    var retval: Value = undefined;
    self.fci.retval = @ptrCast(&retval);
    const result = pi.zend_call_function(&self.fci, &self.fcc);
    if (result != c.SUCCESS) return error.Failure;
    if (retval.kind() == .undefined) {
        const eg = php.globals("executor");
        if (eg.exception != null) return error.ExceptionThrown;
    }
    return retval;
}

fci: c.zend_fcall_info,
fcc: c.zend_fcall_info_cache,
