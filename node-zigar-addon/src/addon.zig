const std = @import("std");
const napi = @import("./napi.js");

const allocator = std.heap.c_allocator;
var module_count: usize = 0;
var buffer_count: usize = 0;
var function_count: usize = 0;

fn referenceModule(
    md: *ModuleData,
) void {
    md.ref_count += 1;
}

fn newModule(
    env: Env,
) !*ModuleData {
    const md = try allocator.create(ModuleData);
    md.* = .{ .env = env, .ref_count = 1 };
    module_count += 1;
    return md;
}

fn releaseModule(
    env: Env,
    md: ModuleData,
) void {
    md.ref_count -= 1;
    if (md.ref_count == 0) {
        const ST = @FieldType(ModuleData, "js");
        inline for (@typeInfo(ST).@"struct".fields) |field| {
            env.deleteReference(@field(md.js, field.name)) catch {};
        }
        // TODO release .so
        allocator.destroy(md);
        module_count -= 1;
    }
}

fn finalizeExternalBuffer(
    env: Env,
    _: *anyopaque,
    finalize_hint: *anyopaque,
) callconv(.c) void {
    const md: ModuleData = @ptrCast(@alignCast(finalize_hint));
    releaseModule(env, md);
    buffer_count -= 1;
}

fn captureString(
    md: *ModuleData,
    mem: *const Memory,
) !Value {
    const env = md.env;
    return env.createStringUtf8(mem.bytes, mem.len);
}

fn captureView(
    md: *ModuleData,
    mem: *const Memory,
    handle: usize,
) !Value {
    const env = md.env;
    const pi_handle = if (handle != 0) handle - md.base_address else 0;
    const args: [4]Value = .{
        try env.createUsize(@intFromPtr(mem.bytes)),
        try env.createUint32(mem.len),
        try env.getBoolean(mem.attributes.is_comptime),
        try env.createUsize(pi_handle),
    };
    return env.callFunction(
        try env.getNull(),
        try env.getReferenceValue(md.js.captureView),
        args.len,
        &args,
    );
}

fn castView(
    md: *ModuleData,
    mem: *const Memory,
    structure: Value,
    handle: usize,
) !Value {
    const env = md.env;
    const pi_handle = if (handle != 0) handle - md.base_address else 0;
    const args: [5]Value = .{
        try env.createUsize(@intFromPtr(mem.bytes)),
        try env.createUint32(mem.len),
        try env.getBoolean(mem.attributes.is_comptime),
        structure,
        try env.createUsize(pi_handle),
    };
    return env.callFunction(
        try env.getNull(),
        try env.getReferenceValue(md.js.castView),
        args.len,
        &args,
    );
}

fn readSlot(
    md: *ModuleData,
    object: Value,
    slot: usize,
) !Value {
    const env = md.env;
    const args: [2]Value = .{
        object orelse try env.getNull(),
        try env.createUint32(slot),
    };
    const result = try env.callFunction(
        try env.getNull(),
        try env.getReferenceValue(md.js.readSlot),
        args.len,
        &args,
    );
    return switch (try env.typeOf(result)) {
        .undefined => error.Failed,
        else => result,
    };
}

fn writeSlot(
    md: *ModuleData,
    object: Value,
    slot: usize,
    value: Value,
) !void {
    const env = md.env;
    const args: [3]Value = .{
        object orelse try env.getNull(),
        try env.createUint32(slot),
        value orelse try env.getNull(),
    };
    _ = try env.callFunction(
        try env.getNull(),
        try env.getReferenceValue(md.js.writeSlot),
        args.len,
        &args,
    );
}

fn beginStructure(
    md: *ModuleData,
    structure: Structure,
) !Value {
    const env = md.env;
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
        try env.getReferenceValue(md.js.beginStructure),
        args.len,
        &args,
    );
}

fn attachMember(
    md: *ModuleData,
    structure: Value,
    member: *const Member,
    is_static: bool,
) !void {
    const env = md.env;
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
        try env.getReferenceValue(md.js.attachMember),
        args.len,
        &args,
    );
}

fn attachTemplate(
    md: *ModuleData,
    structure: Value,
    template_obj: Value,
    is_static: bool,
) !void {
    const env = md.env;
    const args: [3]Value = .{
        structure,
        template_obj,
        try env.getBoolean(is_static),
    };
    _ = try env.callFunction(
        try env.getNull(),
        try env.getReferenceValue(md.js.attachTemplate),
        args.len,
        &args,
    );
}

fn defineStructure(
    md: *ModuleData,
    structure: Value,
) !Value {
    const env = md.env;
    const args: [1]Value = .{
        structure,
    };
    _ = try env.callFunction(
        try env.getNull(),
        try env.getReferenceValue(md.js.defineStructure),
        args.len,
        &args,
    );
}

