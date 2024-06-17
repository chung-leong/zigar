const std = @import("std");
const exporter = @import("exporter.zig");
const builtin = @import("builtin");

pub const Value = exporter.Value;
pub const Thunk = exporter.Thunk;
pub const Call = *const CallContext;

const HostOptions = exporter.HostOptions;
const StructureType = exporter.StructureType;
const Structure = exporter.Structure;
const MemberType = exporter.MemberType;
const Member = exporter.Member;
const Method = exporter.Method;
const Memory = exporter.Memory;
const MemoryAttributes = exporter.MemoryAttributes;
const Error = exporter.Error;

const CallContext = struct {
    allocator: std.mem.Allocator,
};

extern fn _allocateHostMemory(len: usize, alignment: u16) ?Value;
extern fn _freeHostMemory(bytes: [*]u8, len: usize, alignment: u16) void;
extern fn _captureString(bytes: ?[*]const u8, len: usize) ?Value;
extern fn _captureView(bytes: ?[*]u8, len: usize, copy: bool) ?Value;
extern fn _castView(bytes: ?[*]u8, len: usize, copy: bool, structure: Value) ?Value;
extern fn _getViewAddress(dv: Value) usize;
extern fn _readSlot(container: ?Value, slot: usize) ?Value;
extern fn _writeSlot(container: ?Value, slot: usize, object: ?Value) void;
extern fn _beginDefinition() Value;
extern fn _insertInteger(container: Value, key: Value, value: i32) void;
extern fn _insertBoolean(container: Value, key: Value, value: bool) void;
extern fn _insertString(container: Value, key: Value, value: Value) void;
extern fn _insertObject(container: Value, key: Value, value: ?Value) void;
extern fn _beginStructure(def: Value) ?Value;
extern fn _attachMember(structure: Value, def: Value, is_static: bool) void;
extern fn _attachMethod(structure: Value, def: Value, is_static_only: bool) void;
extern fn _attachTemplate(structure: Value, def: Value, is_static: bool) void;
extern fn _finalizeShape(structure: Value) void;
extern fn _endStructure(structure: Value) void;
extern fn _createTemplate(buffer: ?Value) ?Value;
extern fn _startCall(call: Call, arg_struct: Value) *anyopaque;
extern fn _endCall(call: Call, arg_struct: Value) void;

const allocator: std.mem.Allocator = .{
    .ptr = undefined,
    .vtable = &std.heap.WasmAllocator.vtable,
};

fn clearBytes(bytes: [*]u8, len: usize) void {
    var start: usize = 0;
    inline for (.{ usize, u8 }) |T| {
        const mask = ~(@as(usize, @sizeOf(T)) - 1);
        const remaining = len - start;
        const count = remaining & mask;
        if (count > 0) {
            const end = start + count;
            for (std.mem.bytesAsSlice(T, bytes[start..end])) |*ptr| ptr.* = 0;
            start += count;
            if (start == len) break;
        }
    }
}

pub fn getPtrAlign(alignment: u16) u8 {
    return if (alignment != 0) std.math.log2_int(u16, alignment) else 0;
}

pub fn allocateExternMemory(len: usize, alignment: u16) ?[*]u8 {
    const ptr_align = getPtrAlign(alignment);
    if (allocator.rawAlloc(len, ptr_align, 0)) |bytes| {
        clearBytes(bytes, len);
        return bytes;
    } else {
        return null;
    }
}

pub fn freeExternMemory(bytes: [*]u8, len: usize, alignment: u16) void {
    const ptr_align = getPtrAlign(alignment);
    allocator.rawFree(bytes[0..len], ptr_align, 0);
}

pub fn allocateShadowMemory(call: Call, len: usize, alignment: u16) ?Value {
    if (len == 0) {
        return _captureView(null, len, false);
    }
    const ptr_align = getPtrAlign(alignment);
    if (call.allocator.rawAlloc(len, ptr_align, 0)) |bytes| {
        return _captureView(bytes, len, false);
    } else {
        return null;
    }
}

pub fn freeShadowMemory(call: Call, bytes: [*]u8, len: usize, alignment: u16) void {
    if (len == 0) {
        return;
    }
    const ptr_align = getPtrAlign(alignment);
    call.allocator.rawFree(bytes[0..len], ptr_align, 0);
}

