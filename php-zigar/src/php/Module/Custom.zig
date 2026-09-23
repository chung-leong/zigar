const std = @import("std");

const php = @import("../root.zig");
const c = php.c;
const Function = php.Function;
const Module = php.Module;

pub fn @"fn"(comptime T: type) type {
    if (@typeInfo(T) != .@"struct") @compileError("Expected struct, received: " ++ @typeName(T));
    return struct {
        pub fn init(comptime options: Options) @This() {
            return .{
                .entry = .fromZendModuleEntry(.{
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
                    .functions = functionEntries(),
                    .module_startup_func = moduleHandler(.onModuleStartup, .life_cycle),
                    .module_shutdown_func = moduleHandler(.onModuleShutdown, .life_cycle),
                    .request_startup_func = moduleHandler(.onRequestStartup, .life_cycle),
                    .request_shutdown_func = moduleHandler(.onRequestShutdown, .life_cycle),
                    .info_func = moduleHandler(.onInfoRequest, .info),
                    .version = options.version.ptr,
                    .build_id = php.build_id,
                }),
            };
        }

        pub fn register(comptime self: *@This()) void {
            const export_ns = struct {
                pub fn getModule() callconv(.c) *c.zend_module_entry {
                    return @ptrCast(&self.entry);
                }
            };
            @export(&export_ns.getModule, .{ .name = "get_module" });
        }

        pub const Options = @import("Custom/Options.zig");

        fn functionEntries() [*]const c.zend_function_entry {
            const decl_names = @typeInfo(T).@"struct".decl_names;
            const entries = init: {
                // count available functions
                var count: usize = 0;
                inline for (decl_names) |decl_name| {
                    if (getMethodName(decl_name) != null) count += 1;
                    count += 1;
                }
                // create entries for them (extra entry for sentinel)
                var entries: [count + 1]c.zend_function_entry = undefined;
                var i: usize = 0;
                for (decl_names) |decl_name| {
                    const name = getMethodName(decl_name) orelse continue;
                    const func = @field(T, decl_name);
                    const self_src: Function.SelfSource = .{ .singleton = T };
                    const handler = Function.zendInternalFunction(func, self_src);
                    const handler_info = Function.handlerInfo(func, self_src);
                    const zarg_info = arg_info_init: {
                        const arg_count = 1 + handler_info.arguments.len + if (handler_info.is_variadic) 1 else 0;
                        var arg_entries: [arg_count]c.zend_internal_arg_info = undefined;
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
                        .fname = name,
                        .handler = &handler,
                        .arg_info = &zarg_info,
                        .num_args = handler_info.arguments.len,
                        .flags = flags,
                    };
                    i += 1;
                }
                // list is terminated by an empty entry
                entries[i] = std.mem.zeroes(c.zend_function_entry);
                break :init entries;
            };
            return &entries;
        }

        fn moduleHandler(handle_name: HandlerName, purpose: HandlerPurpose) *const switch (purpose) {
            .life_cycle => ModuleFunction,
            .info => InfoFunction,
        } {
            if (@typeInfo(T) != .@"struct") @compileError("Expected struct, received: " ++ @typeName(T));
            const func = switch (@hasDecl(T, @tagName(handle_name))) {
                true => @field(T, @tagName(handle_name)),
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
                                Module.Type => @enumFromInt(int),
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

        fn getMethodName(decl_name: [:0]const u8) ?[:0]const u8 {
            const F = @TypeOf(@field(T, decl_name));
            if (@typeInfo(F) == .@"fn") {
                if (std.mem.eql(u8, decl_name[0..5], "call ")) return decl_name[5..];
            }
            return null;
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

        entry: Module,
    };
}
