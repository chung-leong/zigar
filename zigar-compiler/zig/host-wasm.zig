const std = @import("std");
const builtin = @import("builtin");
const exporter = @import("./exporter.zig");
const thunk_zig = @import("./thunk-zig.zig");
const thunk_js = @import("./thunk-js.zig");
const types = @import("./types.zig");

pub const Value = types.Value;
pub const MemoryType = types.MemoryType;
const Memory = types.Memory;
const Error = types.Error;

const Call = *anyopaque;

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
extern fn _attachTemplate(structure: Value, def: Value, is_static: bool) void;
extern fn _finalizeShape(structure: Value) void;
extern fn _endStructure(structure: Value) void;
extern fn _createTemplate(buffer: ?Value) ?Value;
extern fn _getArgAttributes() *anyopaque;

const allocator: std.mem.Allocator = .{
    .ptr = undefined,
    .vtable = &std.heap.WasmAllocator.vtable,
};
const ScratchAllocator = struct {
    const Self = @This();

    fallback: std.mem.Allocator,
    fba: std.heap.FixedBufferAllocator,

    pub fn init(fallback: std.mem.Allocator, size: usize) Self {
        const buf = fallback.alloc(u8, size) catch unreachable;
        return .{
            .fallback = fallback,
            .fba = std.heap.FixedBufferAllocator.init(buf),
        };
    }

    pub fn allocator(self: *Self) std.mem.Allocator {
        return .{
            .ptr = self,
            .vtable = &.{
                .alloc = alloc,
                .resize = resize,
                .free = free,
            },
        };
    }

    fn alloc(ctx: *anyopaque, len: usize, log2_ptr_align: u8, ra: usize) ?[*]u8 {
        const self: *Self = @ptrCast(@alignCast(ctx));
        const fixed = self.fba.allocator();
        if (fixed.rawAlloc(len, log2_ptr_align, ra)) |buf| {
            return buf;
        } else {
            return self.fallback.rawAlloc(len, log2_ptr_align, ra);
        }
    }

    fn resize(ctx: *anyopaque, buf: []u8, log2_buf_align: u8, new_len: usize, ra: usize) bool {
        const self: *Self = @ptrCast(@alignCast(ctx));
        if (self.fba.ownsPtr(buf.ptr)) {
            const fixed = self.fba.allocator();
            return fixed.rawResize(buf, log2_buf_align, new_len, ra);
        } else {
            return self.fallback.rawResize(buf, log2_buf_align, new_len, ra);
        }
    }

    fn free(ctx: *anyopaque, buf: []u8, log2_buf_align: u8, ra: usize) void {
        const self: *Self = @ptrCast(@alignCast(ctx));
        if (self.fba.ownsPtr(buf.ptr)) {
            const fixed = self.fba.allocator();
            return fixed.rawFree(buf, log2_buf_align, ra);
        } else {
            return self.fallback.rawFree(buf, log2_buf_align, ra);
        }
    }
};
var sfa: ?ScratchAllocator = null;
var scratch_allocator: ?std.mem.Allocator = null;

pub fn getAllocator(bin: MemoryType) std.mem.Allocator {
    return switch (bin) {
        .scratch => get: {
            if (scratch_allocator == null) {
                sfa = ScratchAllocator.init(allocator, 64 * 1024);
                scratch_allocator = sfa.?.allocator();
            }
            break :get scratch_allocator.?;
        },
        else => allocator,
    };
}

pub fn allocateExternMemory(bin: MemoryType, len: usize, alignment: u16) ?[*]u8 {
    const a = getAllocator(bin);
    const ptr_align = getPtrAlign(alignment);
    if (a.rawAlloc(len, ptr_align, 0)) |bytes| {
        if (bin == .normal) {
            clearBytes(bytes, len);
        }
        return bytes;
    } else {
        return null;
    }
}

pub fn freeExternMemory(bin: MemoryType, bytes: [*]u8, len: usize, alignment: u16) void {
    const a = getAllocator(bin);
    const ptr_align = getPtrAlign(alignment);
    a.rawFree(bytes[0..len], ptr_align, 0);
}

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

pub const Host = struct {
    comptime context: void = {},

    pub fn init(_: ?*anyopaque) Host {
        return .{};
    }

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

    pub fn beginStructure(_: Host, def: types.Structure) !Value {
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

    pub fn attachMember(_: Host, structure: Value, member: types.Member, is_static: bool) !void {
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

    pub fn createErrorMessage(self: Host, err: anyerror) !Value {
        const err_name = @errorName(err);
        const memory = Memory.from(err_name, true);
        return self.captureString(memory);
    }

    pub fn handleJsCall(ctx: thunk_js.Context, arg_ptr: *anyopaque, arg_size: usize, retval_size: usize, wait: bool) thunk_js.CallResult {
        _ = ctx;
        _ = arg_ptr;
        _ = arg_size;
        _ = retval_size;
        _ = wait;
        return .ok;
    }
};

pub fn runThunk(
    thunk_address: usize,
    fn_address: usize,
    arg_ptr: *anyopaque,
) ?Value {
    // function pointers in WASM are indices into function table 0
    // so the thunk_id is really the thunk itself
    const thunk: thunk_zig.Thunk = @ptrFromInt(thunk_address);
    return thunk(null, @ptrFromInt(fn_address), arg_ptr);
}

pub fn runVariadicThunk(
    thunk_address: usize,
    fn_address: usize,
    arg_ptr: *anyopaque,
    attr_ptr: *const anyopaque,
    arg_count: usize,
) ?Value {
    const thunk: thunk_zig.VariadicThunk = @ptrFromInt(thunk_address);
    return thunk(null, @ptrFromInt(fn_address), arg_ptr, attr_ptr, arg_count);
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
