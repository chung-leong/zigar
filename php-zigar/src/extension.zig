const std = @import("std");
const builtin = @import("builtin");

const AbortSignal = @import("abort-signal.zig").AbortSignal;
const CallDispatcher = @import("dispatch.zig").CallDispatcher;
const failure = @import("failure.zig");
const fixEnvironment = @import("dyn-lib.zig").fixEnvironment;
const getSharedLibraryPath = @import("compilation.zig").getSharedLibraryPath;
const js_compat = @import("js-compat.zig");
const ModuleHost = @import("host.zig").ModuleHost;
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const FunctionInfo = php.FunctionInfo;
const ExecuteData = php.ExecuteData;
const FunctionEntry = php.FunctionEntry;
const InteralArgInfo = php.InternalArgInfo;
const ModuleEntry = php.ModuleEntry;
const Long = php.Long;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("structure.zig");
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigCompiler = @import("compilation.zig").ZigCompiler;
const ZigException = @import("exception.zig").ZigException;

const ShutdownCallback = struct {
    ptr: *anyopaque,
    fn_ptr: *const fn (*anyopaque) void,
};

threadlocal var request_shutdown_callbacks: std.ArrayList(ShutdownCallback) = .empty;

pub fn DllMain(
    _: std.os.windows.HINSTANCE,
    _: std.os.windows.DWORD,
    _: std.os.windows.LPVOID,
) std.os.windows.BOOL {
    @import("php-win32-c.zig").link() catch return std.os.windows.FALSE;
    return std.os.windows.TRUE;
}

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
    fixEnvironment();
    registerIniEntries(module_number) catch return php.FAILURE;
    registerClasses() catch return php.FAILURE;
    return php.SUCCESS;
}

export fn php_zigar_mod_shutdown(_: c_int, module_number: c_int) php.Result {
    unregisterIniEntries(module_number);
    unregisterClasses();
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
    // free any unclaimed message (just in case)
    failure.clearMessage();
    return php.SUCCESS;
}

export fn php_zigar_info(module: *ModuleEntry) void {
    php.infoTableStart();
    php.infoTableRow(&.{ "Version", module.version });
    php.infoTableRow(&.{ "Extension optimization level", @tagName(builtin.mode) });
    if (builtin.target.zigTriple(php.allocator) catch null) |target| {
        defer php.allocator.free(target);
        if (php.allocator.dupeZ(u8, target) catch null) |cstr| {
            defer php.allocator.free(cstr);
            php.infoTableRow(&.{ "Extension compilation target", cstr });
        }
    }
    php.infoTableRow(&.{ "Zig compiler version", builtin.zig_version_string });
    php.infoTableEnd();
    php.displayIniEntries(module);
}

fn registerClasses() !void {
    try ZigClassEntry.registerRootClass();
    errdefer ZigClassEntry.unregisterRootClass();
    try ZigException.registerClass();
    errdefer ZigException.unregisterClass();
    try AbortSignal.registerClass();
    errdefer AbortSignal.unregisterClass();
    try js_compat.registerClasses();
    errdefer js_compat.registerClasses();
}

fn unregisterClasses() void {
    ZigClassEntry.unregisterRootClass();
    ZigException.unregisterClass();
    AbortSignal.unregisterClass();
    js_compat.unregisterClasses();
    CallDispatcher.uninstallHandlers();
}

