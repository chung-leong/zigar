const std = @import("std");

const php = @import("../root.zig");
const c = php.c;
const Allocator = php.Allocator;
const Function = php.Function;
const failure = php.failure;
const Module = php.Module;
const Singleton = php.Singleton;

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
                    .module_startup_func = @ptrCast(&onModuleStartup),
                    .module_shutdown_func = @ptrCast(&onModuleShutdown),
                    .request_startup_func = @ptrCast(&onRequestStartup),
                    .request_shutdown_func = @ptrCast(&onRequestShutdown),
                    .info_func = @ptrCast(&onInfoRequest),
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

        pub fn onModuleStartup(module_type: Module.Type, module_no: c_int) callconv(.c) c.zend_result {
            const singleton = Singleton(T);
            const init_result = singleton.init();
            if (failure.notice(init_result)) return c.FAILURE;
            if (@hasDecl(T, "onModuleStartup")) {
                const self = singleton.get();
                const result = T.onModuleStartup(self, module_type, module_no);
                if (failure.notice(result)) return c.FAILURE;
            }
            return c.SUCCESS;
        }

        pub fn onModuleShutdown(module_type: Module.Type, module_no: c_int) callconv(.c) c.zend_result {
            Allocator.mode = .persistent;
            const singleton = Singleton(T);
            if (@hasDecl(T, "onModuleShutdown")) {
                const self = singleton.get();
                const result = T.onModuleShutdown(self, module_type, module_no);
                if (failure.notice(result)) return c.FAILURE;
            }
            return c.SUCCESS;
        }

        pub fn onRequestStartup(module_type: Module.Type, module_no: c_int) callconv(.c) c.zend_result {
            Allocator.mode = .per_request;
            const singleton = Singleton(T);
            if (@hasDecl(T, "onRequestStartup")) {
                const self = singleton.get();
                const result = T.onRequestStartup(self, module_type, module_no);
                if (failure.notice(result)) return c.FAILURE;
            }
            return c.SUCCESS;
        }

        pub fn onRequestShutdown(module_type: Module.Type, module_no: c_int) callconv(.c) c.zend_result {
            const singleton = Singleton(T);
            defer singleton.reset();
            if (@hasDecl(T, "onRequestShutdown")) {
                const self = singleton.get();
                const result = T.onRequestShutdown(self, module_type, module_no);
                if (failure.notice(result)) return c.FAILURE;
            }
            return c.SUCCESS;
        }

        pub fn onInfoRequest(module: *Module) callconv(.c) void {
            Allocator.mode = .per_request;
            const singleton = Singleton(T);
            if (@hasDecl(T, "onInfoRequest")) {
                const self = singleton.get();
                const result = T.onInfoRequest(self, module);
                _ = failure.notice(result);
            }
        }

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

        fn getMethodName(decl_name: [:0]const u8) ?[:0]const u8 {
            const F = @TypeOf(@field(T, decl_name));
            if (@typeInfo(F) == .@"fn") {
                if (std.mem.eql(u8, decl_name[0..5], "call ")) return decl_name[5..];
            }
            return null;
        }

        entry: Module,
    };
}