fn endStructure(
    md: *ModuleData,
    structure: Value,
) !void {
    const env = md.env;
    const args: [1]Value = .{
        structure,
    };
    _ = try env.callFunction(
        try env.getNull(),
        try env.getReferenceValue(md.js.endStructure),
        args.len,
        &args,
    );
}

fn createTemplate(
    md: *ModuleData,
    dv: Value,
) !Value {
    const env = md.env;
    const args: [1]Value = .{
        dv orelse try env.getNull(),
    };
    return env.callFunction(
        try env.getNull(),
        try env.getReferenceValue(md.js.createTemplate),
        args.len,
        &args,
    );
}

fn getModuleAttributes(
    md: *ModuleData,
    _: [0]Value,
) !Value {
    const env = md.env;
    const attrs: u32 = @bitCast(md.module.attributes);
    return env.createUint32(attrs);
}

fn getBufferAddress(
    md: *ModuleData,
    args: [1]Value,
) !Value {
    const env = md.env;
    var bytes: [*]u8 = undefined;
    _ = try env.getArraybufferInfo(args[0], &bytes);
    return env.createUsize(@intFromPtr(bytes));
}

fn canCreateExternalBuffer(
    env: Env,
) bool {
    const ns = struct {
        var supported: ?bool = null;
    };
    return ns.supported orelse check: {
        const src = [1]u8{0} * 4;
        const buffer = env.createExternalArraybuffer(&src, src.len, null, null) orelse null;
        const created = buffer != null;
        ns.supported = created;
        break :check created;
    };
}

fn obtainExternalBuffer(
    md: *ModuleData,
    args: [3]Value,
) !Value {
    const env = md.env;
    const address = try env.getValueUsize(args[0]);
    const len: usize = @intFromFloat(try env.getValueDouble(args[1]));
    const src: [*]const u8 = @ptrFromInt(address);
    var buffer: Value = undefined;
    if (canCreateExternalBuffer(env)) {
        buffer = try env.createExternalArraybuffer(src, len, finalizeExternalBuffer, md);
    } else {
        // make copy of external memory instead
        var copy: [*]u8 = undefined;
        buffer = try env.createArrayBuffer(len, &copy);
        @memcpy(copy[0..len], src[0..len]);
        // attach address as fallback property
        try env.setProperty(buffer, args[2], try env.createUsize(address));
    }
    // create a reference to the module so that the shared library doesn't get unloaded
    // while the external buffer is still around pointing to it
    referenceModule(md);
    buffer_count += 1;
    return buffer;
}

fn copy_external_bytes(
    md: *ModuleData,
    args: [3]Value,
) !void {
    const env = md.env;
    var dest: [*]u8 = undefined;
    var dest_len: usize = undefined;
    _ = try env.getDataviewInfo(args[0], &dest_len, &dest, null);
    const address = try env.getValueUsize(args[1]);
    const len: usize = @intFromFloat(args[2]);
    if (dest_len != len) return error.LengthMismatch;
    const src: [*]u8 = @ptrFromInt(address);
    @memcpy(dest[0..dest_len], src[0..len]);
}

fn findSentinel(
    md: *ModuleData,
    args: [2]Value,
) !Value {
    const env = md.env;
    const address = try env.getValueUsize(args[0]);
    var sentinel_ptr: [*]u8 = undefined;
    var sentinel_len: usize = undefined;
    try env.getDataviewInfo(args[1], &sentinel_len, &sentinel_ptr, null, null);
    if (address > 0 and sentinel_len > 0) {
        var i: usize = 0;
        var j: usize = 0;
        const src_bytes: [*]u8 = @ptrFromInt(address);
        while (i < std.math.maxInt(u32)) {
            if (std.mem.eql(src_bytes[i .. i + sentinel_len], sentinel_ptr[0..sentinel_len]))
                return env.createUint32(j);
            i += sentinel_len;
            j += 1;
        }
    }
    return env.createInt32(-1);
}

fn getFactoryThunk(
    md: *ModuleData,
    _: [0]Value,
) !Value {
    const env = md.env;
    var thunk_address: usize = 0;
    _ = md.module.imports.get_factory_thunk(&thunk_address);
    return env.createUsize(thunk_address);
}

fn runThunk(
    md: *ModuleData,
    args: [3]Value,
) !Value {
    const env = md.env;
    const thunk_address = try env.getValueUsize(args[0]);
    const fn_address = try env.getValueUsize(args[1]);
    const arg_address = try env.getValueUsize(args[2]);
    const result = md.module.imports.run_thunk(thunk_address, fn_address, arg_address);
    return try env.getBoolean(result == .ok);
}

fn runVaradicThunk(
    md: *ModuleData,
    args: [5]Value,
) !Value {
    const env = md.env;
    const thunk_address = try env.getValueUsize(args[0]);
    const fn_address = try env.getValueUsize(args[1]);
    const arg_address = try env.getValueUsize(args[2]);
    const attr_address = try env.getValueUsize(args[3]);
    const attr_len = try env.getValueU32(args[4]);
    const result = md.module.imports.run_variadic_thunk(thunk_address, fn_address, arg_address, attr_address, attr_len);
    return try env.getBoolean(result == .ok);
}

