const std = @import("std");
const builtin = @import("builtin");

const CallDispatcher = @import("dispatch.zig").CallDispatcher;
const getSharedLibraryName = @import("compilation.zig").getSharedLibraryName;
const ModuleHost = @import("host.zig").ModuleHost;
const php = @import("php.zig");
const ArgInfo = php.ArgInfo;
const FunctionInfo = php.FunctionInfo;
const ExecuteData = php.ExecuteData;
const FunctionEntry = php.FunctionEntry;
const ModuleEntry = php.ModuleEntry;
const String = php.String;
const Value = php.Value;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigCompiler = @import("compilation.zig").ZigCompiler;

export fn php_zigar_init(_: c_int, _: c_int) php.Result {
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
    CallDispatcher.installHandler();
    return php.SUCCESS;
}

export fn php_zigar_shutdown(_: c_int, _: c_int) php.Result {
    CallDispatcher.uninstallHandler();
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

        pub fn run(_: *ExecuteData, return_value: *Value) !void {
            const al = php.allocator;
            var module_path: *String = undefined;
            try php.parseArguments("S", .{&module_path});
            const so_name = try getSharedLibraryName(al, .this, .this);
            defer al.free(so_name);
            const cwd_path = try std.process.getCwdAlloc(al);
            defer php.allocator.free(cwd_path);
            const so_path = try std.fs.path.resolve(al, &.{
                cwd_path,
                php.getStringContent(module_path),
                so_name,
            });
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

        pub fn run(_: *ExecuteData, _: *Value) !void {
            const al = php.allocator;
            var source_path: *String = undefined;
            var module_path: *String = undefined;
            var options: ?*Value = null;
            try php.parseArguments("PP|A", .{ &source_path, &module_path, &options });
            const cwd_path = try std.process.getCwdAlloc(al);
            defer php.allocator.free(cwd_path);
            const source_path_resolved = try std.fs.path.resolve(al, &.{
                cwd_path,
                php.getStringContent(source_path),
            });
            defer php.allocator.free(source_path_resolved);
            const module_path_resolved = try std.fs.path.resolve(al, &.{
                cwd_path,
                php.getStringContent(module_path),
            });
            defer php.allocator.free(module_path_resolved);
            try ZigCompiler.compile(source_path_resolved, module_path_resolved, options);
        }
    };
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
