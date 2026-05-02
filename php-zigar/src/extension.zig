const std = @import("std");
const builtin = @import("builtin");

const CallDispatcher = @import("dispatch.zig").CallDispatcher;
const failure = @import("failure.zig");
const getSharedLibraryName = @import("compilation.zig").getSharedLibraryName;
const js_compat = @import("js-compat.zig");
const ModuleHost = @import("host.zig").ModuleHost;
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ArgInfo = php.ArgInfo;
const FunctionInfo = php.FunctionInfo;
const ExecuteData = php.ExecuteData;
const FunctionEntry = php.FunctionEntry;
const ModuleEntry = php.ModuleEntry;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigCompiler = @import("compilation.zig").ZigCompiler;

export fn php_zigar_mod_init(_: c_int, _: c_int) php.Result {
    // fixed missing environ due to RTLD_DEEPBIND option to
    if (@intFromPtr(std.c.environ) == 0) {
        if (std.c.dlopen(null, .{ .LAZY = true, .NOLOAD = true })) |handle| {
            defer _ = std.c.dlclose(handle);
            if (std.c.dlsym(handle, "environ")) |symbol| {
                const environ_ptr: @TypeOf(&std.c.environ) = @ptrCast(@alignCast(symbol));
                std.c.environ = environ_ptr.*;
            }
        }
    }
    ZigClassEntry.registerGlobalClasses() catch return php.FAILURE;
    js_compat.registerClasses() catch return php.FAILURE;
    return php.SUCCESS;
}

export fn php_zigar_mod_shutdown(_: c_int, _: c_int) php.Result {
    CallDispatcher.uninstallHandlers();
    return php.SUCCESS;
}

export fn php_zigar_req_init(_: c_int, _: c_int) php.Result {
    CallDispatcher.installHandler() catch return php.FAILURE;
    return php.SUCCESS;
}

export fn php_zigar_req_shutdown(_: c_int, _: c_int) php.Result {
    CallDispatcher.event_loop.reset();
    return php.SUCCESS;
}

export fn php_zigar_info(_: *ModuleEntry) void {
    php.infoTableStart();
    php.infoTableHeader(2, "PHP Zigar", "enabled");
    php.infoTableEnd();
}

