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

const ExtensionOptions = extern struct {
    disable_compilation: bool,
    module_relative_path: [*:0]u8,
};

extern fn get_options() *ExtensionOptions;

pub fn getOptions() *ExtensionOptions {
    return get_options();
}

const functions = struct {
    pub const zigar_load = struct {
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

        pub fn run(ed: *ExecuteData, retval: *Value) !void {
            const al = php.allocator;
            var arg_iter = ArgumentIterator.init(ed);
            if (arg_iter.len < 1 or arg_iter.len > 2) {
                return failure.reportArgCountMismatch("zigar_load", 1, 2, arg_iter.len);
            }
            const arg0 = arg_iter.next().?;
            const mod_path = try php.getValueStringContent(arg0);
            const so_name = try getSharedLibraryName(al, .this, .this);
            defer al.free(so_name);
            const cwd_path = try std.process.getCwdAlloc(al);
            defer php.allocator.free(cwd_path);
            const so_path = try std.fs.path.resolve(al, &.{ cwd_path, mod_path, so_name });
            defer al.free(so_path);
            retval.* = try ModuleHost.load(so_path);
        }
    };
    pub const zigar_compile = struct {
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

        pub fn run(ed: *ExecuteData, retval: *Value) !void {
            const al = php.allocator;
            var arg_iter = ArgumentIterator.init(ed);
            if (arg_iter.len < 2 or arg_iter.len > 3) {
                return failure.reportArgCountMismatch("zigar_compile", 2, 3, arg_iter.len);
            }
            const extension_options = getOptions();
            if (extension_options.disable_compilation) {
                retval.* = php.createValueBool(false);
                return;
            }
            const arg0 = arg_iter.next().?;
            const src_path = try php.getValueStringContent(arg0);
            const arg1 = arg_iter.next().?;
            const mod_path = try php.getValueStringContent(arg1);
            const options = if (arg_iter.next()) |arg2| try php.getValueHashTable(arg2) else null;
            const cwd_path = try std.process.getCwdAlloc(al);
            defer php.allocator.free(cwd_path);
            const src_path_resolved = try std.fs.path.resolve(al, &.{ cwd_path, src_path });
            defer php.allocator.free(src_path_resolved);
            const mod_path_resolved = try std.fs.path.resolve(al, &.{ cwd_path, mod_path });
            defer php.allocator.free(mod_path_resolved);
            try ZigCompiler.compile(src_path_resolved, mod_path_resolved, options);
            retval.* = php.createValueBool(true);
        }
    };
    pub const zigar_use = struct {
        pub const arg_info = [_]ArgInfo{
            .{
                .name = "source_path",
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
            .required_num_args = 1,
        };

        pub fn run(ed: *ExecuteData, retval: *Value) !void {
            const al = php.allocator;
            var arg_iter = ArgumentIterator.init(ed);
            if (arg_iter.len < 1 or arg_iter.len > 2) {
                return failure.reportArgCountMismatch("zigar_use", 1, 2, arg_iter.len);
            }
            const arg0 = arg_iter.next().?;
            const src_path = try php.getValueStringContent(arg0);
            const options = if (arg_iter.next()) |arg2| try php.getValueHashTable(arg2) else null;
            const cwd_path = try std.process.getCwdAlloc(al);
            defer php.allocator.free(cwd_path);
            const src_path_resolved = try std.fs.path.resolve(al, &.{ cwd_path, src_path });
            defer php.allocator.free(src_path_resolved);
            const extension_options = getOptions();
            const src_dir = std.fs.path.dirname(src_path_resolved) orelse return error.Unexpected;
            const src_filename = std.fs.path.basename(src_path_resolved);
            const src_name = if (std.mem.lastIndexOfScalar(u8, src_filename, '.')) |index|
                src_filename[0..index]
            else
                src_filename;
            const mod_filename = try std.fmt.allocPrint(al, "{s}.zigar", .{src_name});
            const mod_rel_path = std.mem.sliceTo(extension_options.module_relative_path, 0);
            defer php.allocator.free(mod_filename);
            const mod_path_resolved = try std.fs.path.resolve(al, &.{ src_dir, mod_rel_path, mod_filename });
            defer php.allocator.free(mod_path_resolved);
            if (!extension_options.disable_compilation) {
                try ZigCompiler.compile(src_path_resolved, mod_path_resolved, options);
            }
            const so_name = try getSharedLibraryName(al, .this, .this);
            defer al.free(so_name);
            const so_path = try std.fs.path.resolve(al, &.{ mod_path_resolved, so_name });
            defer al.free(so_path);
            retval.* = try ModuleHost.load(so_path);
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
                return failure.reportArgCountMismatch("zigar_event_loop", 1, 1, arg_iter.len);
            }
            const arg0 = arg_iter.next().?;
            const loop_type = try php.getValueStringContent(arg0);
            try CallDispatcher.event_loop.use(loop_type);
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
