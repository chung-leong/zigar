const std = @import("std");
const builtin = @import("builtin");

const CallDispatcher = @import("dispatch.zig").CallDispatcher;
const dyn_lib = @import("dyn-lib.zig");
const failure_og = @import("failure.zig");
const getSharedLibraryPath = @import("compilation.zig").getSharedLibraryPath;
const ModuleHost = @import("host.zig").ModuleHost;
const Options = @import("options.zig").Options;
const php = @import("php.zig");
const php_ng = @import("php/root.zig");
const php_al = php_ng.allocator;
const Array = php_ng.Array;
const Callable = php_ng.Callable;
const Dictionary = php_ng.Dictionary;
const Function = php_ng.Function;
const InfoTable = php_ng.InfoTable;
const Module = php_ng.Module;
const Value = php_ng.Value;
const structure = @import("structure.zig");
const system = @import("system.zig");
const io = system.io;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;
const ZigCompiler = @import("compilation.zig").ZigCompiler;

pub fn zigar_compile(args: struct {
    src_path: []const u8,
    mod_path: ?[]const u8,
    params: ?Dictionary,
}) !bool {
    if (!options.recompile) return false;
    const src_path = try createResolvedPath(php_al, args.src_path);
    defer php_al.free(src_path);
    const mod_path = if (args.mod_path) |path|
        try createResolvedPath(php_al, path)
    else
        try deriveModulePath(php_al, src_path);
    defer php_al.free(mod_path);
    try ZigCompiler.compile(src_path, mod_path, args.params);
    return true;
}

pub fn zigar_use(args: struct {
    src_path: []const u8,
    params: ?Dictionary,
}) !Value {
    const src_path, const mod_path = get: {
        const path = try createResolvedPath(php_al, args.src_path);
        errdefer php_al.free(path);
        var dir = std.Io.Dir.openDirAbsolute(io, path, .{}) catch |err| {
            if (err != error.NotDir) return err;
            const mod_path = try deriveModulePath(php_al, path);
            break :get .{ path, mod_path };
        };
        dir.close(io);
        break :get .{ null, path };
    };
    defer if (src_path) |path| php_al.free(path);
    defer php_al.free(mod_path);
    if (src_path) |path| {
        if (options.recompile) try ZigCompiler.compile(path, mod_path, args.params);
    }
    const so_path = try getSharedLibraryPath(php_al, mod_path, .this, .this);
    defer php_al.free(so_path);
    var result = try ModuleHost.load(so_path);
    return @as(*Value, @ptrCast(&result)).*;
}

pub fn zigar_import(args: struct {
    src_path: []const u8,
    callback: ?Callable,
    params: ?Dictionary,
}) !Value {
    const src_path, const mod_path = get: {
        const path = try createResolvedPath(php_al, args.src_path);
        errdefer php_al.free(path);
        var dir = std.Io.Dir.openDirAbsolute(io, path, .{}) catch |err| {
            if (err != error.NotDir) return err;
            const mod_path = try deriveModulePath(php_al, path);
            break :get .{ path, mod_path };
        };
        dir.close(io);
        break :get .{ null, path };
    };
    defer if (src_path) |path| php_al.free(path);
    defer php_al.free(mod_path);
    if (src_path) |path| {
        if (options.recompile) try ZigCompiler.compile(path, mod_path, args.params);
    }
    const so_path = try getSharedLibraryPath(php_al, mod_path, .this, .this);
    defer php_al.free(so_path);
    const root_og = try ModuleHost.load(so_path);
    // export symbols from root namespace
    const root_class = try ZigClassEntry.fromValue(&root_og);
    const root_static = root_class.getStaticData(structure.Struct);
    // the method return a list of names, which we don't keep here
    const callback_og = if (args.callback) |cb| &cb.value.impl else null;
    const list = try root_static.exportSymbolsToGlobalNamespace(callback_og);
    php.release(&list);
    return @as(*const Value, @ptrCast(&root_og)).*;
}

pub fn onModuleStartup(module_number: c_int) !void {
    dyn_lib.fixEnvironment();
    system.init();
    try Options.setup(module_number);
    try ModuleHost.setup();
    options = .init();
    if (php_ng.use_tsrm) {
        options_set = true;
        default_options = &options;
    }
}

pub fn onModuleShutdown(module_number: c_int) void {
    ModuleHost.shutdown();
    Options.shutdown(module_number);
}

pub fn onRequestStartup() !void {
    if (php_ng.use_tsrm and !options_set) {
        options = default_options.*;
        options_set = true;
    }
    try CallDispatcher.installHandler();
}

pub fn onRequestShutdown() void {
    CallDispatcher.event_loop.reset();
    shutdown_callbacks.call();
    // free any unclaimed message (just in case)
    failure_og.clearMessage();
    php_ng.failure.clearMessage();
}

pub fn onInfoRequest(module: *Module) void {
    var tbl: InfoTable = .init();
    tbl.addTwoColumns("Version", module.version());
    tbl.addTwoColumns("Extension optimization level", @tagName(builtin.mode));
    if (builtin.target.zigTriple(php_al) catch null) |target| {
        defer php_al.free(target);
        if (php_al.dupeSentinel(u8, target, 0) catch null) |cstr| {
            defer php_al.free(cstr);
            tbl.addTwoColumns("Extension compilation target", cstr);
        }
    }
    tbl.addTwoColumns("Zig compiler version", builtin.zig_version_string);
    tbl.end();
    module.displayIniEntries();
}

fn deriveModulePath(allocator: std.mem.Allocator, src_path: []const u8) ![]const u8 {
    const src_dir = std.fs.path.dirname(src_path) orelse "";
    const src_name = std.fs.path.stem(src_path);
    const mod_filename = try std.fmt.allocPrint(allocator, "{s}.zigar", .{src_name});
    const mod_rel_path = std.mem.sliceTo(options.module_rel_path, 0);
    defer php_al.free(mod_filename);
    return try std.fs.path.resolve(php_al, &.{ src_dir, mod_rel_path, mod_filename });
}

fn createResolvedPath(allocator: std.mem.Allocator, path: []const u8) ![]const u8 {
    const cwd_path = try std.process.currentPathAlloc(io, allocator);
    defer php_al.free(cwd_path);
    return try std.fs.path.resolve(allocator, &.{ cwd_path, path });
}

const ShutdownCallbacks = struct {
    pub fn add(self: *@This(), ptr: *anyopaque, fn_ptr: *const fn (*anyopaque) void) !void {
        try self.list.append(php_al, .{ .ptr = ptr, .fn_ptr = fn_ptr });
    }

    pub fn remove(self: *@This(), ptr: *anyopaque, fn_ptr: *const fn (*anyopaque) void) void {
        for (self.list.items, 0..) |item, index| {
            if (item.ptr == ptr and item.fn_ptr == fn_ptr) {
                _ = self.list.orderedRemove(index);
                break;
            }
        }
    }

    pub fn call(self: *@This()) void {
        for (self.list.items) |cb| cb.fn_ptr(cb.ptr);
        self.list.clearAndFree(php_al);
    }

    const Callback = struct {
        ptr: *anyopaque,
        fn_ptr: *const fn (*anyopaque) void,
    };

    list: std.ArrayList(Callback) = .empty,
};

pub threadlocal var shutdown_callbacks: ShutdownCallbacks = .{};

pub threadlocal var options: Options = undefined;
var default_options = switch (php_ng.use_tsrm) {
    true => @as(*Options, undefined),
    false => {},
};
pub threadlocal var options_set = switch (php_ng.use_tsrm) {
    true => false,
    false => {},
};
