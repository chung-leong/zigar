const std = @import("std");

const php = @import("root.zig");
const c = php.c;
const pi = php.imports;
const Function = php.Function;

pub fn name(self: *const @This()) [:0]const u8 {
    return std.mem.sliceTo(self.impl.name, 0);
}

pub fn version(self: *const @This()) [:0]const u8 {
    return std.mem.sliceTo(self.impl.version, 0);
}

pub fn init(comptime ns: type, comptime options: Options) @This() {
    return .{
        .impl = .{
            .size = @sizeOf(@This()),
            .zend_api = php.api_no,
            .zend_debug = if (php.debug) 1 else 0,
            .zts = if (php.use_tsrm) 1 else 0,
            .ini_entry = null,
            .deps = if (options.dependency) |list| init: {
                var deps: [list.len + 1]c.struct__zend_module_dep = undefined;
                for (list) |dep| {
                    deps = .{
                        .name = dep.name.ptr,
                        .rel = @tagName(dep.rel),
                        .version = dep.version.ptr,
                        .type = @intFromEnum(dep.type),
                    };
                }
                deps[list.len] = .{ .name = null };
                break :init &deps;
            } else null,
            .name = options.name.ptr,
            .functions = functionEntries(ns),
            .module_startup_func = moduleHandler(ns, .onModuleStartup, .life_cycle),
            .module_shutdown_func = moduleHandler(ns, .onModuleShutdown, .life_cycle),
            .request_startup_func = moduleHandler(ns, .onRequestStartup, .life_cycle),
            .request_shutdown_func = moduleHandler(ns, .onRequestShutdown, .life_cycle),
            .info_func = moduleHandler(ns, .onInfoRequest, .info),
            .version = options.version.ptr,
            .build_id = php.build_id,
        },
    };
}

pub fn @"export"(comptime self: *@This()) void {
    const export_ns = struct {
        pub fn getModule() callconv(.c) *c.zend_module_entry {
            return &self.impl;
        }
    };
    @export(&export_ns.getModule, .{ .name = "get_module" });
}

pub fn displayIniEntries(self: *const @This()) void {
    pi.display_ini_entries(@ptrCast(@constCast(self)));
}

pub const Type = enum(c_int) { persistent = 1, temporary = 2 };
pub const Options = struct {
    name: [:0]const u8,
    version: [:0]const u8,
    dependency: ?[]const Dependency = null,
};
pub const Dependency = struct {
    name: [:0]const u8,
    rel: enum { lt, le, eq, ge, gt },
    version: [:0]const u8,
    type: enum { required, conflicts, optional },
};

fn functionEntries(comptime ns: type) [*]const c.zend_function_entry {
    if (@typeInfo(ns) != .@"struct") @compileError("Expected struct, received: " ++ @typeName(ns));
    const decl_names = @typeInfo(ns).@"struct".decl_names;
    const entries = init: {
        // count available functions
        var len: usize = 0;
        inline for (decl_names) |decl_name| {
            const F = @TypeOf(@field(ns, decl_name));
            if (@typeInfo(F) != .@"fn") continue;
            if (@hasField(HandlerName, decl_name)) continue;
            len += 1;
        }
        // create entries for them
        var entries: [len + 1]c.zend_function_entry = undefined;
        var i: usize = 0;
        for (decl_names) |decl_name| {
            const F = @TypeOf(@field(ns, decl_name));
            if (@typeInfo(F) != .@"fn") continue;
            if (@hasField(HandlerName, decl_name)) continue;
            const func = @field(ns, decl_name);
            const handler = Function.handler(func, null);
            const handler_info = Function.getHandlerInfo(func, null);
            const zarg_info = arg_info_init: {
                const count = 1 + handler_info.arguments.len + if (handler_info.is_variadic) 1 else 0;
                var arg_entries: [count]c.zend_internal_arg_info = undefined;
                // the first array entry is used to store a zend_internal_function_info
                const fn_info_ptr: *c.zend_internal_function_info = @ptrCast(&arg_entries[0]);
                fn_info_ptr.* = .{ .required_num_args = handler_info.required_count };
                var j: usize = 1;
                for (handler_info.arguments) |a| {
                    arg_entries[j] = .{ .name = a.name };
                    j += 1;
                }
                if (handler_info.is_variadic) {
                    arg_entries[j] = .{ .name = "" };
                }
                break :arg_info_init arg_entries;
            };
            const flags = c.ZEND_ACC_PUBLIC | switch (handler_info.is_variadic) {
                true => c.ZEND_ACC_VARIADIC,
                false => 0,
            };
            entries[i] = .{
                .fname = decl_name,
                .handler = &handler,
                .arg_info = &zarg_info,
                .num_args = handler_info.arguments.len,
                .flags = flags,
            };
            i += 1;
        }
        entries[i] = std.mem.zeroes(c.zend_function_entry);
        break :init entries;
    };
    return &entries;
}

fn moduleHandler(comptime ns: type, handle_name: HandlerName, purpose: HandlerPurpose) *const switch (purpose) {
    .life_cycle => ModuleFunction,
    .info => InfoFunction,
} {
    if (@typeInfo(ns) != .@"struct") @compileError("Expected struct, received: " ++ @typeName(ns));
    const func = switch (@hasDecl(ns, @tagName(handle_name))) {
        true => @field(ns, @tagName(handle_name)),
        false => void,
    };
    const F = @TypeOf(func);
    const module_fn_ns = struct {
        pub fn life_cycle(int: c_int, module_no: c_int) callconv(.c) c.zend_result {
            if (@typeInfo(F) == .@"fn") {
                const f = @typeInfo(F).@"fn";
                var tuple: std.meta.ArgsTuple(F) = undefined;
                inline for (&tuple) |*arg_ptr| {
                    const Arg = @TypeOf(arg_ptr.*);
                    arg_ptr.* = switch (Arg) {
                        Type => @enumFromInt(int),
                        c_int => module_no,
                        else => @compileError("Unexpected argument type: " ++ @typeName(Arg)),
                    };
                }
                const RT = f.return_type.?;
                switch (@typeInfo(RT) == .error_union) {
                    true => _ = @call(.auto, func, tuple) catch return c.FAILURE,
                    false => @call(.auto, func, tuple),
                }
            }
            return c.SUCCESS;
        }

        pub fn info(zmod: [*c]c.zend_module_entry) callconv(.c) void {
            if (@typeInfo(F) == .@"fn") {
                const f = @typeInfo(F).@"fn";
                var tuple: std.meta.ArgsTuple(F) = undefined;
                inline for (&tuple) |*arg_ptr| {
                    const Arg = @TypeOf(arg_ptr.*);
                    arg_ptr.* = switch (Arg) {
                        *Module => @ptrCast(zmod),
                        else => @compileError("Unexpected argument type: " ++ @typeName(Arg)),
                    };
                }
                const RT = f.return_type.?;
                switch (@typeInfo(RT) == .error_union) {
                    true => _ = @call(.auto, func, tuple) catch {},
                    false => @call(.auto, func, tuple),
                }
            }
        }
    };
    return @field(module_fn_ns, @tagName(purpose));
}

const HandlerName = enum {
    onModuleStartup,
    onModuleShutdown,
    onRequestStartup,
    onRequestShutdown,
    onInfoRequest,
};
const HandlerPurpose = enum { life_cycle, info };
const ModuleFunction = fn (c_int, c_int) callconv(.c) c.zend_result;
const InfoFunction = fn ([*c]c.zend_module_entry) callconv(.c) void;
const Module = @This();

impl: c.zend_module_entry,
