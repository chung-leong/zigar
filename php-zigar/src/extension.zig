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
const structure = @import("structure.zig");
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigCompiler = @import("compilation.zig").ZigCompiler;

const ShutdownCallback = struct {
    ptr: *anyopaque,
    fn_ptr: *const fn (*anyopaque) void,
};

threadlocal var request_shutdown_callbacks: std.ArrayList(ShutdownCallback) = .empty;

pub fn addRequestShutdownCallback(ptr: *anyopaque, fn_ptr: *const fn (*anyopaque) void) !void {
    try request_shutdown_callbacks.append(php.allocator, .{ .ptr = ptr, .fn_ptr = fn_ptr });
}

pub fn removeRequestShutdownCallback(ptr: *anyopaque, fn_ptr: *const fn (*anyopaque) void) void {
    for (request_shutdown_callbacks.items, 0..) |item, index| {
        if (item.ptr == ptr and item.fn_ptr == fn_ptr) {
            _ = request_shutdown_callbacks.swapRemove(index);
            break;
        }
    }
}

export fn php_zigar_mod_init(_: c_int, module_number: c_int) php.Result {
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
    registerIniEntries(module_number) catch return php.FAILURE;
    js_compat.registerClasses() catch return php.FAILURE;
    errdefer js_compat.registerClasses();
    ZigClassEntry.registerGlobalClasses() catch return php.FAILURE;
    return php.SUCCESS;
}

export fn php_zigar_mod_shutdown(_: c_int, module_number: c_int) php.Result {
    unregisterIniEntries(module_number);
    js_compat.unregisterClasses();
    ZigClassEntry.unregisterGlobalClasses();
    CallDispatcher.uninstallHandlers();
    return php.SUCCESS;
}

export fn php_zigar_req_init(_: c_int, _: c_int) php.Result {
    CallDispatcher.installHandler() catch return php.FAILURE;
    return php.SUCCESS;
}

export fn php_zigar_req_shutdown(_: c_int, _: c_int) php.Result {
    CallDispatcher.event_loop.reset();
    for (request_shutdown_callbacks.items) |cb| cb.fn_ptr(cb.ptr);
    request_shutdown_callbacks.clearAndFree(php.allocator);
    return php.SUCCESS;
}

export fn php_zigar_info(_: *ModuleEntry) void {
    php.infoTableStart();
    php.infoTableHeader(2, "PHP Zigar", "enabled");
    php.infoTableEnd();
}

