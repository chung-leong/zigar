const std = @import("std");
const builtin = @import("builtin");

pub const Arguments = @import("Function/Arguments.zig");
pub const CallCache = @import("Function/CallCache.zig");
pub const Closure = @import("Function/Closure.zig");
const php = @import("root.zig");
const Array = php.Array;
const c = php.c;
const pi = php.imports;
const Callable = php.Callable;
const Class = php.Class;
const Dictionary = php.Dictionary;
const efree = php.efree;
const failure = php.failure;
const unsupported = failure.unsupported;
const Object = php.Object;
const Resource = php.Resource;
const Singleton = php.Singleton;
const String = php.String;
const Value = php.Value;

pub fn getName(self: *const @This()) ?*String {
    const zstr = self.impl.common.function_name orelse return null;
    return @ptrCast(zstr);
}

pub fn createClosure(self: *const @This(), scope: ?*Class, called_scope: ?*Class, this: ?Value) Closure {
    return .create(self, scope, called_scope, this);
}

pub fn fromHandler(comptime func: anytype, comptime self_src: SelfSource) @This() {
    const handler_info = comptime handlerInfo(func, self_src);
    const arg_info = emptyArgInfo(handler_info.arguments.len, handler_info.is_variadic);
    const flags = c.ZEND_ACC_PUBLIC | switch (handler_info.is_variadic) {
        true => c.ZEND_ACC_VARIADIC,
        false => 0,
    };
    const name = String.static(extractName(func));
    return .{
        .impl = .{
            .internal_function = .{
                .type = c.ZEND_INTERNAL_FUNCTION,
                .function_name = @ptrCast(name),
                .handler = &zendInternalFunction(func, self_src),
                .num_args = handler_info.arguments.len,
                .required_num_args = handler_info.required_count,
                .arg_info = @constCast(arg_info.ptr),
                .fn_flags = flags,
            },
        },
    };
}

pub fn handlerType(comptime F: type, comptime self_src: SelfSource) HandlerType {
    const info = @typeInfo(F);
    if (info != .@"fn") @compileError("Function expected, received: " ++ @typeName(F));
    const AT = info.@"fn".param_types;
    const RT = info.@"fn".return_type.?;
    const PT = switch (@typeInfo(RT)) {
        .error_union => |eu| eu.payload,
        else => RT,
    };
    if (AT.len == 2 and AT[0] == *Arguments and AT[1] == *Value and PT == void) return .raw;
    if (AT.len == 1 and @typeInfo(AT[0].?) == .@"struct") return .handler;
    if (AT.len == 2 and self_src.match(AT[0].?)) {
        if (@typeInfo(AT[1].?) == .@"struct") return .method;
        @compileError("Improper method handler: " ++ @typeName(F));
    }
    @compileError("Improper function handler: " ++ @typeName(F));
}

pub fn handlerInfo(comptime func: anytype, comptime self_src: SelfSource) HandlerInfo {
    const F = @TypeOf(func);
    const handler_type = handlerType(F, self_src);
    const arg_names, const arg_types, const is_raw = switch (handler_type) {
        .raw => .{ &.{}, &.{}, true },
        .handler, .method => init: {
            const f = @typeInfo(F).@"fn";
            const AT = f.param_types;
            const offset = if (handler_type == .method) 1 else 0;
            const Struct = AT[offset].?;
            const st = @typeInfo(Struct).@"struct";
            break :init .{ st.field_names, st.field_types, false };
        },
    };
    const is_variadic = is_raw or check: {
        if (arg_types.len > 0) {
            // see if last argument is a dictionary
            const LT = arg_types[arg_types.len - 1];
            break :check LT == Dictionary or LT == ?Dictionary;
        }
        break :check false;
    };
    const arguments, const required_count = init: {
        var arguments: [arg_types.len]ArgumentInfo = undefined;
        var required_count: usize = 0;
        inline for (arg_names, 0..) |arg_name, i| {
            const required = switch (@typeInfo(arg_types[i])) {
                .optional => false,
                else => true,
            };
            if (required) required_count += 1;
            arguments[i] = .{
                .name = arg_name,
                .required = required,
            };
        }
        break :init .{ &arguments, required_count };
    };
    return .{
        .type = handler_type,
        .arguments = arguments,
        .required_count = required_count,
        .is_variadic = is_variadic,
    };
}