pub const Host = struct {
    context: Call,
    options: HostOptions,

    pub fn init(call_ptr: *anyopaque, arg_ptr: ?*anyopaque) Host {
        const context: Call = @ptrCast(@alignCast(call_ptr));
        const options_ptr: ?*HostOptions = @ptrCast(@alignCast(arg_ptr));
        return .{ .context = context, .options = if (options_ptr) |ptr| ptr.* else .{} };
    }

    pub fn release(_: Host) void {}

    pub fn allocateMemory(_: Host, size: usize, alignment: u16) !Memory {
        if (_allocateHostMemory(size, alignment)) |dv| {
            const address = _getViewAddress(dv);
            return .{
                .bytes = @ptrFromInt(address),
                .len = size,
            };
        } else {
            return Error.unable_to_allocate_memory;
        }
    }

    pub fn freeMemory(_: Host, memory: Memory) !void {
        if (memory.bytes) |bytes| {
            _freeHostMemory(bytes, memory.len, memory.attributes.alignment);
        }
    }

    pub fn captureString(_: Host, memory: Memory) !Value {
        return _captureString(memory.bytes, memory.len) orelse
            Error.unable_to_create_string;
    }

    pub fn captureView(_: Host, memory: Memory) !Value {
        return _captureView(memory.bytes, memory.len, memory.attributes.is_comptime) orelse
            Error.unable_to_create_data_view;
    }

    pub fn castView(_: Host, memory: Memory, structure: Value) !Value {
        return _castView(memory.bytes, memory.len, memory.attributes.is_comptime, structure) orelse
            Error.unable_to_create_object;
    }

    pub fn readSlot(_: Host, container: ?Value, slot: usize) !Value {
        return _readSlot(container, slot) orelse
            Error.unable_to_retrieve_object;
    }

    pub fn writeSlot(_: Host, container: ?Value, slot: usize, value: ?Value) !void {
        _writeSlot(container, slot, value);
    }

    fn beginDefinition() Value {
        return _beginDefinition();
    }

    fn insertProperty(container: Value, key: []const u8, value: anytype) !void {
        const T = @TypeOf(value);
        if (@typeInfo(T) == .Optional) {
            if (value) |v| try insertProperty(container, key, v);
            return;
        }
        const key_str = _captureString(key.ptr, key.len) orelse {
            return Error.unable_to_create_string;
        };
        switch (@typeInfo(T)) {
            .Pointer => {
                if (T == []const u8) {
                    const str = _captureString(value.ptr, value.len) orelse {
                        return Error.unable_to_create_string;
                    };
                    _insertString(container, key_str, str);
                } else if (T == Value) {
                    _insertObject(container, key_str, value);
                } else {
                    @compileError("No support for value type: " ++ @typeName(T));
                }
            },
            .Int => _insertInteger(container, key_str, @intCast(value)),
            .Enum => _insertInteger(container, key_str, @intCast(@intFromEnum(value))),
            .Bool => _insertBoolean(container, key_str, value),
            else => @compileError("No support for value type: " ++ @typeName(T)),
        }
    }

    pub fn beginStructure(_: Host, def: Structure) !Value {
        const structure = beginDefinition();
        try insertProperty(structure, "name", def.name);
        try insertProperty(structure, "type", def.structure_type);
        try insertProperty(structure, "length", def.length);
        try insertProperty(structure, "byteSize", def.byte_size);
        try insertProperty(structure, "align", def.alignment);
        try insertProperty(structure, "isConst", def.is_const);
        try insertProperty(structure, "isTuple", def.is_tuple);
        try insertProperty(structure, "isIterator", def.is_iterator);
        try insertProperty(structure, "hasPointer", def.has_pointer);
        return _beginStructure(structure) orelse
            Error.unable_to_start_structure_definition;
    }

    pub fn attachMember(_: Host, structure: Value, member: Member, is_static: bool) !void {
        const def = beginDefinition();
        try insertProperty(def, "type", member.member_type);
        try insertProperty(def, "isRequired", member.is_required);
        try insertProperty(def, "bitOffset", member.bit_offset);
        try insertProperty(def, "bitSize", member.bit_size);
        try insertProperty(def, "byteSize", member.byte_size);
        try insertProperty(def, "slot", member.slot);
        try insertProperty(def, "name", member.name);
        try insertProperty(def, "structure", member.structure);
        _attachMember(structure, def, is_static);
    }

    pub fn finalizeShape(_: Host, structure: Value) !void {
        _finalizeShape(structure);
    }

    pub fn attachMethod(_: Host, structure: Value, method: Method, is_static_only: bool) !void {
        const def = beginDefinition();
        try insertProperty(def, "argStruct", method.structure);
        try insertProperty(def, "thunkId", method.thunk_id);
        try insertProperty(def, "name", method.name);
        _attachMethod(structure, def, is_static_only);
    }

    pub fn attachTemplate(_: Host, structure: Value, template: Value, is_static: bool) !void {
        _attachTemplate(structure, template, is_static);
    }

    pub fn endStructure(_: Host, structure: Value) !void {
        _endStructure(structure);
    }

    pub fn createTemplate(_: Host, dv: ?Value) !Value {
        return _createTemplate(dv) orelse
            Error.unable_to_create_structure_template;
    }
};

pub fn runThunk(thunk_id: usize, arg_struct: Value) ?Value {
    const fallback_allocator: std.mem.Allocator = .{ .ptr = undefined, .vtable = &std.heap.WasmAllocator.vtable };
    var stack_allocator = std.heap.stackFallback(1024 * 8, fallback_allocator);
    var call_ctx: CallContext = .{ .allocator = stack_allocator.get() };
    const arg_ptr = _startCall(&call_ctx, arg_struct);
    // function pointers in WASM are indices into function table 0
    // so the thunk_id is really the thunk itself
    const thunk: Thunk = @ptrFromInt(thunk_id);
    defer _endCall(&call_ctx, arg_struct);
    return thunk(@ptrCast(&call_ctx), arg_ptr);
}

pub fn getFactoryThunk(comptime T: type) usize {
    const factory = exporter.createRootFactory(Host, T);
    return @intFromPtr(factory);
}

pub fn isRuntimeSafetyActive() bool {
    return builtin.mode == .ReleaseSafe or builtin.mode == .Debug;
}

pub fn flushStdout() void {
    if (builtin.link_libc) {
        const c = @cImport({
            @cInclude("stdio.h");
        });
        _ = c.fflush(c.stdout);
    }
}
