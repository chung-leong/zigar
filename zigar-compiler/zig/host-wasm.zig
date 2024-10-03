const std = @import("std");
const builtin = @import("builtin");
const exporter = @import("exporter.zig");
const thunk_zig = @import("thunk-zig.zig");
const thunk_js = @import("thunk-js.zig");
const types = @import("types.zig");

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
extern fn _defineStructure(structure: Value) ?Value;
extern fn _endStructure(structure: Value) void;
extern fn _createTemplate(buffer: ?Value) ?Value;
extern fn _allocateJsThunk(controller_id: usize, fn_id: usize) usize;
extern fn _freeJsThunk(controller_id: usize, thunk_address: usize) bool;
extern fn _performJsCall(id: usize, arg_ptr: *anyopaque, arg_size: usize) thunk_js.CallResult;
extern fn _queueJsCall(id: usize, arg_ptr: *anyopaque, arg_size: usize, futex_handle: usize) thunk_js.CallResult;
extern fn _getArgAttributes() *anyopaque;
extern fn _displayPanic(bytes: ?[*]const u8, len: usize) void;

threadlocal var main_thread: bool = false;

export fn initialize() void {
    main_thread = true;
}

export fn allocateExternMemory(bin: MemoryType, len: usize, alignment: u16) ?[*]u8 {
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

export fn freeExternMemory(bin: MemoryType, bytes: [*]u8, len: usize, alignment: u16) void {
    const a = getAllocator(bin);
    const ptr_align = getPtrAlign(alignment);
    a.rawFree(bytes[0..len], ptr_align, 0);
}

export fn runThunk(
    thunk_address: usize,
    fn_address: usize,
    args: *anyopaque,
) bool {
    const thunk: thunk_zig.Thunk = @ptrFromInt(thunk_address);
    const fn_ptr: *anyopaque = @ptrFromInt(fn_address);
    return if (thunk(null, fn_ptr, args)) true else |_| false;
}

export fn runVariadicThunk(
    thunk_address: usize,
    fn_address: usize,
    arg_ptr: *anyopaque,
    attr_ptr: *const anyopaque,
    arg_count: usize,
) bool {
    const thunk: thunk_zig.VariadicThunk = @ptrFromInt(thunk_address);
    const fn_ptr: *anyopaque = @ptrFromInt(fn_address);
    return if (thunk(null, fn_ptr, arg_ptr, attr_ptr, arg_count)) true else |_| false;
}

export fn createJsThunk(controller_address: usize, fn_id: usize) usize {
    // try to use preallocated thunks within module first; if they've been used up,
    // ask JavaScript to create a new instance of this module and get a new
    // thunk from that
    const controller: thunk_js.ThunkController = @ptrFromInt(controller_address);
    if (controller(null, thunk_js.Action.create, fn_id)) |thunk_address| {
        return thunk_address;
    } else |_| {
        if (builtin.single_threaded and main_thread) {
            return _allocateJsThunk(controller_address, fn_id);
        } else {
            return 0;
        }
    }
}

export fn destroyJsThunk(controller_address: usize, fn_id: usize) bool {
    const controller: thunk_js.ThunkController = @ptrFromInt(controller_address);
    if (controller(null, thunk_js.Action.destroy, fn_id)) |_| {
        return true;
    } else |_| {
        if (builtin.single_threaded and main_thread) {
            return _freeJsThunk(controller_address, fn_id);
        } else {
            return false;
        }
    }
    return false;
}

export fn flushStdout() void {
    if (builtin.link_libc) {
        const c = @cImport({
            @cInclude("stdio.h");
        });
        _ = c.fflush(c.stdout);
    }
}

const Futex = struct {
    value: std.atomic.Value(u32),
    handle: usize = undefined,
};

export fn finalizeAsyncCall(futex_handle: usize, value: u32) void {
    // make sure futex address is valid
    const ptr: *Futex = @ptrFromInt(futex_handle);
    if (ptr.handle == futex_handle) {
        ptr.value.store(value, .release);
        std.Thread.Futex.wake(&ptr.value, 1);
    }
}

export fn getModuleAttributes() i32 {
    return @bitCast(exporter.getModuleAttributes());
}

pub fn getFactoryThunk(comptime T: type) usize {
    const factory = exporter.createRootFactory(Host, T);
    return @intFromPtr(factory);
}

pub fn panic(msg: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn {
    _displayPanic(msg.ptr, msg.len);
    std.process.abort();
}

pub const Host = struct {
    comptime context: *anyopaque = @ptrFromInt(0x1000), // dummy pointer

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
            .Struct, .Union => _insertInteger(container, key_str, @bitCast(value)),
            else => @compileError("No support for value type: " ++ @typeName(T)),
        }
    }

    pub fn beginStructure(_: Host, structure: types.Structure) !Value {
        const def = beginDefinition();
        try insertProperty(def, "name", structure.name);
        try insertProperty(def, "type", structure.type);
        try insertProperty(def, "flags", structure.flags);
        try insertProperty(def, "length", structure.length);
        try insertProperty(def, "byteSize", structure.byte_size);
        try insertProperty(def, "align", structure.alignment);
        return _beginStructure(def) orelse
            Error.unable_to_start_structure_definition;
    }

    pub fn attachMember(_: Host, structure: Value, member: types.Member, is_static: bool) !void {
        const def = beginDefinition();
        try insertProperty(def, "type", member.type);
        try insertProperty(def, "flags", member.flags);
        try insertProperty(def, "bitOffset", member.bit_offset);
        try insertProperty(def, "bitSize", member.bit_size);
        try insertProperty(def, "byteSize", member.byte_size);
        try insertProperty(def, "slot", member.slot);
        try insertProperty(def, "name", member.name);
        try insertProperty(def, "structure", member.structure);
        _attachMember(structure, def, is_static);
    }

    pub fn defineStructure(_: Host, structure: Value) !Value {
        return _defineStructure(structure) orelse
            Error.unable_to_define_structure;
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

    pub fn createMessage(self: Host, err: anyerror) ?Value {
        const err_name = @errorName(err);
        const memory = Memory.from(err_name, true);
        return self.captureString(memory) catch null;
    }

    pub fn handleJsCall(_: Host, fn_id: usize, arg_ptr: *anyopaque, arg_size: usize, _: usize, wait: bool) thunk_js.CallResult {
        if (main_thread) {
            return _performJsCall(fn_id, arg_ptr, arg_size);
        } else {
            const initial_value = 0xffff_ffff;
            var futex: Futex = undefined;
            var futex_handle: usize = 0;
            if (wait) {
                futex.value = std.atomic.Value(u32).init(initial_value);
                futex.handle = @intFromPtr(&futex);
                futex_handle = futex.handle;
            }
            var result = _queueJsCall(fn_id, arg_ptr, arg_size, futex_handle);
            if (result == .ok and wait) {
                std.Thread.Futex.wait(&futex.value, initial_value);
                result = @enumFromInt(futex.value.load(.acquire));
            }
            return result;
        }
    }
};

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

fn getAllocator(bin: MemoryType) std.mem.Allocator {
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
