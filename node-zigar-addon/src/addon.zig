const std = @import("std");
const c_allocator = std.heap.c_allocator;
const E = std.os.wasi.errno_t;
const builtin = @import("builtin");

const fn_transform = @import("./extra/fn-transform.zig");
const hooks = @import("./extra/hooks.zig");
const interface = @import("./extra/interface.zig");
const napi = @import("./extra/napi.zig");
const Env = napi.Env;
const Value = napi.Value;
const Ref = napi.Ref;
const ThreadsafeFunction = napi.ThreadsafeFunction;
const redirect = @import("./redirect.zig");

comptime {
    napi.createAddon(ModuleHost.attachExports);
}

const ModuleHost = struct {
    pub const HookEntry = hooks.Entry;
    pub const Syscall = hooks.Syscall;
    pub const HandlerVTable = hooks.HandlerVTable;
    const redirection_controller = redirect.Controller(@This());

    ref_count: isize = 1,
    redirecting_io: bool = false,
    module: ?*Module = null,
    library: ?std.DynLib = null,
    base_address: usize = 0,
    env: Env,
    js: struct {
        create_view: ?Ref = null,
        create_instance: ?Ref = null,
        create_template: ?Ref = null,
        append_list: ?Ref = null,
        get_slot_value: ?Ref = null,
        set_slot_value: ?Ref = null,
        begin_structure: ?Ref = null,
        finish_structure: ?Ref = null,
        handle_jscall: ?Ref = null,
        release_function: ?Ref = null,

        fd_advise: ?Ref = null,
        fd_allocate: ?Ref = null,
        fd_close: ?Ref = null,
        fd_datasync: ?Ref = null,
        fd_fdstat_get: ?Ref = null,
        fd_fdstat_set_flags: ?Ref = null,
        fd_fdstat_set_rights: ?Ref = null,
        fd_filestat_get: ?Ref = null,
        fd_filestat_set_times: ?Ref = null,
        fd_lock_get: ?Ref = null,
        fd_lock_set: ?Ref = null,
        fd_pread: ?Ref = null,
        fd_pread1: ?Ref = null,
        fd_pwrite: ?Ref = null,
        fd_pwrite1: ?Ref = null,
        fd_read: ?Ref = null,
        fd_read1: ?Ref = null,
        fd_readdir: ?Ref = null,
        fd_seek: ?Ref = null,
        fd_sync: ?Ref = null,
        fd_tell: ?Ref = null,
        fd_write: ?Ref = null,
        fd_write1: ?Ref = null,
        path_access: ?Ref = null,
        path_create_directory: ?Ref = null,
        path_filestat_get: ?Ref = null,
        path_filestat_set_times: ?Ref = null,
        path_open: ?Ref = null,
        path_remove_directory: ?Ref = null,
        path_unlink_file: ?Ref = null,
    } = .{},
    ts: struct {
        disable_multithread: ?ThreadsafeFunction = null,
        handle_jscall: ?ThreadsafeFunction = null,
        handle_syscall: ?ThreadsafeFunction = null,
        release_function: ?ThreadsafeFunction = null,
    } = .{},
    multithread_count: std.atomic.Value(usize) = .init(0),
    redirection_mask: hooks.Mask = .{},
    syscall_trap_count: usize = 0,
    syscall_trap_mutex: std.Thread.Mutex = .{},
    syscall_trap_switches: std.ArrayList(*bool),

    pub threadlocal var instance: *@This() = undefined;
    pub threadlocal var in_main_thread: bool = undefined;
    pub threadlocal var trapping_syscalls: bool = false;

    var module_count: i32 = 0;
    var buffer_count: i32 = 0;
    var function_count: i32 = 0;

    const Module = interface.Module(Value);
    const Jscall = Module.Jscall;

    fn attachExports(env: Env, exports: Value) !void {
        inline for (.{ "createEnvironment", "getGCStatistics" }) |name| {
            const func = @field(@This(), name);
            try env.setNamedProperty(exports, name, try env.createCallback(name, func, false, null));
        }
        try env.addEnvCleanupHook(cleanup, null);
        redirection_controller.installSignalHandler() catch {};
    }

    fn cleanup(_: ?*anyopaque) callconv(.c) void {
        redirection_controller.uninstallSyscallTrap();
        redirection_controller.uninstallSignalHandler();
    }

    fn createEnvironment(env: Env) !Value {
        // compile embedded JavaScript
        const js_module = try compileJavaScript(env);
        // look for the Environment class
        const create_env = try env.getNamedProperty(js_module, "createEnvironment");
        // create the environment
        const js_env = try env.callFunction(try env.getNull(), create_env, &.{});
        const self = try createSelf(env);
        defer self.release();
        try self.setThreadContext(true);
        // import functions from the environment
        try self.importFunctionsFromJavaScript(js_env);
        // export functions to it; exported functions will keep self alive until they're all
        // garbage collected
        try self.exportFunctionsToJavaScript(js_env);
        return js_env;
    }

    fn getGCStatistics(env: Env) !Value {
        const stats = try env.createObject();
        try env.setNamedProperty(stats, "modules", try env.createInt32(module_count));
        try env.setNamedProperty(stats, "functions", try env.createInt32(function_count));
        try env.setNamedProperty(stats, "buffers", try env.createInt32(buffer_count));
        return stats;
    }

    fn compileJavaScript(env: Env) !Value {
        const js_file_name = switch (@bitSizeOf(usize)) {
            64 => "addon.64b.js.gz",
            32 => "addon.32b.js.gz",
            else => unreachable,
        };
        // decompress JS
        var input: std.io.FixedBufferStream([]const u8) = .{
            .buffer = @embedFile(js_file_name),
            .pos = 0,
        };
        var buffer: [512 * 1024]u8 = undefined;
        var output: std.io.FixedBufferStream([]u8) = .{
            .buffer = &buffer,
            .pos = 0,
        };
        try std.compress.gzip.decompress(input.reader(), output.writer());
        const end_index: usize = @truncate(try output.getPos());
        const js_bytes = buffer[0..end_index];
        const js_str = try env.createStringUtf8(js_bytes);
        return try env.runScript(js_str);
    }

    fn createSelf(env: Env) !*@This() {
        const self = try c_allocator.create(@This());
        self.* = .{
            .env = env,
            .syscall_trap_switches = .init(c_allocator),
        };
        instance = self;
        return self;
    }

    fn addRef(self: *@This()) void {
        self.ref_count += 1;
    }

    fn release(self: *@This()) void {
        self.ref_count -= 1;
        if (self.ref_count == 0) {
            const env = self.env;
            inline for (comptime std.meta.fields(@FieldType(ModuleHost, "js"))) |field| {
                if (@field(self.js, field.name)) |ref| {
                    env.deleteReference(ref) catch {};
                }
            }
            if (self.library) |*lib| lib.close();
            self.syscall_trap_switches.deinit();
            c_allocator.destroy(self);
            module_count -= 1;
        }
    }

    fn importFunctionsFromJavaScript(self: *@This(), js_env: Value) !void {
        const env = self.env;
        const export_fn = try env.getNamedProperty(js_env, "exportFunctions");
        const exports = try env.callFunction(js_env, export_fn, &.{});
        inline for (comptime std.meta.fields(@FieldType(@This(), "js"))) |field| {
            const name = camelize(field.name);
            const func = try env.getNamedProperty(exports, name);
            @field(self.js, field.name) = try env.createReference(func, 1);
        }
    }

    fn exportFunctionsToJavaScript(self: *@This(), js_env: Value) !void {
        const env = self.env;
        const imports = try env.createObject();
        const names = .{
            "loadModule",
            "getModuleAttributes",
            "getBufferAddress",
            "obtainExternBuffer",
            "moveExternBytes",
            "findSentinel",
            "getFactoryThunk",
            "runThunk",
            "runVariadicThunk",
            "createJsThunk",
            "destroyJsThunk",
            "recreateAddress",
            "finalizeAsyncCall",
            "getNumericValue",
            "setNumericValue",
            "requireBufferFallback",
            "syncExternalBuffer",
            "setRedirectionMask",
            "setSyscallTrap",
        };
        inline for (names) |name| {
            const cb = @field(@This(), name);
            const func = try env.createCallback(name, cb, false, self);
            try env.setNamedProperty(imports, name, func);
            try env.addFinalizer(func, @constCast(name), finalizeFunction, self, null);
            self.addRef();
            function_count += 1;
        }
        const import_fn = try env.getNamedProperty(js_env, "importFunctions");
        _ = try env.callFunction(js_env, import_fn, &.{imports});
    }

    fn finalizeFunction(_: Env, _: *anyopaque, finalize_hint: ?*anyopaque) callconv(.c) void {
        const self: *@This() = @ptrCast(@alignCast(finalize_hint.?));
        self.release();
        function_count -= 1;
    }

    fn loadModule(self: *@This(), path: Value, redirectIO: Value) !void {
        const env = self.env;
        const path_len = try env.getValueStringUtf8(path, null);
        const path_bytes = try c_allocator.alloc(u8, path_len + 1);
        defer c_allocator.free(path_bytes);
        _ = try env.getValueStringUtf8(path, path_bytes);
        const path_s = path_bytes[0..path_len];
        var lib = try std.DynLib.open(path_s);
        errdefer lib.close();
        const module = lib.lookup(*Module, "zig_module") orelse return error.MissingSymbol;
        if (module.version != 6) return error.IncorrectVersion;
        self.module = module;
        self.base_address = get: {
            switch (builtin.target.os.tag) {
                .windows => {
                    const MBI = std.os.windows.MEMORY_BASIC_INFORMATION;
                    var mbi: MBI = undefined;
                    _ = try std.os.windows.VirtualQuery(module, &mbi, @sizeOf(MBI));
                    break :get @intFromPtr(mbi.AllocationBase);
                },
                else => {
                    const c = @cImport({
                        @cDefine("_GNU_SOURCE", {});
                        @cDefine("_BSD_SOURCE", {});
                        @cInclude("dlfcn.h");
                    });
                    var dl_info: c.Dl_info = undefined;
                    if (c.dladdr(module, &dl_info) == 0) return error.Unexpected;
                    break :get @intFromPtr(dl_info.dli_fbase.?);
                },
            }
        };
        try self.exportFunctionsToModule();
        if (env.getValueBool(redirectIO) catch true) {
            try redirection_controller.installHooks(&lib, path_s, self);
            self.redirecting_io = true;
        }
        self.library = lib;
    }

    pub fn setThreadContext(self: *@This(), is_main: bool) !void {
        instance = self;
        in_main_thread = is_main;
        try self.addSyscallTrapSwitch();
        try redirection_controller.installSyscallTrap();
    }

    pub fn getSyscallHook(self: *@This(), name: [*:0]const u8) ?HookEntry {
        const module = self.module.?;
        var hook: HookEntry = undefined;
        if (module.exports.get_syscall_hook(name, &hook) != .SUCCESS) return null;
        return hook;
    }

    fn getModuleAttributes(self: *@This()) !Value {
        const env = self.env;
        const module = self.module orelse return error.NoLoadedModule;
        const attrs: u32 = @bitCast(module.attributes);
        return try env.createUint32(attrs);
    }

    fn getBufferAddress(self: *@This(), buffer: Value) !Value {
        const env = self.env;
        const bytes, _ = try env.getArraybufferInfo(buffer);
        return try env.createUsize(@intFromPtr(bytes));
    }

    fn obtainExternBuffer(self: *@This(), address: Value, len: Value, fallback_symbol: Value) !Value {
        const env = self.env;
        const src_bytes: [*]u8 = @ptrFromInt(try env.getValueUsize(address));
        const src_len: usize = @intFromFloat(try env.getValueDouble(len));
        const buffer = switch (canCreateExternalBuffer(env)) {
            true => try env.createExternalArraybuffer(src_bytes[0..src_len], finalizeExternalBuffer, self),
            false => create: {
                // make copy of external memory instead
                const copy_opaque, const buffer = try env.createArraybuffer(src_len);
                const copy_bytes: [*]u8 = @ptrCast(copy_opaque);
                @memcpy(copy_bytes[0..src_len], src_bytes[0..src_len]);
                // attach address as fallback property
                try env.setProperty(buffer, fallback_symbol, address);
                // add finalizer
                try env.addFinalizer(buffer, null, finalizeExternalBuffer, self, null);
                break :create buffer;
            },
        };
        // create a reference to the module so that the shared library doesn't get unloaded
        // while the external buffer is still around pointing to it
        self.addRef();
        buffer_count += 1;
        return buffer;
    }

    fn canCreateExternalBuffer(env: Env) bool {
        const ns = struct {
            var supported: ?bool = null;

            // Deno doesn't like null function reference for finalizer
            fn dummy(_: Env, _: *anyopaque, _: ?*anyopaque) callconv(.c) void {}
        };
        return ns.supported orelse check: {
            var bytes = [1]u8{0} ** 4;
            const created = if (env.createExternalArraybuffer(&bytes, ns.dummy, null)) |_| true else |_| false;
            ns.supported = created;
            break :check created;
        };
    }

    fn finalizeExternalBuffer(_: Env, _: *anyopaque, finalize_hint: ?*anyopaque) callconv(.c) void {
        const self: *@This() = @ptrCast(@alignCast(finalize_hint.?));
        self.release();
        buffer_count -= 1;
    }

    fn moveExternBytes(self: *@This(), view: Value, address: Value, to: Value) !void {
        const env = self.env;
        const len, const js_opaque, _, _ = env.getDataviewInfo(view) catch ta: {
            _, const len, const ptr, const ab, const offset = try env.getTypedarrayInfo(view);
            break :ta .{ len, ptr, ab, offset };
        };
        if (len > 0) {
            const zig_bytes: [*]u8 = @ptrFromInt(try env.getValueUsize(address));
            const js_bytes: [*]u8 = @ptrCast(js_opaque);
            const js_to_zig = try env.getValueBool(to);
            const src = if (js_to_zig) js_bytes else zig_bytes;
            const dst = if (js_to_zig) zig_bytes else js_bytes;
            @memcpy(dst[0..len], src[0..len]);
        }
    }

    fn findSentinel(self: *@This(), address: Value, sentinel: Value) !Value {
        const env = self.env;
        const addr_value = try env.getValueUsize(address);
        const sentinel_len, const sentinel_opaque, _, _ = try env.getDataviewInfo(sentinel);
        if (addr_value != 0 and sentinel_len != 0) {
            const src_bytes: [*]const u8 = @ptrFromInt(addr_value);
            const sentinel_bytes: [*]u8 = @ptrCast(sentinel_opaque);
            var i: usize = 0;
            var j: usize = 0;
            while (i < std.math.maxInt(u32)) {
                if (std.mem.eql(u8, src_bytes[i .. i + sentinel_len], sentinel_bytes[0..sentinel_len])) {
                    return try env.createUint32(@as(u32, @truncate(j)));
                }
                i += sentinel_len;
                j += 1;
            }
        }
        return try env.createInt32(-1);
    }

    fn getFactoryThunk(self: *@This()) !Value {
        const env = self.env;
        var thunk_address: usize = 0;
        const module = self.module orelse return error.NoLoadedModule;
        _ = module.exports.get_factory_thunk(&thunk_address);
        return try env.createUsize(thunk_address);
    }

    fn runThunk(
        self: *@This(),
        thunk_address: Value,
        fn_address: Value,
        arg_address: Value,
    ) !Value {
        const env = self.env;
        const module = self.module orelse return error.NoLoadedModule;
        const result = module.exports.run_thunk(
            try env.getValueUsize(thunk_address),
            try env.getValueUsize(fn_address),
            try env.getValueUsize(arg_address),
        );
        return try env.getBoolean(result == .SUCCESS);
    }

    fn runVariadicThunk(
        self: *@This(),
        thunk_address: Value,
        fn_address: Value,
        arg_address: Value,
        attr_address: Value,
        arg_len: Value,
    ) !Value {
        const env = self.env;
        const module = self.module orelse return error.NoLoadedModule;
        const result = module.exports.run_variadic_thunk(
            try env.getValueUsize(thunk_address),
            try env.getValueUsize(fn_address),
            try env.getValueUsize(arg_address),
            try env.getValueUsize(attr_address),
            try env.getValueUint32(arg_len),
        );
        return try env.getBoolean(result == .SUCCESS);
    }

    fn createJsThunk(self: *@This(), controller_address: Value, fn_id: Value) !Value {
        const env = self.env;
        var thunk_address: usize = 0;
        const module = self.module orelse return error.NoLoadedModule;
        _ = module.exports.create_js_thunk(
            try env.getValueUsize(controller_address),
            try env.getValueUint32(fn_id),
            &thunk_address,
        );
        return try env.createUsize(thunk_address);
    }

    fn destroyJsThunk(self: *@This(), controller_address: Value, fn_address: Value) !Value {
        const env = self.env;
        var fn_id: usize = 0;
        const module = self.module orelse return error.NoLoadedModule;
        _ = module.exports.destroy_js_thunk(
            try env.getValueUsize(controller_address),
            try env.getValueUsize(fn_address),
            &fn_id,
        );
        return try env.createUint32(@as(u32, @truncate(fn_id)));
    }

    fn recreateAddress(self: *@This(), handle: Value) !Value {
        const env = self.env;
        var new_address: usize = undefined;
        const module = self.module orelse return error.NoLoadedModule;
        const handle_value: usize = @intFromFloat(try env.getValueDouble(handle));
        const result = module.exports.get_export_address(
            self.base_address + handle_value,
            &new_address,
        );
        if (result != .SUCCESS) return error.Unexpected;
        return try env.createUsize(new_address);
    }

    fn finalizeAsyncCall(self: *@This(), futex_handle: Value, async_result: Value) !void {
        const env = self.env;
        const handle = try env.getValueUsize(futex_handle);
        const value = try env.getValueUint32(async_result);
        try Futex.wake(handle, @enumFromInt(value));
    }

    const NumberType = enum(u32) {
        int = 2, // the numeric values match those for MemberType
        uint,
        float,
    };

    fn getNumericValue(self: *@This(), member_type: Value, bits: Value, address: Value) !Value {
        const env = self.env;
        const type_enum = try std.meta.intToEnum(NumberType, try env.getValueUint32(member_type));
        const bit_size = try env.getValueUint32(bits);
        const addr_value = try env.getValueUsize(address);
        if (!std.mem.isAligned(addr_value, bit_size / 8)) return error.PointerMisalignment;
        const src: *const anyopaque = @ptrFromInt(addr_value);
        return switch (type_enum) {
            .int => switch (bit_size) {
                64 => try env.createBigintInt64(@as(*const i64, @ptrCast(@alignCast(src))).*),
                32 => try env.createInt32(@as(*const i32, @ptrCast(@alignCast(src))).*),
                16 => try env.createInt32(@as(*const i16, @ptrCast(@alignCast(src))).*),
                8 => try env.createInt32(@as(*const i16, @ptrCast(@alignCast(src))).*),
                else => error.InvalidArg,
            },
            .uint => switch (bit_size) {
                64 => try env.createBigintUint64(@as(*const u64, @ptrCast(@alignCast(src))).*),
                32 => try env.createUint32(@as(*const u32, @ptrCast(@alignCast(src))).*),
                16 => try env.createUint32(@as(*const u16, @ptrCast(@alignCast(src))).*),
                8 => try env.createUint32(@as(*const u16, @ptrCast(@alignCast(src))).*),
                else => error.InvalidArg,
            },
            .float => switch (bit_size) {
                64 => try env.createDouble(@as(*const f64, @ptrCast(@alignCast(src))).*),
                32 => try env.createDouble(@as(*const f32, @ptrCast(@alignCast(src))).*),
                else => return error.InvalidArg,
            },
        };
    }

    fn setNumericValue(self: *@This(), member_type: Value, bits: Value, address: Value, value: Value) !void {
        const env = self.env;
        const type_enum = try std.meta.intToEnum(NumberType, try env.getValueUint32(member_type));
        const bit_size = try env.getValueUint32(bits);
        const addr_value = try env.getValueUsize(address);
        if (!std.mem.isAligned(addr_value, bit_size / 8)) return error.PointerMisalignment;
        const src: *anyopaque = @ptrFromInt(addr_value);
        switch (type_enum) {
            .int => switch (bit_size) {
                64 => {
                    const i64_value, _ = try env.getValueBigintInt64(value);
                    @as(*i64, @ptrCast(@alignCast(src))).* = i64_value;
                },
                else => {
                    const i32_value = try env.getValueInt32(value);
                    switch (bit_size) {
                        32 => @as(*i32, @ptrCast(@alignCast(src))).* = i32_value,
                        16 => @as(*i16, @ptrCast(@alignCast(src))).* = @truncate(i32_value),
                        8 => @as(*i8, @ptrCast(@alignCast(src))).* = @truncate(i32_value),
                        else => return error.InvalidArg,
                    }
                },
            },
            .uint => switch (bit_size) {
                64 => {
                    const u64_value, _ = try env.getValueBigintUint64(value);
                    @as(*u64, @ptrCast(@alignCast(src))).* = u64_value;
                },
                else => {
                    const u32_value = try env.getValueUint32(value);
                    switch (bit_size) {
                        32 => @as(*u32, @ptrCast(@alignCast(src))).* = u32_value,
                        16 => @as(*u16, @ptrCast(@alignCast(src))).* = @truncate(u32_value),
                        8 => @as(*u8, @ptrCast(@alignCast(src))).* = @truncate(u32_value),
                        else => return error.InvalidArg,
                    }
                },
            },
            .float => {
                const f64_value = try env.getValueDouble(value);
                switch (bit_size) {
                    64 => @as(*f64, @ptrCast(@alignCast(src))).* = f64_value,
                    32 => @as(*f32, @ptrCast(@alignCast(src))).* = @floatCast(f64_value),
                    else => return error.InvalidArg,
                }
            },
        }
    }

    fn requireBufferFallback(self: *@This()) !Value {
        const env = self.env;
        return try env.getBoolean(!canCreateExternalBuffer(env));
    }

    fn syncExternalBuffer(self: *@This(), buffer: Value, address: Value, to: Value) !void {
        const env = self.env;
        const opaque1, const len = try env.getArraybufferInfo(buffer);
        const bytes1: [*]u8 = @ptrCast(opaque1);
        const bytes2: [*]u8 = @ptrFromInt(try env.getValueUsize(address));
        if (try env.getValueBool(to))
            @memcpy(bytes2[0..len], bytes1[0..len])
        else
            @memcpy(bytes1[0..len], bytes2[0..len]);
    }

    fn setRedirectionMask(self: *@This(), event: Value, listening: Value) !void {
        const env = self.env;
        const event_len = try env.getValueStringUtf8(event, null);
        const event_bytes = try c_allocator.alloc(u8, event_len + 1);
        defer c_allocator.free(event_bytes);
        _ = try env.getValueStringUtf8(event, event_bytes);
        const event_name = event_bytes[0..event_len];
        const set = try env.getValueBool(listening);
        const count_before = countEventHandlers(self.redirection_mask);
        return inline for (std.meta.fields(hooks.Mask)) |field| {
            if (std.mem.eql(u8, field.name, event_name)) {
                @field(self.redirection_mask, field.name) = set;
                const count_after = countEventHandlers(self.redirection_mask);
                if (count_before == 0 and count_after != 0) {
                    self.enableSyscallTrap();
                } else if (count_before != 0 and count_after == 0) {
                    self.disableSyscallTrap();
                }
                break;
            }
        } else error.UnknownEventName;
    }

    fn countEventHandlers(mask: hooks.Mask) usize {
        var count: usize = 0;
        inline for (std.meta.fields(hooks.Mask)) |field| {
            if (@field(mask, field.name)) {
                count += 1;
            }
        }
        return count;
    }

    fn setSyscallTrap(self: *@This(), trapping: Value) !void {
        const env = self.env;
        const set = try env.getValueBool(trapping);
        if (set) {
            self.enableSyscallTrap();
        } else {
            self.disableSyscallTrap();
        }
    }

    fn enableSyscallTrap(self: *@This()) void {
        self.syscall_trap_count += 1;
        if (self.syscall_trap_count == 1) {
            for (self.syscall_trap_switches.items) |ptr| {
                ptr.* = true;
            }
        }
    }

    fn disableSyscallTrap(self: *@This()) void {
        if (self.syscall_trap_count == 0) return;
        self.syscall_trap_count -= 1;
        if (self.syscall_trap_count == 0) {
            for (self.syscall_trap_switches.items) |ptr| {
                ptr.* = false;
            }
        }
    }

    fn exportFunctionsToModule(self: *@This()) !void {
        const names = .{
            "create_bool",
            "create_integer",
            "create_big_integer",
            "create_string",
            "create_view",
            "create_instance",
            "create_template",
            "create_list",
            "create_object",
            "append_list",
            "get_property",
            "set_property",
            "get_slot_value",
            "set_slot_value",
            "begin_structure",
            "finish_structure",
            "enable_multithread",
            "disable_multithread",
            "get_instance",
            "initialize_thread",
            "handle_jscall",
            "handle_syscall",
            "get_syscall_mask",
            "release_function",
        };
        const module = self.module orelse return error.NoLoadedModule;
        inline for (names) |name| {
            const name_c = comptime camelize(name);
            const func = @field(@This(), name_c);
            const Args = std.meta.ArgsTuple(@TypeOf(func));
            const RT = @typeInfo(@TypeOf(func)).@"fn".return_type.?;
            const Payload = switch (@typeInfo(RT)) {
                .error_union => |eu| eu.payload,
                else => RT,
            };
            const extra = if (Payload == void or Payload == E) 0 else 1;
            const NewArgs = comptime define: {
                const fields = std.meta.fields(Args);
                var new_fields: [fields.len - 1 + extra]std.builtin.Type.StructField = undefined;
                var new_args_info = @typeInfo(Args);
                new_args_info.@"struct".fields = &new_fields;
                for (&new_fields, 0..) |*field_ptr, i| {
                    const Arg = switch (i) {
                        fields.len - 1 => *Payload,
                        else => fields[i + 1].type,
                    };
                    field_ptr.* = .{
                        .name = std.fmt.comptimePrint("{d}", .{i}),
                        .type = Arg,
                        .default_value_ptr = null,
                        .is_comptime = false,
                        .alignment = @alignOf(Arg),
                    };
                }
                break :define @Type(new_args_info);
            };
            const ns = struct {
                fn call(new_args: NewArgs) E {
                    var args: Args = undefined;
                    inline for (&args, 0..) |*arg_ptr, i| {
                        if (i == 0) {
                            // use instance of @This() associated with this thread
                            arg_ptr.* = instance;
                        } else {
                            arg_ptr.* = new_args[i - 1];
                        }
                    }
                    const retval = @call(.auto, func, args);
                    if (retval) |payload| {
                        if (Payload == E) return payload;
                        if (extra == 1) new_args[new_args.len - 1].* = payload;
                        return .SUCCESS;
                    } else |_| {
                        return .FAULT;
                    }
                }
            };
            @field(module.imports, name) = fn_transform.spreadArgs(ns.call, .c);
        }
    }

    fn createBool(self: *@This(), value: bool) !Value {
        const env = self.env;
        return try env.getBoolean(value);
    }

    fn createInteger(self: *@This(), value: i32, unsigned: bool) !Value {
        const env = self.env;
        if (unsigned) {
            const unsigned_value: u32 = @bitCast(value);
            return try env.createUint32(unsigned_value);
        } else {
            return try env.createInt32(value);
        }
    }

    fn createBigInteger(self: *@This(), value: i64, unsigned: bool) !Value {
        const env = self.env;
        if (unsigned) {
            const unsigned_value: u64 = @bitCast(value);
            return try env.createBigintUint64(unsigned_value);
        } else {
            return try env.createBigintInt64(value);
        }
    }

    fn createString(self: *@This(), bytes: [*]const u8, len: usize) !Value {
        const env = self.env;
        return try env.createStringUtf8(bytes[0..len]);
    }

    fn createView(self: *@This(), bytes: ?[*]const u8, len: usize, copying: bool, handle: usize) !Value {
        const env = self.env;
        const pi_handle = if (handle != 0) handle - self.base_address else 0;
        return env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.create_view orelse return error.Unexpected),
            &.{
                try env.createUsize(if (bytes) |b| @intFromPtr(b) else 0),
                try env.createUint32(@as(u32, @truncate(len))),
                try env.getBoolean(copying),
                try env.createUsize(pi_handle),
            },
        );
    }

    fn createInstance(self: *@This(), structure: Value, dv: Value, slots: ?Value) !Value {
        const env = self.env;
        return env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.create_instance orelse return error.Unexpected),
            &.{
                structure,
                dv,
                slots orelse try env.getNull(),
            },
        );
    }

    fn createTemplate(self: *@This(), dv: ?Value, slots: ?Value) !Value {
        const env = self.env;
        return try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.create_template orelse return error.Unexpected),
            &.{
                dv orelse try env.getNull(),
                slots orelse try env.getNull(),
            },
        );
    }

    fn createList(self: *@This()) !Value {
        const env = self.env;
        return try env.createArray();
    }

    fn createObject(self: *@This()) !Value {
        const env = self.env;
        return try env.createObject();
    }

    fn appendList(self: *@This(), list: Value, element: Value) !void {
        const env = self.env;
        _ = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.append_list orelse return error.Unexpected),
            &.{
                list,
                element,
            },
        );
    }

    fn getProperty(self: *@This(), object: Value, key_bytes: [*]const u8, key_len: usize) !Value {
        const env = self.env;
        const key = try env.createStringUtf8(key_bytes[0..key_len]);
        return try env.getProperty(object, key);
    }

    fn setProperty(self: *@This(), object: Value, key_bytes: [*]const u8, key_len: usize, value: Value) !void {
        const env = self.env;
        const key = try env.createStringUtf8(key_bytes[0..key_len]);
        return try env.setProperty(object, key, value);
    }

    fn getSlotValue(self: *@This(), object: ?Value, slot: usize) !Value {
        const env = self.env;
        const result = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.get_slot_value orelse return error.Unexpected),
            &.{
                object orelse try env.getNull(),
                try env.createUint32(@as(u32, @truncate(slot))),
            },
        );
        return switch (try env.typeof(result)) {
            .undefined => error.Failed,
            else => result,
        };
    }

    fn setSlotValue(self: *@This(), object: ?Value, slot: usize, value: ?Value) !void {
        const env = self.env;
        _ = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.set_slot_value orelse return error.Unexpected),
            &.{
                object orelse try env.getNull(),
                try env.createUint32(@as(u32, @truncate(slot))),
                value orelse try env.getNull(),
            },
        );
    }

    fn beginStructure(self: *@This(), structure: Value) !void {
        const env = self.env;
        _ = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.begin_structure orelse return error.Unexpected),
            &.{
                structure,
            },
        );
    }

    fn finishStructure(self: *@This(), structure: Value) !void {
        const env = self.env;
        _ = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.finish_structure orelse return error.Unexpected),
            &.{
                structure,
            },
        );
    }

    fn handleJscall(self: *@This(), call: *Jscall) !E {
        if (in_main_thread) {
            if (call.futex_handle != 0) {
                errdefer Futex.wake(call.futex_handle, E.FAULT) catch {};
            }
            const env = self.env;
            const status = try env.callFunction(
                try env.getNull(),
                try env.getReferenceValue(self.js.handle_jscall orelse return error.Unexpected),
                &.{
                    try env.createUint32(@as(u32, @truncate(call.fn_id))),
                    try env.createUsize(call.arg_address),
                    try env.createUint32(@as(u32, @truncate(call.arg_size))),
                    try env.createUsize(call.futex_handle),
                },
            );
            return std.meta.intToEnum(E, try env.getValueUint32(status)) catch .FAULT;
        } else {
            const func = self.ts.handle_jscall orelse return error.Disabled;
            var futex: Futex = undefined;
            call.futex_handle = futex.init();
            try napi.callThreadsafeFunction(func, @ptrCast(@constCast(call)), .nonblocking);
            return futex.wait();
        }
    }

    fn handleSyscall(self: *@This(), call: *Syscall) !E {
        if (in_main_thread) {
            const env = self.env;
            const futex = switch (call.futex_handle) {
                0 => try env.getUndefined(),
                else => |handle| try env.createUsize(handle),
            };
            return switch (call.cmd) {
                .access => try self.handleAccess(futex, &call.u.access),
                .open => try self.handleOpen(futex, &call.u.open),
                .close => try self.handleClose(futex, &call.u.close),
                .read => try self.handleRead(futex, &call.u.read),
                .pread => try self.handlePread(futex, &call.u.pread),
                .write => try self.handleWrite(futex, &call.u.write),
                .pwrite => try self.handlePwrite(futex, &call.u.pwrite),
                .seek => try self.handleSeek(futex, &call.u.seek),
                .tell => try self.handleTell(futex, &call.u.tell),
                .getfl => try self.handleGetDescriptorFlags(futex, &call.u.getfl),
                .setfl => try self.handleSetDescriptorFlags(futex, &call.u.setfl),
                .getlk => try self.handleGetLock(futex, &call.u.getlk),
                .setlk => try self.handleSetLock(futex, &call.u.setlk),
                .fstat => try self.handleStat(futex, &call.u.fstat),
                .stat => try self.handleStat(futex, &call.u.stat),
                .futimes => try self.handleSettimes(futex, &call.u.futimes),
                .utimes => try self.handleSettimes(futex, &call.u.utimes),
                .advise => try self.handleAdvise(futex, &call.u.advise),
                .allocate => try self.handleAllocate(futex, &call.u.allocate),
                .sync => try self.handleSync(futex, &call.u.sync),
                .datasync => try self.handleDatasync(futex, &call.u.datasync),
                .getdents => try self.handleGetdents(futex, &call.u.getdents),
                .mkdir => try self.handleMkdir(futex, &call.u.mkdir),
                .rmdir => try self.handleRmdir(futex, &call.u.rmdir),
                .unlink => try self.handleUnlink(futex, &call.u.unlink),
            };
        } else {
            const func = self.ts.handle_syscall orelse return error.Disabled;
            var futex: Futex = undefined;
            call.futex_handle = futex.init();
            try napi.callThreadsafeFunction(func, @ptrCast(call), .nonblocking);
            return futex.wait();
        }
    }

    fn callPosixFunction(self: *@This(), fn_ref: ?Ref, args: []const Value) !E {
        const env = self.env;
        const result = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(fn_ref orelse return error.Unexpected),
            args,
        );
        const error_code = try env.getValueUint32(result);
        return try std.meta.intToEnum(E, error_code);
    }

    fn handleAccess(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        const path_len: u32 = @truncate(std.mem.len(args.path));
        return try self.callPosixFunction(self.js.path_access, &.{
            try env.createInt32(args.dirfd),
            try env.createUint32(@as(u32, @bitCast(args.lookup_flags))),
            try env.createUsize(@intFromPtr(args.path)),
            try env.createUint32(path_len),
            try env.createBigintUint64(@as(u64, @bitCast(args.rights))),
            futex,
        });
    }

    fn handleOpen(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        const path_len: u32 = @truncate(std.mem.len(args.path));
        return try self.callPosixFunction(self.js.path_open, &.{
            try env.createInt32(args.dirfd),
            try env.createUint32(@as(u32, @bitCast(args.lookup_flags))),
            try env.createUsize(@intFromPtr(args.path)),
            try env.createUint32(path_len),
            try env.createUint32(@as(u16, @bitCast(args.open_flags))),
            try env.createBigintUint64(@as(u64, @bitCast(args.rights))),
            try env.createBigintUint64(0),
            try env.createUint32(@as(u16, @bitCast(args.descriptor_flags))),
            try env.createUsize(@intFromPtr(&args.fd)),
            futex,
        });
    }

    fn handleClose(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        return try self.callPosixFunction(self.js.fd_close, &.{
            try env.createInt32(args.fd),
            futex,
        });
    }

    fn handleRead(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        const len: u32 = @intCast(args.len);
        const result = try self.callPosixFunction(self.js.fd_read1, &.{
            try env.createInt32(args.fd),
            try env.createUsize(@intFromPtr(args.bytes)),
            try env.createUint32(len),
            try env.createUsize(@intFromPtr(&args.read)),
            futex,
        });
        return result;
    }

    fn handlePread(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        const len: u32 = @intCast(args.len);
        return try self.callPosixFunction(self.js.fd_pread1, &.{
            try env.createInt32(args.fd),
            try env.createUsize(@intFromPtr(args.bytes)),
            try env.createUint32(len),
            try env.createUsize(args.offset),
            try env.createUsize(@intFromPtr(&args.read)),
            futex,
        });
    }

    fn handleWrite(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        const len: u32 = @intCast(args.len);
        return try self.callPosixFunction(self.js.fd_write1, &.{
            try env.createInt32(args.fd),
            try env.createUsize(@intFromPtr(args.bytes)),
            try env.createUint32(len),
            try env.createUsize(@intFromPtr(&args.written)),
            futex,
        });
    }

    fn handlePwrite(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        const len: u32 = @intCast(args.len);
        return try self.callPosixFunction(self.js.fd_pwrite1, &.{
            try env.createInt32(args.fd),
            try env.createUsize(@intFromPtr(args.bytes)),
            try env.createUint32(len),
            try env.createUsize(args.offset),
            try env.createUsize(@intFromPtr(&args.written)),
            futex,
        });
    }

    fn handleSeek(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        return try self.callPosixFunction(self.js.fd_seek, &.{
            try env.createInt32(args.fd),
            try env.createBigintInt64(args.offset),
            try env.createUint32(args.whence),
            try env.createUsize(@intFromPtr(&args.position)),
            futex,
        });
    }

    fn handleTell(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        return try self.callPosixFunction(self.js.fd_tell, &.{
            try env.createInt32(args.fd),
            try env.createUsize(@intFromPtr(&args.position)),
            futex,
        });
    }

    fn handleSettimes(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        if (@hasField(@TypeOf(args.*), "fd")) {
            return try self.callPosixFunction(self.js.fd_filestat_set_times, &.{
                try env.createInt32(args.fd),
                try env.createBigintUint64(args.atime),
                try env.createBigintUint64(args.mtime),
                try env.createUint32(@as(u16, @bitCast(args.time_flags))),
                futex,
            });
        } else {
            const path_len: u32 = @truncate(std.mem.len(args.path));
            return try self.callPosixFunction(self.js.path_filestat_set_times, &.{
                try env.createInt32(args.dirfd),
                try env.createUint32(@as(u32, @bitCast(args.lookup_flags))),
                try env.createUsize(@intFromPtr(args.path)),
                try env.createUint32(path_len),
                try env.createBigintUint64(args.atime),
                try env.createBigintUint64(args.mtime),
                try env.createUint32(@as(u16, @bitCast(args.time_flags))),
                futex,
            });
        }
    }

    fn handleStat(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        if (@hasField(@TypeOf(args.*), "fd")) {
            return try self.callPosixFunction(self.js.fd_filestat_get, &.{
                try env.createInt32(args.fd),
                try env.createUsize(@intFromPtr(&args.stat)),
                futex,
            });
        } else {
            const path_len: u32 = @truncate(std.mem.len(args.path));
            return try self.callPosixFunction(self.js.path_filestat_get, &.{
                try env.createInt32(args.dirfd),
                try env.createUint32(@as(u32, @bitCast(args.lookup_flags))),
                try env.createUsize(@intFromPtr(args.path)),
                try env.createUint32(path_len),
                try env.createUsize(@intFromPtr(&args.stat)),
                futex,
            });
        }
    }

    fn handleGetDescriptorFlags(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        return try self.callPosixFunction(self.js.fd_fdstat_get, &.{
            try env.createInt32(args.fd),
            try env.createUsize(@intFromPtr(&args.fdstat)),
            futex,
        });
    }

    fn handleSetDescriptorFlags(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        return try self.callPosixFunction(self.js.fd_fdstat_set_flags, &.{
            try env.createInt32(args.fd),
            try env.createUint32(@as(u16, @bitCast(args.fdflags))),
            futex,
        });
    }

    fn handleSetLock(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        return try self.callPosixFunction(self.js.fd_lock_set, &.{
            try env.createInt32(args.fd),
            try env.createUsize(@intFromPtr(&args.lock)),
            try env.getBoolean(args.wait),
            futex,
        });
    }

    fn handleGetLock(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        return try self.callPosixFunction(self.js.fd_lock_get, &.{
            try env.createInt32(args.fd),
            try env.createUsize(@intFromPtr(&args.lock)),
            futex,
        });
    }

    fn handleAdvise(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        return try self.callPosixFunction(self.js.fd_advise, &.{
            try env.createInt32(args.fd),
            try env.createBigintUint64(args.offset),
            try env.createBigintUint64(args.len),
            try env.createInt32(@intFromEnum(args.advice)),
            futex,
        });
    }

    fn handleAllocate(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        return try self.callPosixFunction(self.js.fd_allocate, &.{
            try env.createInt32(args.fd),
            try env.createBigintUint64(args.offset),
            try env.createBigintUint64(args.len),
            futex,
        });
    }

    fn handleSync(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        return try self.callPosixFunction(self.js.fd_sync, &.{
            try env.createInt32(args.fd),
            futex,
        });
    }

    fn handleDatasync(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        return try self.callPosixFunction(self.js.fd_datasync, &.{
            try env.createInt32(args.fd),
            futex,
        });
    }

    fn handleMkdir(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        const path_len: u32 = @truncate(std.mem.len(args.path));
        return try self.callPosixFunction(self.js.path_create_directory, &.{
            try env.createInt32(args.dirfd),
            try env.createUsize(@intFromPtr(args.path)),
            try env.createUint32(path_len),
            futex,
        });
    }

    fn handleRmdir(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        const path_len: u32 = @truncate(std.mem.len(args.path));
        return try self.callPosixFunction(self.js.path_remove_directory, &.{
            try env.createInt32(args.dirfd),
            try env.createUsize(@intFromPtr(args.path)),
            try env.createUint32(path_len),
            futex,
        });
    }

    fn handleUnlink(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        const path_len: u32 = @truncate(std.mem.len(args.path));
        return try self.callPosixFunction(self.js.path_unlink_file, &.{
            try env.createInt32(args.dirfd),
            try env.createUsize(@intFromPtr(args.path)),
            try env.createUint32(path_len),
            futex,
        });
    }

    fn handleGetdents(self: *@This(), futex: Value, args: anytype) !E {
        const env = self.env;
        return try self.callPosixFunction(self.js.fd_readdir, &.{
            try env.createInt32(args.dirfd),
            try env.createUsize(@intFromPtr(args.buffer)),
            try env.createUint32(@intCast(args.len)),
            try env.createBigintUint64(0),
            try env.createUsize(@intFromPtr(&args.read)),
            futex,
        });
    }

    fn addSyscallTrapSwitch(self: *@This()) !void {
        self.syscall_trap_mutex.lock();
        defer self.syscall_trap_mutex.unlock();
        try self.syscall_trap_switches.append(&trapping_syscalls);
        if (self.syscall_trap_count > 0) {
            trapping_syscalls = true;
        }
    }

    fn getSyscallMask(self: *@This(), ptr: *hooks.Mask) !void {
        ptr.* = self.redirection_mask;
    }

    fn releaseFunction(self: *@This(), fn_id: usize) !void {
        if (in_main_thread) {
            const env = self.env;
            _ = try env.callFunction(
                try env.getNull(),
                try env.getReferenceValue(self.js.release_function orelse return error.Unexpected),
                &.{
                    try env.createUint32(@as(u32, @truncate(fn_id))),
                },
            );
        } else {
            const func = self.ts.release_function orelse return error.Disabled;
            try napi.callThreadsafeFunction(func, @ptrFromInt(fn_id), .nonblocking);
        }
    }

    fn enableMultithread(self: *@This()) !void {
        if (in_main_thread) {
            const prev_count = self.multithread_count.fetchAdd(1, .monotonic);
            errdefer _ = self.multithread_count.fetchSub(1, .monotonic);
            if (prev_count == 0) {
                const env = self.env;
                const fields = @typeInfo(@FieldType(ModuleHost, "ts")).@"struct".fields;
                const resource_name = try env.createStringUtf8("zigar");
                inline for (fields) |field| {
                    const cb = @field(threadsafe_callback, field.name);
                    @field(self.ts, field.name) = try env.createThreadsafeFunction(
                        null,
                        null,
                        resource_name,
                        0,
                        1,
                        null,
                        null,
                        @ptrCast(self),
                        @ptrCast(&cb),
                    );
                }
            }
        } else {
            return error.Unsupported;
        }
    }

    fn disableMultithread(self: *@This()) !void {
        if (in_main_thread) {
            const prev_count = self.multithread_count.fetchSub(1, .monotonic);
            errdefer _ = self.multithread_count.fetchAdd(1, .monotonic);
            if (prev_count == 1) {
                const fields = @typeInfo(@FieldType(ModuleHost, "ts")).@"struct".fields;
                inline for (fields) |field| {
                    if (@field(self.ts, field.name)) |ref|
                        try napi.releaseThreadsafeFunction(ref, .abort);
                    @field(self.ts, field.name) = null;
                }
            }
        } else {
            const func = self.ts.disable_multithread orelse return error.Disabled;
            try napi.callThreadsafeFunction(func, null, .nonblocking);
        }
    }

    fn getInstance(self: *@This(), ptr: **anyopaque) !void {
        ptr.* = self;
    }

    fn initializeThread(_: *@This(), ptr: *anyopaque) !void {
        const self: *@This() = @ptrCast(@alignCast(ptr));
        try self.setThreadContext(false);
    }

    const threadsafe_callback = struct {
        fn handle_jscall(_: *Env, _: Value, context: *anyopaque, data: *anyopaque) callconv(.C) void {
            const self: *ModuleHost = @ptrCast(@alignCast(context));
            const call: *Jscall = @ptrCast(@alignCast(data));
            _ = handleJscall(self, call) catch {
                // wake caller if call fails since JavaScript isn't going to do it
                Futex.wake(call.futex_handle, .FAULT) catch {};
            };
        }

        fn handle_syscall(_: *Env, _: Value, context: *anyopaque, data: *anyopaque) callconv(.C) void {
            const self: *ModuleHost = @ptrCast(@alignCast(context));
            const call: *Syscall = @ptrCast(@alignCast(data));
            _ = handleSyscall(self, call) catch {
                Futex.wake(call.futex_handle, .FAULT) catch {};
            };
        }

        fn release_function(_: *Env, _: Value, context: *anyopaque, data: *anyopaque) callconv(.C) void {
            const self: *ModuleHost = @ptrCast(@alignCast(context));
            const fn_id = @intFromPtr(data);
            releaseFunction(self, fn_id) catch {};
        }

        fn disable_multithread(_: *Env, _: Value, context: *anyopaque, _: *anyopaque) callconv(.C) void {
            const self: *ModuleHost = @ptrCast(@alignCast(context));
            disableMultithread(self) catch {};
        }
    };
};

