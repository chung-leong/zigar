const std = @import("std");
const builtin = @import("builtin");
const exporter = @import("exporter.zig");
const thunk_zig = @import("thunk-zig.zig");
const thunk_js = @import("thunk-js.zig");
const types = @import("types.zig");
const Thread = @import("patch-wasm/thread.zig");

const Value = types.Value;
const MemoryType = types.MemoryType;
const Memory = types.Memory;
const Error = types.Error;
const ActionType = thunk_js.ActionType;
const ActionResult = thunk_js.ActionResult;

pub const Promise = types.Promise;
pub const AbortSignal = types.AbortSignal;

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
extern fn _freeJsThunk(controller_id: usize, thunk_address: usize) usize;
extern fn _performJsAction(type: ActionType, id: usize, arg_ptr: ?*anyopaque, arg_size: usize) ActionResult;
extern fn _queueJsAction(type: ActionType, id: usize, arg_ptr: ?*anyopaque, arg_size: usize, futex_handle: usize) ActionResult;
extern fn _detachThreads() void;
extern fn _displayPanic(bytes: ?[*]const u8, len: usize) void;

threadlocal var main_thread: bool = false;
var multithread: bool = false;

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

const empty_ptr: *anyopaque = @constCast(@ptrCast(&.{}));

export fn runThunk(
    thunk_address: usize,
    fn_address: usize,
    arg_address: usize,
) bool {
    const thunk: thunk_zig.Thunk = @ptrFromInt(thunk_address);
    const fn_ptr: *anyopaque = @ptrFromInt(fn_address);
    const arg_ptr: *anyopaque = if (arg_address != 0) @ptrFromInt(arg_address) else empty_ptr;
    return if (thunk(fn_ptr, arg_ptr)) true else |_| false;
}

export fn runVariadicThunk(
    thunk_address: usize,
    fn_address: usize,
    arg_address: usize,
    attr_address: usize,
    arg_count: usize,
) bool {
    const thunk: thunk_zig.VariadicThunk = @ptrFromInt(thunk_address);
    const fn_ptr: *anyopaque = @ptrFromInt(fn_address);
    const arg_ptr: *anyopaque = if (arg_address != 0) @ptrFromInt(arg_address) else empty_ptr;
    const attr_ptr: *anyopaque = if (arg_address != 0) @ptrFromInt(attr_address) else empty_ptr;
    return if (thunk(fn_ptr, arg_ptr, attr_ptr, arg_count)) true else |_| false;
}

export fn createJsThunk(controller_address: usize, fn_id: usize) usize {
    // try to use preallocated thunks within module first; if they've been used up,
    // ask JavaScript to create a new instance of this module and get a new
    // thunk from that
    const controller: thunk_js.ThunkController = @ptrFromInt(controller_address);
    if (controller(null, .create, fn_id)) |thunk_address| {
        return thunk_address;
    } else |_| {
        if (builtin.single_threaded and main_thread) {
            return _allocateJsThunk(controller_address, fn_id);
        } else {
            return 0;
        }
    }
}