const Options = extern struct {
    compilation: bool = true,
    module_rel_path: [*:0]const u8 = "../lib",
    event_loop: [*:0]const u8 = "temporary",
    zig_path: [*:0]const u8 = "zig",
    zig_args: [*:0]const u8 = "",
    build_dir: [*:0]const u8 = "",
    build_dir_size: c_long = 4294967296,
    optimize: [*:0]const u8 = "Debug",
    clean: bool = false,

    const modifiable = .{ .compilation = php.INI_SYSTEM };
    const on_modified = struct {
        fn event_loop(entry: *php.IniEntry, new_value: *String, arg1: ?*anyopaque, arg2: ?*anyopaque, arg3: ?*anyopaque, stage: c_int) c_int {
            const text = php.getStringContent(new_value);
            return if (CallDispatcher.event_loop.use(text))
                php.onUpdateString(entry, new_value, arg1, arg2, arg3, stage)
            else |_|
                php.FAILURE;
        }

        fn optimize(entry: *php.IniEntry, new_value: *String, arg1: ?*anyopaque, arg2: ?*anyopaque, arg3: ?*anyopaque, stage: c_int) c_int {
            const text = php.getStringContent(new_value);
            const found = inline for (.{ "Debug", "ReleaseSafe", "ReleaseSmall", "ReleaseFast" }) |name| {
                if (std.mem.eql(u8, name, text)) break true;
            } else false;
            return if (found)
                php.onUpdateString(entry, new_value, arg1, arg2, arg3, stage)
            else
                php.FAILURE;
        }
    };
};

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
            if (!options.compilation) {
                retval.* = php.createValueBool(false);
                return;
            }
            const arg0 = arg_iter.next().?;
            const src_path = try php.getValueStringContent(arg0);
            const arg1 = arg_iter.next().?;
            const mod_path = try php.getValueStringContent(arg1);
            const params = if (arg_iter.next()) |arg2| try php.getValueHashTable(arg2) else null;
            const cwd_path = try std.process.getCwdAlloc(al);
            defer php.allocator.free(cwd_path);
            const src_path_resolved = try std.fs.path.resolve(al, &.{ cwd_path, src_path });
            defer php.allocator.free(src_path_resolved);
            const mod_path_resolved = try std.fs.path.resolve(al, &.{ cwd_path, mod_path });
            defer php.allocator.free(mod_path_resolved);
            try ZigCompiler.compile(src_path_resolved, mod_path_resolved, params);
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
            const params = if (arg_iter.next()) |arg1| try php.getValueHashTable(arg1) else null;
            const cwd_path = try std.process.getCwdAlloc(al);
            defer php.allocator.free(cwd_path);
            const src_path_resolved = try std.fs.path.resolve(al, &.{ cwd_path, src_path });
            defer php.allocator.free(src_path_resolved);
            const src_dir = std.fs.path.dirname(src_path_resolved) orelse return error.Unexpected;
            const src_filename = std.fs.path.basename(src_path_resolved);
            const src_name = if (std.mem.lastIndexOfScalar(u8, src_filename, '.')) |index|
                src_filename[0..index]
            else
                src_filename;
            const mod_filename = try std.fmt.allocPrint(al, "{s}.zigar", .{src_name});
            const mod_rel_path = std.mem.sliceTo(options.module_rel_path, 0);
            defer php.allocator.free(mod_filename);
            const mod_path_resolved = try std.fs.path.resolve(al, &.{ src_dir, mod_rel_path, mod_filename });
            defer php.allocator.free(mod_path_resolved);
            if (options.compilation) {
                try ZigCompiler.compile(src_path_resolved, mod_path_resolved, params);
            }
            const so_name = try getSharedLibraryName(al, .this, .this);
            defer al.free(so_name);
            const so_path = try std.fs.path.resolve(al, &.{ mod_path_resolved, so_name });
            defer al.free(so_path);
            retval.* = try ModuleHost.load(so_path);
        }
    };
    pub const zigar_import = struct {
        pub const arg_info = [_]ArgInfo{
            .{
                .name = "source_path",
                .type = .{
                    .type_mask = php.MAY_BE_STRING,
                    .ptr = null,
                },
            },
            .{
                .name = "callback",
                .type = .{
                    .type_mask = php.MAY_BE_STRING | php.MAY_BE_OBJECT,
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
            const callback = arg_iter.next();
            const params = if (arg_iter.next()) |arg2| try php.getValueHashTable(arg2) else null;
            const cwd_path = try std.process.getCwdAlloc(al);
            defer php.allocator.free(cwd_path);
            const src_path_resolved = try std.fs.path.resolve(al, &.{ cwd_path, src_path });
            defer php.allocator.free(src_path_resolved);
            const src_dir = std.fs.path.dirname(src_path_resolved) orelse return error.Unexpected;
            const src_filename = std.fs.path.basename(src_path_resolved);
            const src_name = if (std.mem.lastIndexOfScalar(u8, src_filename, '.')) |index|
                src_filename[0..index]
            else
                src_filename;
            const mod_filename = try std.fmt.allocPrint(al, "{s}.zigar", .{src_name});
            const mod_rel_path = std.mem.sliceTo(options.module_rel_path, 0);
            defer php.allocator.free(mod_filename);
            const mod_path_resolved = try std.fs.path.resolve(al, &.{ src_dir, mod_rel_path, mod_filename });
            defer php.allocator.free(mod_path_resolved);
            if (options.compilation) {
                try ZigCompiler.compile(src_path_resolved, mod_path_resolved, params);
            }
            const so_name = try getSharedLibraryName(al, .this, .this);
            defer al.free(so_name);
            const so_path = try std.fs.path.resolve(al, &.{ mod_path_resolved, so_name });
            defer al.free(so_path);
            const root_value = try ModuleHost.load(so_path);
            retval.* = root_value;
            // export symbols from root namespace
            const root_obj = php.getValueObject(&root_value) catch unreachable;
            const root_class = ZigClassEntry.fromObject(root_obj);
            const root_static = root_class.getStaticData(structure.Struct);
            // the method return a list of names, which we don't keep here
            const list = try root_static.exportSymbolsToGlobalNamespace(callback);
            php.release(&list);
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

pub threadlocal var options: Options = .{};
pub threadlocal var ini_entries: [std.meta.fields(Options).len]php.IniEntryDef = undefined;

fn registerIniEntries(module_number: c_int) !void {
    const fields = std.meta.fields(Options);
    inline for (fields, 0..) |field, index| {
        const name = "zigar." ++ field.name;
        const default_value: [*:0]const u8 = init: {
            switch (field.type) {
                bool => {
                    if (field.default_value_ptr) |ptr| {
                        const bool_ptr: *const bool = @ptrCast(ptr);
                        if (bool_ptr.*) break :init "1";
                    }
                    break :init "";
                },
                c_long => {
                    if (field.default_value_ptr) |ptr| {
                        const long_ptr: *const c_long = @ptrCast(@alignCast(ptr));
                        break :init std.fmt.comptimePrint("{d}", .{long_ptr.*});
                    }
                    break :init "";
                },
                [*:0]const u8 => {
                    if (field.default_value_ptr) |ptr| {
                        const ptr_ptr: *const [*:0]const u8 = @ptrCast(@alignCast(ptr));
                        break :init ptr_ptr.*;
                    }
                    break :init "";
                },
                else => unreachable,
            }
        };
        ini_entries[index] = .{
            .name = name.ptr,
            .name_length = name.len,
            .value = default_value,
            .value_length = @intCast(std.mem.len(default_value)),
            .modifiable = switch (@hasField(@TypeOf(Options.modifiable), field.name)) {
                true => @field(Options.modifiable, field.name),
                false => php.INI_ALL,
            },
            .on_modify = switch (@hasDecl(Options.on_modified, field.name)) {
                true => php.transform(@field(Options.on_modified, field.name)),
                false => switch (field.type) {
                    bool => php.onUpdateBool,
                    c_long => php.onUpdateLong,
                    [*:0]const u8 => php.onUpdateString,
                    else => unreachable,
                },
            },
            .displayer = null,
            .mh_arg1 = @ptrFromInt(@offsetOf(Options, field.name)),
            .mh_arg2 = &options,
            .mh_arg3 = null,
        };
    }
    const result = php.registerIniEntries(&ini_entries, module_number);
    if (result != php.SUCCESS) return error.Failure;
}

fn unregisterIniEntries(module_number: c_int) void {
    php.unregisterIniEntries(module_number);
}
