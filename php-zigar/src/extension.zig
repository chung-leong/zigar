const std = @import("std");
const builtin = @import("builtin");

const CallDispatcher = @import("dispatch.zig").CallDispatcher;
const dyn_lib = @import("dyn-lib.zig");
const failure = @import("failure.zig");
const getSharedLibraryPath = @import("compilation.zig").getSharedLibraryPath;
const ModuleHost = @import("host.zig").ModuleHost;
const Options = @import("options.zig").Options;
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const FunctionInfo = php.FunctionInfo;
const ExecuteData = php.ExecuteData;
const FunctionEntry = php.FunctionEntry;
const InternalArgInfo = php.InternalArgInfo;
const ModuleEntry = php.ModuleEntry;
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
    dyn_lib.fixEnvironment();
    Options.setup(module_number) catch return php.FAILURE;
    ModuleHost.setup() catch return php.FAILURE;
    options = .init();
    if (php.use_tsrm) {
        options_set = true;
        default_options = &options;
    }
    return php.SUCCESS;
}

export fn php_zigar_mod_shutdown(_: c_int, module_number: c_int) php.Result {
    ModuleHost.shutdown();
    Options.shutdown(module_number);
    return php.SUCCESS;
}

export fn php_zigar_req_init(_: c_int, _: c_int) php.Result {
    if (php.use_tsrm and !options_set) {
        options = default_options.*;
        options_set = true;
    }
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

pub threadlocal var options: Options = undefined;
var default_options = switch (php.use_tsrm) {
    true => @as(*Options, undefined),
    false => {},
};
pub threadlocal var options_set = switch (php.use_tsrm) {
    true => false,
    false => {},
};

const functions = struct {
    pub const zigar_compile = struct {
        pub const required = .{"src_path"};
        pub const optional = .{ "mod_path", "params" };
        pub const variadic = true;

        pub fn run(ed: *ExecuteData, retval: *Value) !void {
            var arg_iter = ArgumentIterator.init(ed);
            try arg_iter.verifyCount(required.len, required.len + optional.len, "zigar_compile");
            if (!options.recompile) {
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
                if (options.recompile) try ZigCompiler.compile(path, mod_path, params);
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
                if (options.recompile) try ZigCompiler.compile(path, mod_path, params);
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

// this section exports the function table as "php_zigar_functions"
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
            var buffer: [1 + len]InternalArgInfo = undefined;
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
