const std = @import("std");

const fn_transform = @import("zigft/fn-transform.zig");

const php_h = @cImport({
    @cInclude("php.h");
});

pub const c = php_h;

pub const ArgInfo = php_h.zend_internal_arg_info;
pub const ClassEntry = php_h.zend_class_entry;
pub const CompilerGlobals = php_h.zend_compiler_globals;
pub const ExecutorGlobals = php_h.zend_executor_globals;
pub const ExecuteData = php_h.zend_execute_data;
pub const FunctionEntry = php_h.zend_function_entry;
pub const Object = php_h.zend_object;
pub const String = php_h.zend_string;
pub const Value = php_h.zval;

pub const IS_ALIAS_PTR = php_h.IS_ALIAS_PTR;
pub const IS_ARRAY = php_h.IS_ARRAY;
pub const IS_CALLABLE = php_h.IS_CALLABLE;
pub const IS_CONSTANT_AST = php_h.IS_CONSTANT_AST;
pub const IS_DOUBLE = php_h.IS_DOUBLE;
pub const IS_FALSE = php_h.IS_FALSE;
pub const IS_INDIRECT = php_h.IS_INDIRECT;
pub const IS_ITERABLE = php_h.IS_ITERABLE;
pub const IS_LONG = php_h.IS_LONG;
pub const IS_MIXED = php_h.IS_MIXED;
pub const IS_NEVER = php_h.IS_NEVER;
pub const IS_NULL = php_h.IS_NULL;
pub const IS_OBJECT = php_h.IS_OBJECT;
pub const IS_PTR = php_h.IS_PTR;
pub const IS_REFERENCE = php_h.IS_REFERENCE;
pub const IS_RESOURCE = php_h.IS_RESOURCE;
pub const IS_STATIC = php_h.IS_STATIC;
pub const IS_STRING = php_h.IS_STRING;
pub const IS_TRUE = php_h.IS_TRUE;
pub const IS_UNDEF = php_h.IS_UNDEF;
pub const IS_VOID = php_h.IS_VOID;

pub const use_tsrm = false;

pub const TsContext = switch (use_tsrm) {
    true => *const opaque {},
    false => struct {
        pub fn getCompilerGlobals(_: @This()) *CompilerGlobals {
            return php_h.compiler_globals;
        }

        pub fn getExecutorGlobals(_: @This()) *ExecutorGlobals {
            return php_h.executor_globals;
        }
    },
};

fn TsImport(comptime name: []const u8) type {
    const func = @field(php_h, name);
    const func_info = @typeInfo(@TypeOf(func)).@"fn";
    const len = func_info.params.len + 1;
    // var param_types: [len]type = undefined;
    // var param_attrs: [len]std.builtin.Type.Fn.Param.Attributes = undefined;
    // inline for (func_info.params, 0..) |param, i| {
    //     param_types[i] = param.type;
    //     param_attrs[i] = .{};
    // }
    // param_types[len] = TsContext;
    // param_attrs[len] = .{};
    // return @Fn(&param_types, &param_attrs, func_info.return_type, .{
    //     .varargs = func_info.is_var_args,
    // });
    var params: [len]std.builtin.Type.Fn.Param = undefined;
    inline for (func_info.params, 0..) |param, i| {
        params[i] = param;
    }
    return @Type(.{
        .@"fn" = .{
            .calling_convention = .auto,
            .is_generic = false,
            .is_var_args = func_info.is_var_args,
            .params = &params,
            .return_type = func_info.return_type,
        },
    });
}

fn PhpFn(comptime name: []const u8) type {
    const func = @field(php_h, name);
    const func_info = @typeInfo(@TypeOf(func)).@"fn";
    const len = func_info.params.len + if (use_tsrm) 1 else 0;
    // var param_types: [len]type = undefined;
    // var param_attrs: [len]std.builtin.Type.Fn.Param.Attributes = undefined;
    // inline for (func_info.params, 0..) |param, i| {
    //     param_types[i] = param.type;
    //     param_attrs[i] = .{};
    // }
    // if (use_tsrm) {
    //     param_types[len] = TsContext;
    //     param_attrs[len] = .{};
    // }
    // return @Fn(&param_types, &param_attrs, func_info.return_type, .{
    //     .@"callconv" = func_info.calling_convention,
    //     .varargs = func_info.is_var_args,
    // });
    var params: [len]std.builtin.Type.Fn.Param = undefined;
    inline for (func_info.params, 0..) |param, i| {
        params[i] = param;
    }
    if (use_tsrm) {
        params[len] = .{
            .type = TsContext,
            .is_generic = false,
            .is_noalias = false,
        };
    }
    return @Type(.{
        .@"fn" = .{
            .calling_convention = func_info.calling_convention,
            .is_generic = false,
            .is_var_args = func_info.is_var_args,
            .params = &params,
            .return_type = func_info.return_type,
        },
    });
}