export fn destroyJsThunk(controller_address: usize, thunk_address: usize) usize {
    const controller: thunk_js.ThunkController = @ptrFromInt(controller_address);
    if (controller(null, .destroy, thunk_address)) |fn_id| {
        return fn_id;
    } else |_| {
        if (builtin.single_threaded and main_thread) {
            return _freeJsThunk(controller_address, thunk_address);
        } else {
            return 0;
        }
    }
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

fn finalizeAsyncCall(futex_handle: usize, value: u32) callconv(.C) void {
    // make sure futex address is valid
    const ptr: *Futex = @ptrFromInt(futex_handle);
    if (ptr.handle == futex_handle) {
        ptr.value.store(value, .release);
        Thread.Futex.wake(&ptr.value, 1);
    }
}

comptime {
    if (!builtin.single_threaded) {
        @export(finalizeAsyncCall, .{ .name = "finalizeAsyncCall", .linkage = .weak });
    }
}

export fn getModuleAttributes() i32 {
    return @bitCast(exporter.getModuleAttributes());
}

pub fn getFactoryThunk(comptime T: type) usize {
    const host = @This();
    const factory = exporter.createRootFactory(host, T);
    return @intFromPtr(factory);
}

pub fn panic(msg: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn {
    _displayPanic(msg.ptr, msg.len);
    std.process.abort();
}

pub fn captureString(memory: Memory) !Value {
    return _captureString(memory.bytes, memory.len) orelse
        Error.UnableToCreateString;
}

pub fn captureView(memory: Memory) !Value {
    return _captureView(memory.bytes, memory.len, memory.attributes.is_comptime) orelse
        Error.UnableToCreateDataView;
}

pub fn castView(memory: Memory, structure: Value) !Value {
    return _castView(memory.bytes, memory.len, memory.attributes.is_comptime, structure) orelse
        Error.UnableToCreateObject;
}

pub fn readSlot(container: ?Value, slot: usize) !Value {
    return _readSlot(container, slot) orelse
        Error.UnableToRetrieveObject;
}

pub fn writeSlot(container: ?Value, slot: usize, value: ?Value) !void {
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
        return Error.UnableToCreateString;
    };
    switch (@typeInfo(T)) {
        .Pointer => {
            if (T == []const u8) {
                const str = _captureString(value.ptr, value.len) orelse {
                    return Error.UnableToCreateString;
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

pub fn beginStructure(structure: types.Structure) !Value {
    const def = beginDefinition();
    try insertProperty(def, "name", structure.name);
    try insertProperty(def, "type", structure.type);
    try insertProperty(def, "flags", structure.flags);
    try insertProperty(def, "length", structure.length);
    try insertProperty(def, "byteSize", structure.byte_size);
    try insertProperty(def, "align", structure.alignment);
    return _beginStructure(def) orelse
        Error.UnableToStartStructureDefinition;
}

pub fn attachMember(structure: Value, member: types.Member, is_static: bool) !void {
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

pub fn defineStructure(structure: Value) !Value {
    return _defineStructure(structure) orelse
        Error.UnableToDefineStructure;
}

pub fn attachTemplate(structure: Value, template: Value, is_static: bool) !void {
    _attachTemplate(structure, template, is_static);
}

pub fn endStructure(structure: Value) !void {
    _endStructure(structure);
}

pub fn createTemplate(dv: ?Value) !Value {
    return _createTemplate(dv) orelse
        Error.UnableToCreateStructureTemplate;
}

pub fn createMessage(err: anyerror) ?Value {
    const err_name = @errorName(err);
    const memory = Memory.from(err_name, true);
    return captureString(memory) catch null;
}

pub fn handleJsCall(_: ?*anyopaque, fn_id: usize, arg_ptr: *anyopaque, arg_size: usize, is_waiting: bool) ActionResult {
    if (main_thread) {
        return _performJsAction(.call, fn_id, arg_ptr, arg_size);
    } else {
        if (comptime builtin.single_threaded) unreachable;
        if (!multithread) {
            return .failure_disabled;
        }
        const initial_value = 0xffff_ffff;
        var futex: Futex = undefined;
        var futex_handle: usize = 0;
        if (is_waiting) {
            futex.value = std.atomic.Value(u32).init(initial_value);
            futex.handle = @intFromPtr(&futex);
            futex_handle = futex.handle;
        }
        var result = _queueJsAction(.call, fn_id, arg_ptr, arg_size, futex_handle);
        if (result == .ok and is_waiting) {
            Thread.Futex.wait(&futex.value, initial_value);
            result = @enumFromInt(futex.value.load(.acquire));
        }
        return result;
    }
}

pub fn releaseFunction(fn_ptr: anytype) !void {
    const FT = types.FnPointerTarget(@TypeOf(fn_ptr));
    const thunk_address = @intFromPtr(fn_ptr);
    const control = thunk_js.createThunkController(@This(), FT);
    const fn_id = try control(null, .get_id, thunk_address);
    if (main_thread) {
        _ = _performJsAction(.release, fn_id, null, 0);
    } else {
        if (comptime builtin.single_threaded) unreachable;
        if (!multithread) {
            return Error.MultithreadingNotEnabled;
        }
        _ = _queueJsAction(.release, fn_id, null, 0, 0);
    }
}

pub fn setMultithread(state: bool) !void {
    if (comptime builtin.single_threaded) {
        return Error.MultithreadingNotEnabled;
    }
    if (!main_thread) {
        return Error.NotInMainThread;
    }
    if (multithread != state) {
        if (state == false) {
            _detachThreads();
        }
        multithread = state;
    }
}

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

fn getPtrAlign(alignment: u16) u8 {
    return if (alignment != 0) std.math.log2_int(u16, alignment) else 0;
}