pub fn zendInternalFunction(comptime func: anytype, comptime self_src: SelfSource) Handler {
    const F = @TypeOf(func);
    const handler_type = handlerType(F, self_src);
    const f = @typeInfo(F).@"fn";
    const AT = f.param_types;
    const returning_error = @typeInfo(f.return_type.?) == .error_union;
    const ns = struct {
        pub fn handler(zed: [*c]c.zend_execute_data, zretval: [*c]c.zval) callconv(.c) void {
            const args: *Arguments = @ptrCast(zed);
            const retval: *Value = @ptrCast(zretval);
            var iter = args.iterate();
            if (iter.extract(AT[0].?)) |arg0| {
                const result = switch (returning_error) {
                    true => func(arg0) catch |err| return throw(err),
                    false => func(arg0),
                };
                retval.* = .fromAny(result);
            } else |err| throw(err);
        }

        pub fn method(zed: [*c]c.zend_execute_data, zretval: [*c]c.zval) callconv(.c) void {
            const php_args: *Arguments = @ptrCast(zed);
            const retval: *Value = @ptrCast(zretval);
            var iter = php_args.iterate();
            // use this variable as the first argument (i.e. self), which is going
            // a custom object
            const arg0 = switch (self_src) {
                .singleton => |T| Singleton(T).get(),
                .this => |T| get: {
                    switch (iter.this.kind()) {
                        .object => {
                            const this_obj = iter.this.object();
                            switch (T) {
                                Object => break :get this_obj,
                                else => break :get this_obj.toCustom(T),
                            }
                        },
                        .pointer => {
                            const ptr = iter.this.pointer();
                            break :get @as(*T, @ptrCast(@alignCast(ptr)));
                        },
                        else => return throw(error.NotObject),
                    }
                },
                .none => unreachable,
            };
            if (iter.extract(AT[1].?)) |arg1| {
                const result = switch (returning_error) {
                    true => func(arg0, arg1) catch |err| return throw(err),
                    false => func(arg0, arg1),
                };
                retval.* = .fromAny(result);
            } else |err| throw(err);
        }

        pub fn raw(zed: [*c]c.zend_execute_data, zretval: [*c]c.zval) callconv(.c) void {
            const args: *Arguments = @ptrCast(zed);
            const retval: *Value = @ptrCast(zretval);
            switch (returning_error) {
                true => func(args, retval) catch |err| return throw(err),
                false => func(args, retval),
            }
        }

        fn throw(err: anytype) void {
            // if an exception has already been thrown then don't do anything
            if (failure.match(err, error.ExceptionThrown)) return;
            const msg = failure.acquireMessage(err);
            defer failure.freeMessage(msg);
            _ = pi.zend_throw_exception_ex(
                null,
                0,
                "%s%s%s",
                exception_prefix.ptr,
                msg.ptr,
                exception_suffix.ptr,
            );
        }
    };
    return @field(ns, @tagName(handler_type));
}

pub fn extractName(comptime func: anytype) []const u8 {
    const ns = struct {
        pub fn Dummy(comptime arg: anytype) type {
            return struct {
                comptime x: @TypeOf(arg) = arg,
            };
        }
    };
    const name = @typeName(ns.Dummy(func));
    const si = std.mem.indexOfScalar(u8, name, '\'').?;
    const ei = std.mem.lastIndexOfScalar(u8, name, '\'').?;
    return name[si + 1 .. ei];
}

pub const HandlerInfo = struct {
    type: HandlerType,
    arguments: []ArgumentInfo,
    required_count: usize,
    is_variadic: bool,
};
pub const ArgumentInfo = struct {
    name: [:0]const u8,
    required: bool,
};
pub const HandlerType = enum { handler, raw, method };
pub const SelfSource = union(enum) {
    this: type,
    singleton: type,
    none: void,

    pub fn match(self: @This(), Arg0: type) bool {
        return switch (self) {
            inline .this, .singleton => |T| match: {
                if (@typeInfo(T) == .pointer) @compileError("Unexpected pointer");
                switch (@typeInfo(Arg0)) {
                    .pointer => |pt| break :match pt.child == T,
                    else => {
                        if (Arg0 == T) @compileError("self should be a pointer");
                        break :match false;
                    },
                }
            },
            .none => false,
        };
    }
};

pub var exception_prefix: [:0]const u8 = "";
pub var exception_suffix: [:0]const u8 = "";

fn emptyArgInfo(comptime count: usize, comptime is_variadic: bool) []const c.zend_internal_arg_info {
    const len = count + if (is_variadic) 1 else 0;
    const rem = @rem(len, 8);
    if (rem > 0) {
        // reuse the same list if the number of arguments is less than 8
        const larger = emptyArgInfo(len + (8 - rem), false);
        return larger[0..len];
    } else {
        const ns = struct {
            const array = init: {
                var buffer: [len]c.zend_internal_arg_info = undefined;
                if (c.zend_internal_function == c.zend_arg_info) {
                    for (&buffer) |*ptr| ptr.* = .{ .name = String.static("") }; // 8.6
                } else {
                    for (&buffer) |*ptr| ptr.* = .{ .name = "" };
                }
                break :init buffer;
            };
        };
        return &ns.array;
    }
}

const StdHandler = fn ([*c]c.zend_execute_data, [*c]c.zval) callconv(.c) void;
const Handler = switch (builtin.target.os.tag) {
    .windows => init: {
        // handler uses fastcall
        const f = @typeInfo(StdHandler).@"fn";
        break :init @Fn(f.param_types, f.param_attrs, f.return_type.?, .{
            .@"callconv" = switch (builtin.target.cpu.arch) {
                .x86_64 => .{ .x86_64_vectorcall = .{} },
                .x86 => .{ .x86_vectorcall = .{} },
                else => .c,
            },
        });
    },
    else => StdHandler,
};
const Function = @This();

impl: c.zend_function,