pub fn importTs(comptime name: []const u8) TsImport(name) {
    const PhpArgs = std.meta.ArgsTuple(PhpFn(name));
    const php_func = @extern(PhpFn(name), .{});
    const FnT = TsImport(name);
    const Args = std.meta.ArgsTuple(FnT);
    const RT = @typeInfo(FnT).@"fn".return_type.?;
    const ns = struct {
        fn call(args: Args) RT {
            var php_args: PhpArgs = undefined;
            inline for (args[0..php_args.len], 0..) |arg, i| {
                php_args[i] = arg;
            }
            return @call(.auto, php_func, php_args);
        }
    };
    return fn_transform.spreadArgs(ns.call, null);
}

fn TsExport(comptime func: anytype) type {
    const func_info = @typeInfo(@TypeOf(func)).@"fn";
    if (func_info.params[func_info.params.len - 1].type != TsContext) {
        @compileError("Not a thread-safe function");
    }
    const len = func_info.params.len - if (use_tsrm) 0 else 1;
    // var param_types: [len]type = undefined;
    // var param_attrs: [len]std.builtin.Type.Fn.Param.Attributes = undefined;
    // inline for (func_info.params[0..len], 0..) |param, i| {
    //     param_types[i] = param.type;
    //     param_attrs[i] = .{};
    // }
    // return @Fn(&param_types, &param_attrs, func_info.return_type, .{
    //     .@"callconv" = .c,
    //     .varargs = func_info.is_var_args,
    // });
    var params: [len]std.builtin.Type.Fn.Param = undefined;
    inline for (func_info.params[0..len], 0..) |param, i| {
        params[i] = param;
    }
    const RT = func_info.return_type.?;
    const NewRT = switch (@typeInfo(RT)) {
        .error_union => |eu| eu.payload,
        else => RT,
    };
    return @Type(.{
        .@"fn" = .{
            .calling_convention = .c,
            .is_generic = false,
            .is_var_args = func_info.is_var_args,
            .params = &params,
            .return_type = NewRT,
        },
    });
}

pub fn exportTs(comptime func: anytype) TsExport(func) {
    const PhpFnT = TsExport(func);
    const PhpArgs = std.meta.ArgsTuple(PhpFnT);
    const FnT = @TypeOf(func);
    const Args = std.meta.ArgsTuple(FnT);
    const RT = @typeInfo(FnT).@"fn".return_type.?;
    const PhpRT = @typeInfo(PhpFnT).@"fn".return_type.?;
    const ns = struct {
        fn call(php_args: PhpArgs) PhpRT {
            var args: Args = undefined;
            inline for (php_args, 0..) |php_arg, i| {
                args[i] = php_arg;
            }
            if (!use_tsrm) {
                // add dummy context
                args[args.len - 1] = .{};
            }
            const retval = @call(.auto, func, args);
            return switch (@typeInfo(RT)) {
                .error_union => |eu| retval catch |err| report: {
                    php_h.php_error(php_h.E_ERROR, "Zig error: {s}", @as([:0]const u8, @errorName(err)));
                    break :report switch (eu.child) {
                        bool => false,
                        void => {},
                        else => @compileError("Unknown return type"),
                    };
                },
                else => retval,
            };
        }
    };
    return fn_transform.spreadArgs(ns.call, .c);
}

pub fn createBool(b: bool) Value {
    var result: Value = undefined;
    result.u1.type_info = if (b) IS_TRUE else IS_FALSE;
    return result;
}

pub fn createLong(l: i64) Value {
    var result: Value = undefined;
    result.value.lval = l;
    result.u1.type_info = IS_LONG;
    return result;
}

pub fn createDouble(d: f64) Value {
    var result: Value = undefined;
    result.value.dval = d;
    result.u1.type_info = IS_DOUBLE;
    return result;
}

pub fn createString(s: []const u8) Value {
    var result: Value = undefined;
    result.value.str = if (s.len > 1) alloc: {
        const zs = php_h.zend_string_alloc(s.len, false);
        const ds: [*]u8 = @ptrCast(&zs.*.val[0]);
        @memcpy(ds[0..s.len], s);
        ds[s.len] = '\x00';
        break :alloc zs;
    } else if (s.len == 1)
        php_h.zend_one_char_string[s[0]]
    else
        php_h.zend_empty_string;
    result.u1.type_info = IS_STRING;
    return result;
}
