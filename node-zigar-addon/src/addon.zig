const std = @import("std");
const napi = @import("./napi.js");

export fn node_api_module_get_api_version_v_1() i32 {
    return 1;
}

export fn napi_register_module_v_1(env: *Env, exports: Value) Value {
    return createAddon(env, exports) catch null;
}

fn createAddon(env: *Env, exports: Value) !Value {
    const names = .{
        "createEnvironment",
    };
    for (names) |name| {}
}

fn createEnvironment(env: *Env, _: CallbackInfo) Value {}

const ModuleHost = struct {
    ref_count: isize = 0,
    module: *Module = undefined,
    dynlib: std.DynLib = undefined,
    base_address: usize = 0,
    env: *Env,
    js: struct {
        capture_view: Ref = null,
        cast_view: Ref = null,
        read_slot: Ref = null,
        write_slot: Ref = null,
        begin_structure: Ref = null,
        attach_member: Ref = null,
        attach_template: Ref = null,
        define_structure: Ref = null,
        end_structure: Ref = null,
        create_template: Ref = null,
        handle_js_call: Ref = null,
        release_function: Ref = null,
        write_bytes: Ref = null,
    },
    ts: struct {
        disable_multithread: ThreadsafeFunction = null,
        handle_js_call: ThreadsafeFunction = null,
        release_function: ThreadsafeFunction = null,
        write_bytes: ThreadsafeFunction = null,
    },

    // napi_value create_environment(napi_env env,
    //                               napi_callback_info info) {
    //     // compile embedded JavaScript
    //     napi_value js_module;
    //     if (!compile_javascript(env, &js_module)) {
    //         return throw_error(env, "Unable to compile embedded JavaScript");
    //     }
    //     // look for the Environment class
    //     napi_value env_name;
    //     napi_value create_env;
    //     if (napi_create_string_utf8(env, "createEnvironment", NAPI_AUTO_LENGTH, &env_name) != napi_ok
    //      || napi_get_property(env, js_module, env_name, &create_env) != napi_ok) {
    //         return throw_error(env, "Unable to find the function \"createEnvironment\"");
    //     }
    //     // create the environment
    //     napi_value js_env;
    //     napi_value null;
    //     if (napi_get_null(env, &null) != napi_ok
    //      || napi_call_function(env, null, create_env, 0, NULL, &js_env) != napi_ok) {
    //         return throw_error(env, "Unable to create runtime environment");
    //     }
    //     // export functions to the environment and import functions from it
    //     module_data* md = new_module(env);
    //     bool success = export_functions(md, js_env) && import_functions(md, js_env);
    //     release_module(env, md);
    //     if (!success) {
    //         return throw_error(env, "Unable to export/import functions");
    //     }
    //     return js_env;
    // }

    fn create(env: *Env) !*@This() {
        // compile embedded JavaScript
        const js_module = try compileJavaScript(env);
        // look for the Environment class
        const fn_name = try env.createStringUtf8(env, "createEnvironment", auto_length);
        const create_env = try env.getProperty(js_module, fn_name);
        // create the environment
        const js_env = try env.callFunction(try env.getNull(), create_env, 0, null);
        // export functions to the environment and import functions from it

    }

    fn addRef(self: *@This()) void {
        self.ref_count += 1;
    }

    fn release(self: *@This()) void {
        self.ref_count -= 1;
        if (self.ref_count == 0) {
            const env = self.env;
            const ST = @FieldType(ModuleData, "js");
            inline for (@typeInfo(ST).@"struct".fields) |field| {
                env.deleteReference(@field(self.js, field.name)) catch {};
            }
            // TODO release .so
            allocator.destroy(self);
            module_count -= 1;
        }
    }

    fn loadModule(self: *@This(), args: [1]Value) void {
        const env = self.env;
        const path_len = try env.getValueStringUtf8(args[0], null, 0);
        const path = try allocator.alloc(u8, path_len + 1);
        defer allocator.free(path);
        _ = try env.getValueStringUtf8(args[0], path, path_len + 1);
    }

    // napi_value load_module(napi_env env,
    //                        napi_callback_info info) {
    //     module_data* md;
    //     size_t argc = 1;
    //     size_t path_len;
    //     napi_value args[1];
    //     // check arguments
    //     if (napi_get_cb_info(env, info, &argc, args, NULL, (void*) &md) != napi_ok
    //      || napi_get_value_string_utf8(env, args[0], NULL, 0, &path_len) != napi_ok) {
    //         return throw_error(env, "Invalid arguments");
    //     }

    //     // load the shared library
    //     char* path = malloc(path_len + 1);
    //     napi_get_value_string_utf8(env, args[0], path, path_len + 1, &path_len);
    //     void* handle = md->so_handle = dlopen(path, RTLD_NOW);
    //     if (!handle) {
    //         return throw_error(env, "Unable to load shared library '%s'", path);
    //     }

    //     // find the zig module
    //     void* symbol = dlsym(handle, "zig_module");
    //     if (!symbol) {
    //         return throw_error(env, "Unable to find the symbol \"zig_module\"");
    //     }
    //     module* mod = md->mod = (module*) symbol;
    //     if (mod->version != 5) {
    //         return throw_error(env, "Cached module is compiled for a different version of Zigar (API = %d)", mod->version);
    //     }

    //     // set base address
    //     Dl_info dl_info;
    //     if (!dladdr(symbol, &dl_info)) {
    //         return throw_error(env, "Unable to obtain address of shared library");
    //     }
    //     md->base_address = (uintptr_t) dl_info.dli_fbase;

    //     redirect_io_functions(handle, path, mod->imports->override_write);
    //     free(path);

    //     // attach exports to module
    //     export_table* exports = mod->exports;
    //     exports->capture_string = capture_string;
    //     exports->capture_view = capture_view;
    //     exports->cast_view = cast_view;
    //     exports->read_slot = read_slot;
    //     exports->write_slot = write_slot;
    //     exports->begin_structure = begin_structure;
    //     exports->attach_member = attach_member;
    //     exports->attach_template = attach_template;
    //     exports->define_structure = define_structure;
    //     exports->end_structure = end_structure;
    //     exports->create_template = create_template;
    //     exports->enable_multithread = enable_multithread;
    //     exports->disable_multithread = disable_multithread;
    //     exports->handle_js_call = handle_js_call;
    //     exports->release_function = release_function;
    //     exports->write_bytes = write_bytes;

    //     // run initializer
    //     if (mod->imports->initialize(md) != OK) {
    //         return throw_error(env, "Initialization failed");
    //     }
    //     return get_undefined(env);
    // }

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
            // make camelCase name
            const cb = @field(@This(), name);
            const func = try env.createFunction(name, napi.auto_length, cb, @ptrCast(self));
            try env.setNamedProperty(imports, name, func);
        }
        const import_fn = try env.getNamedProperty(js_env, "importFunctions");
        const args: [1]Value = .{imports};
        _ = try env.callFunction(js_env, import_fn, args.len, &args);
    }

    fn importFunctionsFromJavaSCript(self: *@This(), js_env: Value) !void {
        const env = self.env;
        const export_fn = try env.getNamedProperty(js_env, "exportFunctions");
        const args: [0]Value = .{};
        const exports = try env.callFunction(js_env, export_fn, args.len, &args);
        const fields = @typeInfo(@FieldType(@This(), "js")).@"struct".fields;
        inline for (fields) |field| {
            const name = camelize(field.name);
            const func = try env.getNamedProperty(exports, name);
            @field(self.js, field.name) = try env.createReference(func, 1);
        }
    }

    fn finalizeExternalBuffer(_: *Env, _: *anyopaque, finalize_hint: *anyopaque) callconv(.c) void {
        const self: @This() = @ptrCast(@alignCast(finalize_hint));
        self.release();
        buffer_count -= 1;
    }

    fn captureString(self: *@This(), mem: *const Memory) !Value {
        const env = self.env;
        return env.createStringUtf8(mem.bytes, mem.len);
    }

    fn captureView(self: *@This(), mem: *const Memory, handle: usize) !Value {
        const env = self.env;
        const pi_handle = if (handle != 0) handle - self.base_address else 0;
        const args: [4]Value = .{
            try env.createUsize(@intFromPtr(mem.bytes)),
            try env.createUint32(mem.len),
            try env.getBoolean(mem.attributes.is_comptime),
            try env.createUsize(pi_handle),
        };
        return env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.capture_view),
            args.len,
            &args,
        );
    }

    fn castView(self: *@This(), mem: *const Memory, structure: Value, handle: usize) !Value {
        const env = self.env;
        const pi_handle = if (handle != 0) handle - self.base_address else 0;
        const args: [5]Value = .{
            try env.createUsize(@intFromPtr(mem.bytes)),
            try env.createUint32(mem.len),
            try env.getBoolean(mem.attributes.is_comptime),
            structure,
            try env.createUsize(pi_handle),
        };
        return env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.cast_view),
            args.len,
            &args,
        );
    }

    fn readSlot(self: *@This(), object: Value, slot: usize) !Value {
        const env = self.env;
        const args: [2]Value = .{
            object orelse try env.getNull(),
            try env.createUint32(slot),
        };
        const result = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.read_slot),
            args.len,
            &args,
        );
        return switch (try env.typeOf(result)) {
            .undefined => error.Failed,
            else => result,
        };
    }

    fn writeSlot(self: *@This(), object: Value, slot: usize, value: Value) !void {
        const env = self.env;
        const args: [3]Value = .{
            object orelse try env.getNull(),
            try env.createUint32(slot),
            value orelse try env.getNull(),
        };
        _ = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.write_slot),
            args.len,
            &args,
        );
    }

    fn beginStructure(self: *@This(), structure: Structure) !Value {
        const env = self.env;
        const object = try env.createObject();
        try env.setNamedProperty(object, "type", try env.createUint32(structure.type));
        try env.setNamedProperty(object, "flags", try env.createUint32(structure.flags));
        try env.setNamedProperty(object, "signature", try env.createUint64(structure.signature));
        if (structure.length != missing(usize))
            try env.setNamedProperty(object, "length", try env.createUint32(structure.length));
        if (structure.byte_size != missing(usize))
            try env.setNamedProperty(object, "byteSize", try env.createUint32(structure.byte_size));
        if (structure.alignment != missing(usize))
            try env.setNamedProperty(object, "align", try env.createUint32(structure.alignment));
        if (structure.name) |name|
            try env.setNamedProperty(object, "name", try env.createStringUtf8(name, napi.auto_length));
        const args: [1]Value = .{
            object,
        };
        _ = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.begin_structure),
            args.len,
            &args,
        );
    }

    fn attachMember(self: *@This(), structure: Value, member: *const Member, is_static: bool) !void {
        const env = self.env;
        const object = try env.createObject();
        try env.setNamedProperty(object, "type", try env.createUint32(member.type));
        try env.setNamedProperty(object, "flags", try env.createUint32(member.flags));
        if (member.bit_size != missing(usize))
            try env.setNamedProperty(object, "bitSize", try env.createUint32(member.bit_size));
        if (member.bit_offset != missing(usize))
            try env.setNamedProperty(object, "bitOffset", try env.createUint32(member.bit_offset));
        if (member.byte_size != missing(usize))
            try env.setNamedProperty(object, "byteSize", try env.createUint32(member.byte_size));
        if (member.slot != missing(usize))
            try env.setNamedProperty(object, "slot", try env.createUint32(member.slot));
        if (member.name) |n|
            try env.setNamedProperty(object, "name", try env.createStringUtf8(n, napi.auto_length));
        if (member.structure) |s|
            try env.setNamedProperty(object, "structure", s);
        const args: [3]Value = .{
            structure,
            object,
            try env.getBoolean(is_static),
        };
        _ = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.attach_member),
            args.len,
            &args,
        );
    }

    fn attachTemplate(self: *@This(), structure: Value, template_obj: Value, is_static: bool) !void {
        const env = self.env;
        const args: [3]Value = .{
            structure,
            template_obj,
            try env.getBoolean(is_static),
        };
        _ = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.attach_template),
            args.len,
            &args,
        );
    }

    fn defineStructure(self: *@This(), structure: Value) !Value {
        const env = self.env;
        const args: [1]Value = .{
            structure,
        };
        _ = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.define_structure),
            args.len,
            &args,
        );
    }

    fn endStructure(self: *@This(), structure: Value) !void {
        const env = self.env;
        const args: [1]Value = .{
            structure,
        };
        _ = try env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.end_structure),
            args.len,
            &args,
        );
    }

    fn createTemplate(self: *@This(), dv: Value) !Value {
        const env = self.env;
        const args: [1]Value = .{
            dv orelse try env.getNull(),
        };
        return env.callFunction(
            try env.getNull(),
            try env.getReferenceValue(self.js.create_template),
            args.len,
            &args,
        );
    }

    fn handleJsCall(self: *@This(), call: *const JsCall, in_main_thread: bool) !Result {
        if (in_main_thread) {
            const env = self.env;
            const args: [4]Value = .{
                try env.createUint32(call.fn_id),
                try env.createUsize(call.arg_address),
                try env.createUint32(call.arg_size),
                try env.createUsize(call.futex_handle),
            };
            const status = env.callFunction(
                try env.getNull(),
                try env.getReferenceValue(self.js.handle_js_call),
                args.len,
                &args,
            );
            return try std.meta.intToEnum(Result, try env.getValueUint32(status));
        } else {
            if (self.ts.handle_js_call == null) return .failure_disabled;
            try Env.callThreadsafeFunction(self.ts.handle_js_call, call, .nonblocking);
            return .ok;
        }
    }

    fn releaseFunction(self: *@This(), fn_id: usize, in_main_thread: bool) !Result {
        if (in_main_thread) {
            const env = self.env;
            const args: [1]Value = .{
                try env.createUint32(fn_id),
            };
            const status = env.callFunction(
                try env.getNull(),
                try env.getReferenceValue(self.js.release_function),
                args.len,
                &args,
            );
            return try std.meta.intToEnum(Result, try env.getValueUint32(status));
        } else {
            if (self.ts.release_function == null) return .failure_disabled;
            try Env.callThreadsafeFunction(self.ts.release_function, @ptrFromInt(fn_id), .nonblocking);
            return .ok;
        }
    }

    fn writeBytes(self: *@This(), mem: *const Memory, in_main_thread: bool) Result {
        if (in_main_thread) {
            const env = self.env;
            const args: [2]Value = .{
                try env.createUsize(@intFromPtr(mem.bytes)),
                try env.createUint32(mem.len),
            };
            const status = env.callFunction(
                try env.getNull(),
                try env.getReferenceValue(self.js.write_bytes),
                args.len,
                &args,
            );
            return try std.meta.intToEnum(Result, try env.getValueUint32(status));
        } else {
            if (self.ts.writeBytes == null) return .failure_disabled;
            const data = try allocator.alloc(@sizeOf(Memory) + mem.len);
            const copy: *Memory = @ptrCast(@alignCast(data));
            copy.* = .{
                .bytes = data.ptr + @sizeOf(Memory),
                .len = mem.len,
                .attribytes = mem.attributes,
            };
            @memcpy(copy.bytes[0..copy.len], mem.bytes[0..mem.len]);
            try Env.callThreadsafeFunction(self.ts.write_bytes, @ptrCast(data), .nonblocking);
            return .ok;
        }
    }

    fn disableMultithread(self: *@This(), in_main_thread: bool) !Result {
        if (in_main_thread) {
            const fields = @typeInfo(@FieldType(ModuleData, "ts")).@"struct".fields;
            inline for (fields) |field| {
                try Env.releaseThreadsafeFunction(@field(self.ts, field.name), .abort);
                @field(self.ts, field.name) = null;
            }
        } else {
            if (self.ts.disableMultithread == null) return .failure_disabled;
            try Env.callThreadsafeFunction(self.ts.disable_multithread, null, .nonblocking);
        }
        return .ok;
    }

    const threadsafe_callback = struct {
        fn handle_js_call(_: *Env, _: Value, context: *anyopaque, data: *anyopaque) void {
            const self: *@This() = @ptrCast(context);
            const call: *const JsCall = @ptrCast(data);
            const result = handleJsCall(self, call, true) catch .failure;
            if (result != .ok)
                self.module.imports.wake_call(call.futex_handle, result);
            return result;
        }

        fn release_function(_: *Env, _: Value, context: *anyopaque, data: *anyopaque) void {
            const self: ModuleData = @ptrCast(@alignCast(context));
            const fn_id = @intFromPtr(data);
            _ = releaseFunction(self, fn_id, true) catch .failure;
        }

        fn write_bytes(_: *Env, _: Value, context: *anyopaque, data: *anyopaque) void {
            const self: *@This() = @ptrCast(@alignCast(context));
            const mem: *const Memory = @ptrCast(@alignCast(data));
            writeBytes(self, mem, true) catch {};
            const bytes: [*]u8 = @ptrCast(data);
            const len = mem.len + @sizeOf(Memory);
            allocator.free(bytes[0..len]);
        }

        fn disable_multithread(_: *Env, _: Value, context: *anyopaque, _: *anyopaque) void {
            const self: *@This() = @ptrCast(@alignCast(context));
            disableMultithread(self, true);
        }
    };

    fn enableMultithread(self: *@This(), in_main_thread: bool) !void {
        if (!in_main_thread) return error.Unsupported;
        const env = self.env;
        const fields = @typeInfo(@FieldType(ModuleData, "ts")).@"struct".fields;
        const resource_name = try env.createStringUtf8("zigar", 5);
        inline for (fields) |field| {
            const cb = @field(threadsafe_callback, field.name);
            @field(self.ts, field.name) = try env.createThreadsafeFunction(null, null, resource_name, 0, 1, null, null, @ptrCast(self), cb);
        }
    }

    fn finalizeFunction(_: *Env, _: *anyopaque, finalize_hint: *anyopaque) callconv(.c) void {
        const self: *@This() = @ptrCast(@alignCast(finalize_hint));
        releaseModule(self);
        function_count -= 1;
    }

    fn getModuleAttributes(self: *@This(), _: [0]Value) !Value {
        const env = self.env;
        const attrs: u32 = @bitCast(self.module.attributes);
        return env.createUint32(attrs);
    }

    fn getBufferAddress(self: *@This(), args: [1]Value) !Value {
        const env = self.env;
        const bytes, _ = try env.getArraybufferInfo(args[0]);
        return env.createUsize(@intFromPtr(bytes));
    }

    fn canCreateExternalBuffer(env: *Env) bool {
        const ns = struct {
            var supported: ?bool = null;
        };
        return ns.supported orelse check: {
            const src = [1]u8{0} * 4;
            const created = if (env.createExternalArraybuffer(&src, src.len)) |_| true else |_| false;
            ns.supported = created;
            break :check created;
        };
    }

    fn obtainExternalBuffer(self: *@This(), args: [3]Value) !Value {
        const env = self.env;
        const address = try env.getValueUsize(args[0]);
        const len: usize = @intFromFloat(try env.getValueDouble(args[1]));
        const src: [*]const u8 = @ptrFromInt(address);
        const buffer = switch (canCreateExternalBuffer(env)) {
            true => try env.createExternalArraybuffer(src, len, finalizeExternalBuffer, self),
            false => create: {
                // make copy of external memory instead
                const copy, const buffer = try env.createArrayBuffer(len);
                @memcpy(copy[0..len], src[0..len]);
                // attach address as fallback property
                try env.setProperty(buffer, args[2], try env.createUsize(address));
                break :create buffer;
            },
        };
        // create a reference to the module so that the shared library doesn't get unloaded
        // while the external buffer is still around pointing to it
        addRef(self);
        buffer_count += 1;
        return buffer;
    }

    fn copy_external_bytes(self: *@This(), args: [3]Value) !void {
        const env = self.env;
        const dest_len, const dest, _, _ = try env.getDataviewInfo(args[0]);
        const address = try env.getValueUsize(args[1]);
        const len: usize = @intFromFloat(args[2]);
        if (dest_len != len) return error.LengthMismatch;
        const src: [*]u8 = @ptrFromInt(address);
        @memcpy(dest[0..dest_len], src[0..len]);
    }

    fn findSentinel(self: *@This(), args: [2]Value) !Value {
        const env = self.env;
        const address = try env.getValueUsize(args[0]);
        const sentinel_len, const sentinel, _, _ = try env.getDataviewInfo(args[1]);
        if (address > 0 and sentinel_len > 0) {
            var i: usize = 0;
            var j: usize = 0;
            const src_bytes: [*]u8 = @ptrFromInt(address);
            while (i < std.math.maxInt(u32)) {
                if (std.mem.eql(src_bytes[i .. i + sentinel_len], sentinel[0..sentinel_len]))
                    return env.createUint32(j);
                i += sentinel_len;
                j += 1;
            }
        }
        return env.createInt32(-1);
    }

    fn getFactoryThunk(self: *@This(), _: [0]Value) !Value {
        const env = self.env;
        var thunk_address: usize = 0;
        _ = self.module.imports.get_factory_thunk(&thunk_address);
        return env.createUsize(thunk_address);
    }

    fn runThunk(self: *@This(), args: [3]Value) !Value {
        const env = self.env;
        const thunk_address = try env.getValueUsize(args[0]);
        const fn_address = try env.getValueUsize(args[1]);
        const arg_address = try env.getValueUsize(args[2]);
        const result = self.module.imports.run_thunk(thunk_address, fn_address, arg_address);
        return try env.getBoolean(result == .ok);
    }

    fn runVaradicThunk(self: *@This(), args: [5]Value) !Value {
        const env = self.env;
        const thunk_address = try env.getValueUsize(args[0]);
        const fn_address = try env.getValueUsize(args[1]);
        const arg_address = try env.getValueUsize(args[2]);
        const attr_address = try env.getValueUsize(args[3]);
        const attr_len = try env.getValueU32(args[4]);
        const result = self.module.imports.run_variadic_thunk(thunk_address, fn_address, arg_address, attr_address, attr_len);
        return try env.getBoolean(result == .ok);
    }

    fn createJsThunk(self: *@This(), args: [2]Value) !Value {
        const env = self.env;
        const controller_address = try env.getValueUnsize(args[0]);
        const fn_id = try env.getValueUint32(args[1]);
        var thunk_address: usize = 0;
        _ = self.module.imports.create_js_thunk(controller_address, fn_id, &thunk_address);
        return env.createUsize(thunk_address);
    }

    fn destroyJsThunk(self: *@This(), args: [2]Value) !Value {
        const env = self.env;
        const controller_address = try env.getValueUnsize(args[0]);
        const fn_address = try env.getValueUsize(args[1]);
        var fn_id: usize = 0;
        _ = self.module.imports.destroy_js_thunk(controller_address, fn_address, &fn_id);
        return env.createUint32(fn_id);
    }

    fn createAddress(self: *@This(), args: [1]Value) !Value {
        const env = self.env;
        const handle: usize = @intFromFloat(try env.getValueDouble(args[0]));
        var address_value: usize = undefined;
        self.module.imports.get_export_address(self.base_address + handle, &address_value);
        return env.createUsize(address_value);
    }

    fn finalizeAsyncCall(self: *@This(), args: [2]Value) !void {
        const env = self.env;
        const futex_handle = try env.getValueUsize(args[0]);
        const result = try env.getValueUint32(args[1]);
        if (self.module.imports.wake_caller(futex_handle, result) != .ok) return error.Failure;
    }

    fn getNumericValue(self: *@This(), args: [3]Value) !Value {
        const env = self.env;
        const member_type = try std.meta.intToEnum(MemberType, try env.getValueUint32(args[0]));
        const bits = try env.getValueUint32(args[1]);
        const address = try env.getValueUsize(args[2]);
        return switch (member_type) {
            .int => switch (bits) {
                64 => try env.createBigInt64(@as(*i64, @ptrFromInt(address)).*),
                32 => try env.createInt32(@as(*i32, @ptrFromInt(address)).*),
                16 => try env.createInt32(@as(*i16, @ptrFromInt(address)).*),
                8 => try env.createInt32(@as(*i16, @ptrFromInt(address)).*),
                else => error.InvalidArg,
            },
            .uint => switch (bits) {
                64 => try env.createBigUint64(@as(*i64, @ptrFromInt(address)).*),
                32 => try env.createUint32(@as(*i32, @ptrFromInt(address)).*),
                16 => try env.createUint32(@as(*i16, @ptrFromInt(address)).*),
                8 => try env.createUint32(@as(*i16, @ptrFromInt(address)).*),
                else => error.InvalidArg,
            },
            .float => switch (bits) {
                64 => try env.createDouble(@as(*f64, @ptrFromInt(address)).*),
                32 => try env.createDouble(@as(*f32, @ptrFromInt(address)).*),
                else => return error.InvalidArg,
            },
            else => return error.Unexpected,
        };
    }

    fn setNumericValue(self: *@This(), args: [4]Value) !void {
        const env = self.env;
        const member_type = try std.meta.intToEnum(MemberType, try env.getValueUint32(args[0]));
        const bits = try env.getValueUint32(args[1]);
        const address = try env.getValueUsize(args[2]);
        switch (member_type) {
            .int => if (bits == 64) {
                const value, _ = try env.getValueBigintInt64(args[3]);
                @as(*i64, @ptrFromInt(address)).* = value;
            } else {
                const value = try env.getValueInt32(args[3]);
                switch (bits) {
                    32 => @as(*i32, @ptrFromInt(address)).* = value,
                    16 => @as(*i16, @ptrFromInt(address)).* = value,
                    8 => @as(*i8, @ptrFromInt(address)).* = value,
                    else => return error.InvalidArg,
                }
            },
            .uint => if (bits == 64) {
                const value, _ = try env.getValueBigintUint64(args[3]);
                @as(*u64, @ptrFromInt(address)).* = value;
            } else {
                const value = try env.getValueUint32(args[3]);
                switch (bits) {
                    32 => @as(*u32, @ptrFromInt(address)).* = value,
                    16 => @as(*u16, @ptrFromInt(address)).* = value,
                    8 => @as(*u8, @ptrFromInt(address)).* = value,
                    else => return error.InvalidArg,
                }
            },
            .float => {
                const value = try env.getValueDouble(args[3]);
                switch (bits) {
                    64 => @as(*u64, @ptrFromInt(address)).* = value,
                    32 => @as(*u32, @ptrFromInt(address)).* = value,
                    else => return error.InvalidArg,
                }
            },
            else => return error.Unexpected,
        }
    }

    fn requireBufferFallback(self: *@This(), _: [0]Value) !Value {
        const env = self.env;
        return env.getBoolean(canCreateExternalBuffer(env));
    }

    fn syncExternalBuffer(self: *@This(), args: [3]Value) !void {
        const env = self.env;
        const bytes1, const len = try env.getArraybufferInfo(args[0]);
        const address = try env.getValueUsize(args[1]);
        const to = try env.getValueBool(args[2]);
        const bytes2: [*]u8 = @ptrFromInt(address);
        if (to)
            @memcpy(bytes2[0..len], bytes1[0..len])
        else
            @memcpy(bytes1[0..len], bytes2[0..len]);
    }
};
const Structure = extern struct {
    name: ?[*:0]const u8,
    type: StructureType,
    flags: StructureFlags,
    signature: u64,
    length: usize,
    byte_size: usize,
    alignment: u16,
};
const Member = extern struct {
    name: ?[*:0]const u8,
    type: MemberType,
    flags: MemberFlags,
    bit_offset: usize,
    bit_size: usize,
    byte_size: usize,
    slot: usize,
    structure: ?Value,
};
const StructureType = enum(u32) {
    primitive = 0,
    array,
    @"struct",
    @"union",
    error_union,
    error_set,
    @"enum",
    optional,
    pointer,
    slice,
    vector,
    @"opaque",
    arg_struct,
    variadic_struct,
    function,
};
const StructureFlags = extern union {
    primitive: packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        is_size: bool = false,
        _: u27 = 0,
    },
    array: packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        has_sentinel: bool = false,
        is_string: bool = false,
        is_typed_array: bool = false,
        is_clamped_array: bool = false,

        _: u24 = 0,
    },
    @"struct": packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        is_extern: bool = false,
        is_packed: bool = false,
        is_iterator: bool = false,
        is_tuple: bool = false,

        is_allocator: bool = false,
        is_promise: bool = false,
        is_generator: bool = false,
        is_abort_signal: bool = false,

        is_optional: bool = false,
        _: u19 = 0,
    },
    @"union": packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        has_selector: bool = false,
        has_tag: bool = false,
        has_inaccessible: bool = false,
        is_extern: bool = false,

        is_packed: bool = false,
        is_iterator: bool = false,
        _: u22 = 0,
    },
    error_union: packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        _: u28 = 0,
    },
    error_set: packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        is_global: bool = false,
        _: u27 = 0,
    },
    @"enum": packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        is_open_ended: bool = false,
        is_iterator: bool = false,
        _: u26 = 0,
    },
    optional: packed struct(u32) {
        has_value: bool = true,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        has_selector: bool = false,
        _: u27 = 0,
    },
    pointer: packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = true,
        has_slot: bool = true,

        has_length: bool = false,
        is_multiple: bool = false,
        is_single: bool = false,
        is_const: bool = false,

        is_nullable: bool = false,
        _: u23 = 0,
    },
    slice: packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        has_sentinel: bool = false,
        is_string: bool = false,
        is_typed_array: bool = false,
        is_clamped_array: bool = false,

        is_opaque: bool = false,
        _: u23 = 0,
    },
    vector: packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        is_typed_array: bool = false,
        is_clamped_array: bool = false,
        _: u26 = 0,
    },
    @"opaque": packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        is_iterator: bool = false,
        _: u27 = 0,
    },
    arg_struct: packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = true,
        has_slot: bool = true,

        has_options: bool = false,
        is_throwing: bool = false,
        is_async: bool = false,
        _: u25 = 0,
    },
    variadic_struct: packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = true,
        has_slot: bool = true,

        has_options: bool = false,
        is_throwing: bool = false,
        is_async: bool = false,
        _: u25 = 0,
    },
    function: packed struct(u32) {
        has_value: bool = false,
        has_object: bool = false,
        has_pointer: bool = false,
        has_slot: bool = false,

        _: u28 = 0,
    },
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
const MemberFlags = packed struct(u32) {
    is_required: bool = false,
    is_read_only: bool = false,
    is_part_of_set: bool = false,
    is_selector: bool = false,

    is_method: bool = false,
    is_sentinel: bool = false,
    is_backing_int: bool = false,

    _: u25 = 0,
};
const JsCall = struct {
    fn_id: usize,
    arg_address: usize,
    arg_size: usize,
    futex_handle: usize,
};
const Imports = extern struct {
    capture_string: *const fn (*ModuleData, *const Memory, *Value) callconv(.C) Result,
    capture_view: *const fn (*ModuleData, *const Memory, usize, *Value) callconv(.C) Result,
    cast_view: *const fn (*ModuleData, *const Memory, Value, usize, *Value) callconv(.C) Result,
    read_slot: *const fn (*ModuleData, ?Value, usize, *Value) callconv(.C) Result,
    write_slot: *const fn (*ModuleData, ?Value, usize, ?Value) callconv(.C) Result,
    begin_structure: *const fn (*ModuleData, *const Structure, *Value) callconv(.C) Result,
    attach_member: *const fn (*ModuleData, Value, *const Member, bool) callconv(.C) Result,
    attach_template: *const fn (*ModuleData, Value, Value, bool) callconv(.C) Result,
    define_structure: *const fn (*ModuleData, Value, *Value) callconv(.C) Result,
    end_structure: *const fn (*ModuleData, Value) callconv(.C) Result,
    create_template: *const fn (*ModuleData, ?Value, *Value) callconv(.C) Result,
    enable_multithread: *const fn (*ModuleData, bool) callconv(.C) Result,
    disable_multithread: *const fn (*ModuleData, bool) callconv(.C) Result,
    handle_js_call: *const fn (*ModuleData, *const JsCall, bool) callconv(.C) Result,
    release_function: *const fn (*ModuleData, usize, bool) callconv(.C) Result,
    write_bytes: *const fn (*ModuleData, *const Memory, bool) callconv(.C) Result,
};
const Exports = extern struct {
    initialize: *const fn (*ModuleData) callconv(.C) Result,
    deinitialize: *const fn () callconv(.C) Result,
    get_export_address: *const fn (usize, *usize) callconv(.C) Result,
    get_factory_thunk: *const fn (*usize) callconv(.C) Result,
    run_thunk: *const fn (usize, usize, usize) callconv(.C) Result,
    run_variadic_thunk: *const fn (usize, usize, usize, usize, usize) callconv(.C) Result,
    create_js_thunk: *const fn (usize, usize, *usize) callconv(.C) Result,
    destroy_js_thunk: *const fn (usize, usize, *usize) callconv(.C) Result,
    override_write: *const fn ([*]const u8, usize) callconv(.C) Result,
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
const Env = napi.Env;
const Ref = napi.Ref;
const Value = napi.Value;
const CallbackInfo = napi.CallbackInfo;
const ThreadsafeFunction = napi.ThreadsafeFunction;

var module_count: usize = 0;
var buffer_count: usize = 0;
var function_count: usize = 0;

const allocator = std.heap.c_allocator;

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

fn camelize(comptime name: []const u8) []const u8 {
    var buffer: [128]u8 = undefined;
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
    return buffer[0..len];
}