const Futex = struct {
    const initial_value = 0xffff_ffff;

    value: std.atomic.Value(u32),
    handle: usize,

    pub fn init(self: *@This()) usize {
        self.value = std.atomic.Value(u32).init(initial_value);
        self.handle = @intFromPtr(self);
        return self.handle;
    }

    pub fn wait(self: *@This()) E {
        std.Thread.Futex.wait(&self.value, initial_value);
        return @enumFromInt(self.value.load(.acquire));
    }

    pub fn wake(handle: usize, result: E) !void {
        const ptr: *Futex = @ptrFromInt(handle);
        if (ptr.handle != handle) return error.Unexpected;
        ptr.value.store(@intFromEnum(result), .release);
        std.Thread.Futex.wake(&ptr.value, 1);
    }
};

fn throwError(env: *Env, fmt: []const u8, args: anytype) void {
    var buffer: [1024]u8 = undefined;
    const message = std.fmt.bufPrintZ(&buffer, fmt, args);
    env.throwError(null, message) catch {};
}

fn throwLastError(env: *Env) void {
    const error_info = env.getLastErrorInfo();
    const message = error_info.error_message orelse @as([:0]const u8, "Unknown error");
    throwError(env, message, .{});
}

fn missing(comptime T: type) comptime_int {
    return std.math.maxInt(T);
}

inline fn camelize(comptime name: []const u8) [:0]const u8 {
    var buffer: [name.len + 1]u8 = undefined;
    var len: usize = 0;
    var capitalize = false;
    for (name) |c| {
        if (c == '_') {
            capitalize = true;
        } else if (capitalize) {
            buffer[len] = std.ascii.toUpper(c);
            len += 1;
            capitalize = false;
        } else {
            buffer[len] = c;
            len += 1;
        }
    }
    buffer[len] = 0;
    return @ptrCast(buffer[0..len]);
}
