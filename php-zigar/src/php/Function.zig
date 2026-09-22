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
const ClassEntry = php.ClassEntry;
const Dictionary = php.Dictionary;
const efree = php.efree;
const failure = php.failure;
const unsupported = failure.unsupported;
const Object = php.Object;
const Resource = php.Resource;
const String = php.String;
const Value = php.Value;

pub fn getName(self: *const @This()) ?*String {
    const zstr = self.impl.common.function_name orelse return null;
    return @ptrCast(zstr);
}

pub fn createClosure(self: *const @This(), scope: ?*ClassEntry, called_scope: ?*ClassEntry, this: ?Value) Closure {
    return .create(self, scope, called_scope, this);
}

pub fn fromHandler(comptime func: anytype, comptime this_type: ?type) @This() {
    const handler_info = comptime getHandlerInfo(func, this_type);
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
                .handler = &handler(func, this_type),
                .num_args = handler_info.arguments.len,
                .required_num_args = handler_info.required_count,
                .arg_info = @constCast(arg_info.ptr),
                .fn_flags = flags,
            },
        },
    };
}

pub fn getHandlerType(comptime F: type, comptime this_type: ?type) ?HandlerType {
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
    if (this_type) |This| {
        if (AT[0] == This and AT.len == 2 and @typeInfo(AT[1].?) == .@"struct") return .method;
    }
    return null;
}

pub fn getHandlerInfo(comptime func: anytype, comptime this_type: ?type) HandlerInfo {
    const F = @TypeOf(func);
    const handler_type = getHandlerType(F, this_type) orelse unrecognized(F, this_type);
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

pub fn handler(comptime func: anytype, comptime this_type: ?type) Handler {
    const F = @TypeOf(func);
    const handler_type = getHandlerType(F, this_type) orelse unrecognized(F, this_type);
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
            const Self = AT[0].?;
            const arg0: Self = switch (Self) {
                Value => iter.this,
                *Object => iter.this.getObject() catch |err| return throw(err),
                else => switch (iter.this.kind()) {
                    .object => get: {
                        const this_obj = php_args.this.object();
                        const this_obj_addr: usize = @intFromPtr(this_obj);
                        const offset = this_obj.impl.handlers.offset;
                        // TODO: check class entry
                        const struct_addr = this_obj_addr - offset;
                        break :get @ptrFromInt(struct_addr);
                    },
                    .pointer => @ptrCast(php_args.this.pointer()),
                },
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

fn unrecognized(comptime F: type, comptime this_type: ?type) noreturn {
    if (this_type) |_|
        @compileError("Improper method handler: " ++ @typeName(F))
    else
        @compileError("Improper function handler: " ++ @typeName(F));
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
