pub const std = @import("std");

const Array = @import("array.zig").Array;
const c = @import("c.zig");
const pd = c.declarations;
const pi = c.imports;
const castTo = c.castTo;
const castFrom = c.castFrom;
const efree = @import("allocator.zig").efree;
const failure = @import("failure.zig");
const String = @import("string.zig").String;
const Value = @import("value.zig").Value;

pub const FunctionCallCache = struct {
    pub fn init(callable: *const Value) !@This() {
        var fci: pd.zend_fcall_info = undefined;
        var fcc: pd.zend_fcall_info_cache = undefined;
        fci.retval = null;
        fci.param_count = 0;
        fci.params = null;
        var err_msg: [*c]u8 = undefined;
        const zcbl = @constCast(castFrom(Value, callable));
        const result = pi.zend_fcall_info_init(zcbl, 0, &fci, &fcc, null, &err_msg);
        if (result != pd.SUCCESS) {
            if (err_msg != null) {
                defer efree(err_msg, @src());
                return failure.report("{s}", .{err_msg});
            } else {
                return error.NotCallable;
            }
        }
        return .{ .fci = fci, .fcc = fcc };
    }

    pub fn deinit(self: *@This()) void {
        pi.zend_fcall_info_args_clear(&self.fci, true);
    }

    pub fn argumentInfo(self: *@This()) []c.zend_arg_info {
        const common = &self.fcc.function_handler.*.common;
        return if (common.*.num_args > 0) common.*.arg_info[0..common.*.num_args] else &.{};
    }

    pub fn useNamedArguments(self: *@This(), named_params: ?*Array) void {
        self.fci.named_params = named_params;
    }

    pub fn invoke(self: *@This(), args: []const Value) !Value {
        const zargs: []const pd.zval = @ptrCast(args);
        pi.zend_fcall_info_argp(&self.fci, @truncate(zargs.len), @constCast(zargs.ptr));
        defer pi.zend_fcall_info_args_clear(&self.fci, false);
        defer self.fci.named_params = null;
        var zretval: pd.zval = undefined;
        self.fci.retval = &zretval;
        const result = pi.zend_call_function(&self.fci, &self.fcc);
        if (result != pd.SUCCESS) return error.Failure;
        const retval = castTo(Value, &zretval);
        if (retval.kind() == .undefined) {
            const eg = getExecutorGlobals();
            if (eg.exception != null) {
                return error.ExceptionThrown;
            }
        }
        return retval;
    }

    fci: pd.zend_fcall_info,
    fcc: pd.zend_fcall_info_cache,
};
