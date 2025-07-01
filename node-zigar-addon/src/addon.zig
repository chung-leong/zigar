const std = @import("std");
const allocator = std.heap.c_allocator;
const builtin = @import("builtin");

const fn_transform = @import("code-gen/fn-transform.zig");
const napi = @import("napi.zig");
const Env = napi.Env;
const Value = napi.Value;
const Ref = napi.Ref;
const ThreadsafeFunction = napi.ThreadsafeFunction;
const redirect = @import("redirect.zig");
const SysCall = redirect.SysCall;

comptime {
    napi.createAddon(ModuleHost.attachExports);
}

const ModuleHost = struct {
    ref_count: isize = 1,
    module: ?*Module = null,
    library: ?std.DynLib = null,
    base_address: usize = 0,
    env: Env,
    js: struct {
        capture_view: ?Ref = null,
        cast_view: ?Ref = null,
        read_slot: ?Ref = null,
        write_slot: ?Ref = null,
        begin_structure: ?Ref = null,
        attach_member: ?Ref = null,
        attach_template: ?Ref = null,
        define_structure: ?Ref = null,
        end_structure: ?Ref = null,
        create_template: ?Ref = null,
        handle_js_call: ?Ref = null,
        release_function: ?Ref = null,
        write_bytes: ?Ref = null,
    } = .{},
    ts: struct {
        disable_multithread: ?ThreadsafeFunction = null,
        handle_js_call: ?ThreadsafeFunction = null,
        handle_sys_call: ?ThreadsafeFunction = null,
        release_function: ?ThreadsafeFunction = null,
    } = .{},

    var module_count: i32 = 0;
    var buffer_count: i32 = 0;
    var function_count: i32 = 0;

    fn attachExports(env: Env, exports: Value) !void {
        inline for (.{ "createEnvironment", "getGCStatistics" }) |name| {
            const func = @field(@This(), name);
            try env.setNamedProperty(exports, name, try env.createCallback(name, func, false, null));
        }
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
        const self = try allocator.create(@This());
        self.* = .{ .env = env };
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
            allocator.destroy(self);
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
            "copyExternBytes",
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

    fn loadModule(self: *@This(), path: Value) !void {
        const env = self.env;
        const path_len = try env.getValueStringUtf8(path, null);
        const path_bytes = try allocator.alloc(u8, path_len + 1);
        defer allocator.free(path_bytes);
        _ = try env.getValueStringUtf8(path, path_bytes);
        var lib = try std.DynLib.open(path_bytes);
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
        if (module.exports.initialize(self) != .ok) return error.Unexpected;
        try redirect.redirectIO(&lib, path_bytes, @ptrCast(module.exports.override_sys_call));
        self.library = lib;
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

    fn copyExternBytes(self: *@This(), view: Value, address: Value, len: Value) !void {
        const env = self.env;
        const src_bytes: [*]const u8 = @ptrFromInt(try env.getValueUsize(address));
        const src_len: usize = @intFromFloat(try env.getValueDouble(len));
        const dst_len, const dest_opaque, _, _ = try env.getDataviewInfo(view);
        const dst_bytes: [*]u8 = @ptrCast(dest_opaque);
        if (dst_len != src_len) return error.LengthMismatch;
        @memcpy(dst_bytes[0..src_len], src_bytes[0..src_len]);
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
        return try env.getBoolean(result == .ok);
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
        return try env.getBoolean(result == .ok);
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
        if (result != .ok) return error.Unexpected;
        return try env.createUsize(new_address);
    }

    fn finalizeAsyncCall(self: *@This(), futex_handle: Value, async_result: Value) !void {
        const env = self.env;
        const handle = try env.getValueUsize(futex_handle);
        const value = try env.getValueUint32(async_result);
        try Futex.wake(handle, @enumFromInt(value));
    }

    fn getNumericValue(self: *@This(), member_type: Value, bits: Value, address: Value) !Value {
        const env = self.env;
        const type_enum = try std.meta.intToEnum(MemberType, try env.getValueUint32(member_type));
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
            else => return error.Unexpected,
        };
    }

    fn setNumericValue(self: *@This(), member_type: Value, bits: Value, address: Value, value: Value) !void {
        const env = self.env;
        const type_enum = try std.meta.intToEnum(MemberType, try env.getValueUint32(member_type));
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
            else => return error.Unexpected,
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

    fn exportFunctionsToModule(self: *@This()) !void {
        const names = .{
            "capture_string",
            "capture_view",
            "cast_view",
            "read_slot",
            "write_slot",
            "begin_structure",
            "attach_member",
            "attach_template",
            "define_structure",
            "end_structure",
            "create_template",
            "enable_multithread",
            "disable_multithread",
            "handle_js_call",
            "handle_sys_call",
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
            const NewArgs = comptime define: {
                const fields = std.meta.fields(Args);
                const extra = if (Payload == void) 0 else 1;
                var new_fields: [fields.len + extra]std.builtin.Type.StructField = undefined;
                var new_args_info = @typeInfo(Args);
                new_args_info.@"struct".fields = &new_fields;
                for (&new_fields, 0..) |*field_ptr, i| {
                    field_ptr.* = if (i < fields.len) fields[i] else .{
                        .name = std.fmt.comptimePrint("{d}", .{i}),
                        .type = *Payload,
                        .default_value_ptr = null,
                        .is_comptime = false,
                        .alignment = @alignOf(*Payload),
                    };
                }
                break :define @Type(new_args_info);
            };
            const ns = struct {
                fn call(new_args: NewArgs) Result {
                    var args: Args = undefined;
                    inline for (&args, 0..) |*arg_ptr, i| {
                        arg_ptr.* = new_args[i];
                    }
                    const retval = @call(.auto, func, args);
                    if (retval) |payload| {
                        if (new_args.len > args.len) new_args[args.len].* = payload;
                        return .ok;
                    } else |_| {
                        return .failure;
                    }
                }
            };
            @field(module.imports, name) = fn_transform.spreadArgs(ns.call, .c);
        }
    }

    fn captureString(self: *@This(), mem: *const Memory) !Value {
        const env = self.env;
        return try env.createStringUtf8(mem.bytes.?[0..mem.len]);
    }

    fn captureView(self: *@This(), mem: *const Memory, handle: usize) !Value {
        const env = self.env;
        const pi_handle = if (handle != 0) handle - self.base_address else 0;
        const args: [4]Value = .{
            try env.createUsize(@intFromPtr(mem.bytes)),
            try env.createUint32(@as(u32, @truncate(mem.len))),
            try env.getBoolean(mem.attributes.is_comptime),
            try env.createUsize(pi_handle),
        };
        return env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.capture_view orelse return error.Unexpected),
            &args,
        );
    }

    fn castView(self: *@This(), mem: *const Memory, structure: Value, handle: usize) !Value {
        const env = self.env;
        const pi_handle = if (handle != 0) handle - self.base_address else 0;
        const args: [5]Value = .{
            try env.createUsize(@intFromPtr(mem.bytes)),
            try env.createUint32(@as(u32, @truncate(mem.len))),
            try env.getBoolean(mem.attributes.is_comptime),
            structure,
            try env.createUsize(pi_handle),
        };
        return env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.cast_view orelse return error.Unexpected),
            &args,
        );
    }

    fn readSlot(self: *@This(), object: ?Value, slot: usize) !Value {
        const env = self.env;
        const result = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.read_slot orelse return error.Unexpected),
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

    fn writeSlot(self: *@This(), object: ?Value, slot: usize, value: ?Value) !void {
        const env = self.env;
        _ = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.write_slot orelse return error.Unexpected),
            &.{
                object orelse try env.getNull(),
                try env.createUint32(@as(u32, @truncate(slot))),
                value orelse try env.getNull(),
            },
        );
    }

    fn beginStructure(self: *@This(), structure: *const Structure) !Value {
        const env = self.env;
        const object = try env.createObject();
        try env.setNamedProperty(object, "type", try env.createUint32(structure.type));
        try env.setNamedProperty(object, "purpose", try env.createUint32(structure.purpose));
        try env.setNamedProperty(object, "flags", try env.createUint32(structure.flags));
        try env.setNamedProperty(object, "signature", try env.createBigintUint64(structure.signature));
        if (structure.length != missing(usize))
            try env.setNamedProperty(object, "length", try env.createUint32(@as(u32, @truncate(structure.length))));
        if (structure.byte_size != missing(usize))
            try env.setNamedProperty(object, "byteSize", try env.createUint32(@as(u32, @truncate(structure.byte_size))));
        if (structure.alignment != missing(usize))
            try env.setNamedProperty(object, "align", try env.createUint32(@as(u32, structure.alignment)));
        if (structure.name) |name|
            try env.setNamedProperty(object, "name", try env.createStringUtf8(name[0..std.mem.len(name)]));
        return try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.begin_structure orelse return error.Unexpected),
            &.{
                object,
            },
        );
    }

    fn attachMember(self: *@This(), structure: Value, member: *const Member, is_static: bool) !void {
        const env = self.env;
        const object = try env.createObject();
        try env.setNamedProperty(object, "type", try env.createUint32(member.type));
        try env.setNamedProperty(object, "flags", try env.createUint32(member.flags));
        if (member.bit_size != missing(usize))
            try env.setNamedProperty(object, "bitSize", try env.createUint32(@as(u32, @truncate(member.bit_size))));
        if (member.bit_offset != missing(usize))
            try env.setNamedProperty(object, "bitOffset", try env.createUint32(@as(u32, @truncate(member.bit_offset))));
        if (member.byte_size != missing(usize))
            try env.setNamedProperty(object, "byteSize", try env.createUint32(@as(u32, @truncate(member.byte_size))));
        if (member.slot != missing(usize))
            try env.setNamedProperty(object, "slot", try env.createUint32(@as(u32, @truncate(member.slot))));
        if (member.name) |name|
            try env.setNamedProperty(object, "name", try env.createStringUtf8(name[0..std.mem.len(name)]));
        if (member.structure) |s|
            try env.setNamedProperty(object, "structure", s);
        _ = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.attach_member orelse return error.Unexpected),
            &.{
                structure,
                object,
                try env.getBoolean(is_static),
            },
        );
    }

    fn attachTemplate(self: *@This(), structure: Value, template_obj: Value, is_static: bool) !void {
        const env = self.env;
        _ = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.attach_template orelse return error.Unexpected),
            &.{
                structure,
                template_obj,
                try env.getBoolean(is_static),
            },
        );
    }

    fn defineStructure(self: *@This(), structure: Value) !Value {
        const env = self.env;
        return try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.define_structure orelse return error.Unexpected),
            &.{
                structure,
            },
        );
    }

    fn endStructure(self: *@This(), structure: Value) !void {
        const env = self.env;
        _ = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.end_structure orelse return error.Unexpected),
            &.{
                structure,
            },
        );
    }

    fn createTemplate(self: *@This(), dv: ?Value) !Value {
        const env = self.env;
        return env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.create_template orelse return error.Unexpected),
            &.{
                dv orelse try env.getNull(),
            },
        );
    }

    fn handleJsCall(self: *@This(), call: *JsCall, in_main_thread: bool) !void {
        if (in_main_thread) {
            const env = self.env;
            const status = try env.callFunction(
                try env.getNull(),
                try env.getReferenceValue(self.js.handle_js_call orelse return error.Unexpected),
                &.{
                    try env.createUint32(@as(u32, @truncate(call.fn_id))),
                    try env.createUsize(call.arg_address),
                    try env.createUint32(@as(u32, @truncate(call.arg_size))),
                    try env.createUsize(call.futex_handle),
                },
            );
            return switch (try std.meta.intToEnum(Result, try env.getValueUint32(status))) {
                .ok => {},
                .failure_deadlock => error.Deadlock,
                else => error.Unexpected,
            };
        } else {
            const func = self.ts.handle_js_call orelse return error.Disabled;
            var futex: Futex = undefined;
            call.futex_handle = futex.init();
            try napi.callThreadsafeFunction(func, @ptrCast(@constCast(call)), .nonblocking);
            try futex.wait();
        }
    }

    fn handleSysCall(self: *@This(), call: *SysCall, in_main_thread: bool) !void {
        if (in_main_thread) {
            call.futex_handle = 0;
            switch (call.cmd) {
                .write => try self.handleWrite(call),
            }
        } else {
            const func = self.ts.handle_sys_call orelse return error.Disabled;
            var futex: Futex = undefined;
            call.futex_handle = futex.init();
            try napi.callThreadsafeFunction(func, @ptrCast(call), .nonblocking);
            try futex.wait();
        }
    }

    fn handleWrite(self: *@This(), call: *SysCall) !void {
        const env = self.env;
        const u = &call.u.write;
        _ = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.write_bytes orelse return error.Unexpected),
            &.{
                try env.createUint32(@as(u32, @truncate(u.fd))),
                try env.createUsize(@intFromPtr(u.bytes)),
                try env.createUint32(@as(u32, @truncate(u.len))),
                try env.createUsize(call.futex_handle),
            },
        );
    }

    fn releaseFunction(self: *@This(), fn_id: usize, in_main_thread: bool) !void {
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

    fn disableMultithread(self: *@This(), in_main_thread: bool) !void {
        if (in_main_thread) {
            const fields = @typeInfo(@FieldType(ModuleHost, "ts")).@"struct".fields;
            inline for (fields) |field| {
                if (@field(self.ts, field.name)) |ref|
                    try napi.releaseThreadsafeFunction(ref, .abort);
                @field(self.ts, field.name) = null;
            }
        } else {
            const func = self.ts.disable_multithread orelse return error.Disabled;
            try napi.callThreadsafeFunction(func, null, .nonblocking);
        }
    }

    const threadsafe_callback = struct {
        fn handle_js_call(_: *Env, _: Value, context: *anyopaque, data: *anyopaque) callconv(.C) void {
            const self: *ModuleHost = @ptrCast(@alignCast(context));
            const call: *JsCall = @ptrCast(@alignCast(data));
            handleJsCall(self, call, true) catch {
                // wake caller if call fails since JavaScript isn't going to do it
                Futex.wake(call.futex_handle, Result.failure) catch {};
            };
        }

        fn handle_sys_call(_: *Env, _: Value, context: *anyopaque, data: *anyopaque) callconv(.C) void {
            const self: *ModuleHost = @ptrCast(@alignCast(context));
            const call: *SysCall = @ptrCast(@alignCast(data));
            handleSysCall(self, call, true) catch {
                Futex.wake(call.futex_handle, Result.failure) catch {};
            };
        }

        fn release_function(_: *Env, _: Value, context: *anyopaque, data: *anyopaque) callconv(.C) void {
            const self: *ModuleHost = @ptrCast(@alignCast(context));
            const fn_id = @intFromPtr(data);
            releaseFunction(self, fn_id, true) catch {};
        }

        fn disable_multithread(_: *Env, _: Value, context: *anyopaque, _: *anyopaque) callconv(.C) void {
            const self: *ModuleHost = @ptrCast(@alignCast(context));
            disableMultithread(self, true) catch {};
        }
    };

    fn enableMultithread(self: *@This(), in_main_thread: bool) !void {
        if (!in_main_thread) return error.Unsupported;
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
};
const Structure = extern struct {
    name: ?[*:0]const u8,
    type: u32,
    purpose: u32,
    flags: u32,
    signature: u64,
    length: usize,
    byte_size: usize,
    alignment: u16,
};
const Member = extern struct {
    name: ?[*:0]const u8,
    type: u32,
    flags: u32,
    bit_offset: usize,
    bit_size: usize,
    byte_size: usize,
    slot: usize,
    structure: ?Value,
};
const MemberType = enum(u32) {
    void = 0,
    bool,
    int,
    uint,
    float,
    object,
    type,
    literal,
    null,
    undefined,
    unsupported,
};
const JsCall = extern struct {
    fn_id: usize,
    arg_address: usize,
    arg_size: usize,
    futex_handle: usize,
};
const Imports = extern struct {
    capture_string: *const fn (*ModuleHost, *const Memory, *Value) callconv(.C) Result,
    capture_view: *const fn (*ModuleHost, *const Memory, usize, *Value) callconv(.C) Result,
    cast_view: *const fn (*ModuleHost, *const Memory, Value, usize, *Value) callconv(.C) Result,
    read_slot: *const fn (*ModuleHost, ?Value, usize, *Value) callconv(.C) Result,
    write_slot: *const fn (*ModuleHost, ?Value, usize, ?Value) callconv(.C) Result,
    begin_structure: *const fn (*ModuleHost, *const Structure, *Value) callconv(.C) Result,
    attach_member: *const fn (*ModuleHost, Value, *const Member, bool) callconv(.C) Result,
    attach_template: *const fn (*ModuleHost, Value, Value, bool) callconv(.C) Result,
    define_structure: *const fn (*ModuleHost, Value, *Value) callconv(.C) Result,
    end_structure: *const fn (*ModuleHost, Value) callconv(.C) Result,
    create_template: *const fn (*ModuleHost, ?Value, *Value) callconv(.C) Result,
    enable_multithread: *const fn (*ModuleHost, bool) callconv(.C) Result,
    disable_multithread: *const fn (*ModuleHost, bool) callconv(.C) Result,
    handle_js_call: *const fn (*ModuleHost, *JsCall, bool) callconv(.C) Result,
    handle_sys_call: *const fn (*ModuleHost, *SysCall, bool) callconv(.C) Result,
    release_function: *const fn (*ModuleHost, usize, bool) callconv(.C) Result,
};
const Exports = extern struct {
    initialize: *const fn (*ModuleHost) callconv(.C) Result,
    deinitialize: *const fn () callconv(.C) Result,
    get_export_address: *const fn (usize, *usize) callconv(.C) Result,
    get_factory_thunk: *const fn (*usize) callconv(.C) Result,
    run_thunk: *const fn (usize, usize, usize) callconv(.C) Result,
    run_variadic_thunk: *const fn (usize, usize, usize, usize, usize) callconv(.C) Result,
    create_js_thunk: *const fn (usize, usize, *usize) callconv(.C) Result,
    destroy_js_thunk: *const fn (usize, usize, *usize) callconv(.C) Result,
    override_sys_call: *const fn (*const SysCall) callconv(.C) Result,
    wake_caller: *const fn (usize, u32) callconv(.C) Result,
};
const Module = extern struct {
    version: u32,
    attributes: ModuleAttributes,
    imports: *Imports,
    exports: *const Exports,
};
const ModuleAttributes = packed struct(u32) {
    little_endian: bool,
    runtime_safety: bool,
    libc: bool,
    _: u29 = 0,
};
const Memory = struct {
    bytes: ?[*]u8 = null,
    len: usize = 0,
    attributes: MemoryAttributes = .{},
};
const MemoryAttributes = packed struct {
    alignment: u16 = 0,
    is_const: bool = false,
    is_comptime: bool = false,
    _: u14 = 0,
};
const Result = enum(u32) {
    ok,
    failure,
    failure_deadlock,
    failure_disabled,
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

    pub fn wait(self: *@This()) !void {
        std.Thread.Futex.wait(&self.value, initial_value);
        const result: Result = @enumFromInt(self.value.load(.acquire));
        if (result != .ok) return error.Unexpected;
    }

    pub fn wake(handle: usize, result: Result) !void {
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