const Options = extern struct {
    compilation: bool = true,
    module_rel_path: [*:0]const u8 = "../lib",
    event_loop: [*:0]const u8 = "temporary",
    zig_path: [*:0]const u8 = "zig",
    zig_args: [*:0]const u8 = "",
    build_dir: [*:0]const u8 = "",
    build_dir_size: php.Long = 4294967296,
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
    pub const zigar_compile = struct {
        pub const required = .{"src_path"};
        pub const optional = .{ "mod_path", "params" };
        pub const variadic = true;

        pub fn run(ed: *ExecuteData, retval: *Value) !void {
            var arg_iter = ArgumentIterator.init(ed);
            try arg_iter.verifyCount(required.len, required.len + optional.len, "zigar_compile");
            if (!options.compilation) {
                retval.* = php.createValueBool(false);
                return;
            }
            const src_path = try php.getValueStringContent(arg_iter.next().?);
            const mod_path, const params = get: {
                if (arg_iter.next()) |arg1| {
                    const arg1_type = php.getValueType(arg1);
                    if (arg_iter.len == 2 and (arg1_type == .array or arg1_type == .object)) {
                        const mod_path = try deriveModulePath(php.allocator, src_path);
                        const params = try php.getValueHashTable(arg1);
                        break :get .{ mod_path, params };
                    } else {
                        const mod_path = try getResolvedPath(php.allocator, arg1);
                        errdefer php.allocator.free(mod_path);
                        const params = if (arg_iter.next()) |arg2| try php.getValueHashTable(arg2) else null;
                        break :get .{ mod_path, params };
                    }
                } else {
                    const mod_path = try deriveModulePath(php.allocator, src_path);
                    break :get .{ mod_path, null };
                }
            };
            defer php.allocator.free(mod_path);
            try ZigCompiler.compile(src_path, mod_path, params);
            retval.* = php.createValueBool(true);
        }
    };
    pub const zigar_use = struct {
        pub const required = .{"src_path"};
        pub const optional = .{"params"};
        pub const variadic = true;

        pub fn run(ed: *ExecuteData, retval: *Value) !void {
            var arg_iter = ArgumentIterator.init(ed);
            try arg_iter.verifyCount(required.len, required.len + optional.len, "zigar_use");
            const src_path, const mod_path = get: {
                const path = try getResolvedPath(php.allocator, arg_iter.next().?);
                errdefer php.allocator.free(path);
                var dir = std.fs.openDirAbsolute(path, .{}) catch |err| {
                    if (err != error.NotDir) return err;
                    const mod_path = try deriveModulePath(php.allocator, path);
                    break :get .{ path, mod_path };
                };
                dir.close();
                break :get .{ null, path };
            };
            defer if (src_path) |path| php.allocator.free(path);
            defer php.allocator.free(mod_path);
            const params = if (arg_iter.next()) |arg1| try php.getValueHashTable(arg1) else null;
            if (src_path) |path| {
                if (options.compilation) try ZigCompiler.compile(path, mod_path, params);
            }
            const so_path = try getSharedLibraryPath(php.allocator, mod_path, .this, .this);
            defer php.allocator.free(so_path);
            retval.* = try ModuleHost.load(so_path);
        }
    };
    pub const zigar_import = struct {
        pub const required = .{"src_path"};
        pub const optional = .{ "callback", "params" };
        pub const variadic = true;

        pub fn run(ed: *ExecuteData, retval: *Value) !void {
            var arg_iter = ArgumentIterator.init(ed);
            try arg_iter.verifyCount(required.len, required.len + optional.len, "zigar_import");
            const src_path, const mod_path = get: {
                const path = try getResolvedPath(php.allocator, arg_iter.next().?);
                errdefer php.allocator.free(path);
                var dir = std.fs.openDirAbsolute(path, .{}) catch |err| {
                    if (err != error.NotDir) return err;
                    const mod_path = try deriveModulePath(php.allocator, path);
                    break :get .{ path, mod_path };
                };
                dir.close();
                break :get .{ null, path };
            };
            defer if (src_path) |path| php.allocator.free(path);
            defer php.allocator.free(mod_path);
            const callback = if (arg_iter.peek()) |arg1| get: {
                if (arg_iter.named_params) |*named_params| {
                    if (arg1 == named_params) {
                        // obviously meant to be params
                        break :get null;
                    }
                }
                if (arg_iter.len == 2) {
                    switch (php.getValueType(arg1)) {
                        .object, .array => {
                            // if the argument isn't callable, then it's meant to be params
                            if (!php.isCallable(arg1)) {
                                break :get null;
                            }
                        },
                        else => {},
                    }
                }
                break :get arg_iter.next();
            } else null;
            const params = if (arg_iter.next()) |arg2| try php.getValueHashTable(arg2) else null;
            if (src_path) |path| {
                if (options.compilation) try ZigCompiler.compile(path, mod_path, params);
            }
            const so_path = try getSharedLibraryPath(php.allocator, mod_path, .this, .this);
            defer php.allocator.free(so_path);
            const root = try ModuleHost.load(so_path);
            retval.* = root;
            // export symbols from root namespace
            const root_class = try ZigClassEntry.fromValue(&root);
            const root_static = root_class.getStaticData(structure.Struct);
            // the method return a list of names, which we don't keep here
            const list = try root_static.exportSymbolsToGlobalNamespace(callback);
            php.release(&list);
        }
    };

    fn deriveModulePath(allocator: std.mem.Allocator, src_path: []const u8) ![]const u8 {
        const src_dir = std.fs.path.dirname(src_path) orelse "";
        const src_name = std.fs.path.stem(src_path);
        const mod_filename = try std.fmt.allocPrint(allocator, "{s}.zigar", .{src_name});
        const mod_rel_path = std.mem.sliceTo(options.module_rel_path, 0);
        defer php.allocator.free(mod_filename);
        return try std.fs.path.resolve(php.allocator, &.{ src_dir, mod_rel_path, mod_filename });
    }

    fn getResolvedPath(allocator: std.mem.Allocator, value: *Value) ![]const u8 {
        const path = try php.getValueStringContent(value);
        const cwd_path = try std.process.getCwdAlloc(allocator);
        defer php.allocator.free(cwd_path);
        return try std.fs.path.resolve(allocator, &.{ cwd_path, path });
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
            var len = function.required.len + function.optional.len;
            if (function.variadic) len += 1;
            var buffer: [1 + len]InteralArgInfo = undefined;
            for (&buffer, 0..) |*ptr, j| {
                if (j == 0) {
                    // the first array entry is actually used to store a FuntionInfo
                    const info_ptr: *FunctionInfo = @ptrCast(ptr);
                    info_ptr.* = .{ .required_num_args = function.required.len };
                } else if (j < 1 + function.required.len) {
                    ptr.* = .{ .name = function.required[j - 1] };
                } else if (j < 1 + function.required.len + function.optional.len) {
                    ptr.* = .{ .name = function.optional[j - function.required.len - 1] };
                } else {
                    ptr.* = .{ .name = "" };
                }
            }
            break :init buffer;
        };
        var flags = php.c.ZEND_ACC_PUBLIC;
        if (function.variadic) flags |= php.c.ZEND_ACC_VARIADIC;
        entries[i] = .{
            .fname = decl.name,
            .handler = &handler,
            .arg_info = @ptrCast(&arg_info),
            .num_args = function.required.len + function.optional.len,
            .flags = flags,
        };
    }
    entries[decls.len] = std.mem.zeroes(FunctionEntry);
    const const_entries = entries;
    @export(&const_entries, .{ .name = "php_zigar_functions" });
}

pub threadlocal var options: Options = .{};
pub var ini_entries: [std.meta.fields(Options).len]php.IniEntryDef = undefined;

fn registerIniEntries(module_number: c_int) !void {
    const fields = std.meta.fields(Options);
    inline for (fields, 0..) |field, index| {
        const name = "zigar." ++ field.name;
        const default_value: [*:0]const u8 = init: {
            switch (field.type) {
                bool => {
                    if (field.default_value_ptr) |ptr| {
                        const bool_ptr: *const bool = @ptrCast(ptr);
                        break :init if (bool_ptr.*) "On" else "Off";
                    }
                    break :init "";
                },
                Long => {
                    if (field.default_value_ptr) |ptr| {
                        const long_ptr: *const Long = @ptrCast(@alignCast(ptr));
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
                    Long => php.onUpdateLong,
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