fn createJsThunk(
    md: *ModuleData,
    args: [2]Value,
) !Value {
    const env = md.env;
    const controller_address = try env.getValueUnsize(args[0]);
    const fn_id = try env.getValueUint32(args[1]);
    var thunk_address: usize = 0;
    _ = md.module.imports.create_js_thunk(controller_address, fn_id, &thunk_address);
    return env.createUsize(thunk_address);
}

fn destroyJsThunk(
    md: *ModuleData,
    args: [2]Value,
) !Value {
    const env = md.env;
    const controller_address = try env.getValueUnsize(args[0]);
    const fn_address = try env.getValueUsize(args[1]);
    var fn_id: usize = 0;
    _ = md.module.imports.destroy_js_thunk(controller_address, fn_address, &fn_id);
    return env.createUint32(fn_id);
}

fn createAddress(
    md: *ModuleData,
    args: [1]Value,
) !Value {
    const env = md.env;
    const handle: usize = @intFromFloat(try env.getValueDouble(args[0]));
    var address_value: usize = undefined;
    md.module.imports.get_export_address(md.base_address + handle, &address_value);
    return env.createUsize(address_value);
}

fn finalizeAsyncCall(
    md: *ModuleData,
    args: [2]Value,
) !void {
    const env = md.env;
    const futex_handle = try env.getValueUsize(args[0]);
    const result = try env.getValueUint32(args[1]);
    if (md.module.imports.wake_caller(futex_handle, result) != .ok) return error.Failure;
}

fn throwError(
    env: Env,
    fmt: []const u8,
    args: anytype,
) void {
    var buffer: [1024]u8 = undefined;
    const message = std.fmt.bufPrintZ(&buffer, fmt, args);
    env.throwError(null, message) catch {};
}

fn throwLastError(
    env: Env,
) void {
    const error_info = env.getLastErrorInfo();
    const message = error_info.error_message orelse @as([:0]const u8, "Unknown error");
    throwError(env, message, .{});
}

const Env = napi.Env;
const Ref = napi.Ref;
const Value = napi.Value;
const CallbackInfo = napi.CallbackInfo;
const ThreadsafeFunction = napi.ThreadsafeFunction;
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
const JSCall = struct {
    fn_id: usize,
    arg_address: usize,
    arg_size: usize,
    futex_handle: usize,
};
const ModuleData = struct {
    ref_count: isize,
    module: *Module,
    so_handle: *anyopaque,
    base_address: usize,
    env: Env,
    js: struct {
        captureView: Ref,
        castView: Ref,
        readSlot: Ref,
        writeSlot: Ref,
        beginStructure: Ref,
        attachMember: Ref,
        attachTemplate: Ref,
        defineStructure: Ref,
        endStructure: Ref,
        createTemplate: Ref,
        handleJsCall: Ref,
        releaseFunction: Ref,
        writeBytes: Ref,
    },
    ts: struct {
        disableMultithread: ThreadsafeFunction,
        handleJsCall: ThreadsafeFunction,
        releaseFunction: ThreadsafeFunction,
        writeBytes: ThreadsafeFunction,
    },
};
const Imports = extern struct {
    capture_string: *const fn (*ModuleData, *const Memory, *Value) callconv(.C) Result,
    capture_view: *const fn (*ModuleData, *const Memory, usize, *Value) callconv(.C) Result,
    cast_view: *const fn (*ModuleData, *const Memory, Value, usize, *Value) callconv(.C) Result,
    read_slot: *const fn (*ModuleData, ?Value, usize, *Value) callconv(.C) Result,
    write_slot: *const fn (*ModuleData, ?Value, usize, ?Value) callconv(.C) Result,
    begin_structure: *const fn (*ModuleData, *const Structure, *Value) callconv(.C) Result,
    attach_member: *const fn (*ModuleData, Value, *const MemberC, bool) callconv(.C) Result,
    attach_template: *const fn (*ModuleData, Value, Value, bool) callconv(.C) Result,
    define_structure: *const fn (*ModuleData, Value, *Value) callconv(.C) Result,
    end_structure: *const fn (*ModuleData, Value) callconv(.C) Result,
    create_template: *const fn (*ModuleData, ?Value, *Value) callconv(.C) Result,
    enable_multithread: *const fn (*ModuleData, bool) callconv(.C) Result,
    disable_multithread: *const fn (*ModuleData, bool) callconv(.C) Result,
    handle_js_call: *const fn (*ModuleData, *const JSCall, bool) callconv(.C) Result,
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

fn missing(comptime T: type) comptime_int {
    return std.math.maxInt(T);
}