const functions = struct {
    pub const zigar_load_module = struct {
        pub const arg_info = [_]ArgInfo{
            .{
                .name = "path",
                .type = .{
                    .type_mask = php.MAY_BE_STRING,
                    .ptr = null,
                },
            },
        };
        pub const info = FunctionInfo{
            .required_num_args = 1,
        };

        pub fn run(ed: *ExecuteData, return_value: *Value) !void {
            const al = php.allocator;
            var arg_iter = ArgumentIterator.init(ed);
            if (arg_iter.len < 1 or arg_iter.len > 2) {
                return reportArgCountMismatch("zigar_load_module", 1, 2, arg_iter.len);
            }
            const mod_path = init: {
                var value = (try arg_iter.nextValue(.string)).?;
                break :init php.getValueStringContent(&value) catch unreachable;
            };
            const so_name = try getSharedLibraryName(al, .this, .this);
            defer al.free(so_name);
            const cwd_path = try std.process.getCwdAlloc(al);
            defer php.allocator.free(cwd_path);
            const so_path = try std.fs.path.resolve(al, &.{ cwd_path, mod_path, so_name });
            defer al.free(so_path);
            return_value.* = try ModuleHost.load(so_path);
        }
    };
    pub const zigar_compile_module = struct {
        pub const arg_info = [_]ArgInfo{
            .{
                .name = "source_path",
                .type = .{
                    .type_mask = php.MAY_BE_STRING,
                    .ptr = null,
                },
            },
            .{
                .name = "module_path",
                .type = .{
                    .type_mask = php.MAY_BE_STRING,
                    .ptr = null,
                },
            },
            .{
                .name = "options",
                .type = .{
                    .type_mask = php.MAY_BE_ARRAY,
                    .ptr = null,
                },
            },
        };
        pub const info = FunctionInfo{
            .required_num_args = 2,
        };

        pub fn run(ed: *ExecuteData, _: *Value) !void {
            const al = php.allocator;
            var arg_iter = ArgumentIterator.init(ed);
            if (arg_iter.len < 2 or arg_iter.len > 3) {
                return reportArgCountMismatch("zigar_compile_module", 2, 3, arg_iter.len);
            }
            const src_path = init: {
                var value = (try arg_iter.nextValue(.string)).?;
                break :init php.getValueStringContent(&value) catch unreachable;
            };
            const mod_path = init: {
                var value = (try arg_iter.nextValue(.string)).?;
                break :init php.getValueStringContent(&value) catch unreachable;
            };
            const options = init: {
                var value = (try arg_iter.nextValue(.object)) orelse break :init null;
                break :init php.getValueHashTable(&value) catch unreachable;
            };
            const cwd_path = try std.process.getCwdAlloc(al);
            defer php.allocator.free(cwd_path);
            const source_path_resolved = try std.fs.path.resolve(al, &.{ cwd_path, src_path });
            defer php.allocator.free(source_path_resolved);
            const module_path_resolved = try std.fs.path.resolve(al, &.{ cwd_path, mod_path });
            defer php.allocator.free(module_path_resolved);
            try ZigCompiler.compile(source_path_resolved, module_path_resolved, options);
        }
    };
    pub const zigar_event_loop = struct {
        pub const arg_info = [_]ArgInfo{
            .{
                .name = "value",
                .type = .{
                    .type_mask = php.MAY_BE_STRING,
                    .ptr = null,
                },
            },
        };
        pub const info = FunctionInfo{
            .required_num_args = 1,
        };

        pub fn run(ed: *ExecuteData, _: *Value) !void {
            var arg_iter = ArgumentIterator.init(ed);
            if (arg_iter.len != 1) {
                return reportArgCountMismatch("zigar_event_loop", 1, 1, arg_iter.len);
            }
            const loop_type = init: {
                var value = (try arg_iter.nextValue(.string)).?;
                break :init php.getValueStringContent(&value) catch unreachable;
            };
            try CallDispatcher.event_loop.use(loop_type);
        }
    };

    fn reportArgCountMismatch(fn_name: []const u8, max_arg_count: usize, min_arg_count: usize, arg_count: usize) error{Unexpected}!void {
        return failure.report("{s}() expects {s} {d} argument%s, {d} given", .{
            fn_name,
            if (max_arg_count > min_arg_count)
                "at most"
            else if (arg_count < min_arg_count)
                "at least"
            else
                "exactly",
            if (max_arg_count > min_arg_count)
                max_arg_count
            else
                min_arg_count,
            arg_count,
        });
    }
};

comptime {
    const decls = std.meta.declarations(functions);
    var entries: [decls.len + 1]FunctionEntry = undefined;
    for (decls, 0..) |decl, i| {
        const function = @field(functions, decl.name);
        const handler = php.transform(function.run);
        @export(&handler, .{ .name = decl.name });
        const arg_info = init: {
            var buf: [function.arg_info.len + 1]ArgInfo = undefined;
            const info_ptr: *FunctionInfo = @ptrCast(&buf[0]);
            info_ptr.* = function.info;
            for (function.arg_info, 0..) |a, j| buf[j + 1] = a;
            break :init buf;
        };
        entries[i] = .{
            .fname = decl.name,
            .handler = &handler,
            .arg_info = @ptrCast(&arg_info),
            .num_args = @truncate(function.arg_info.len),
            .flags = 0,
        };
    }
    entries[decls.len] = std.mem.zeroes(FunctionEntry);
    const const_entries = entries;
    @export(&const_entries, .{ .name = "php_zigar_functions" });
}
