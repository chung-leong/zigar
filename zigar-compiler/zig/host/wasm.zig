const std = @import("std");
const wasm_allocator = std.heap.wasm_allocator;
const E = std.os.wasi.errno_t;
const builtin = @import("builtin");

const exporter = @import("../exporter.zig");
const Value = exporter.Value;
const js_fn = @import("../thunk/js-fn.zig");
const zig_fn = @import("../thunk/zig-fn.zig");
pub const AbortSignal = @import("../type/abort-signal.zig").AbortSignal;
pub const Generator = @import("../type/generator.zig").Generator;
pub const GeneratorOf = @import("../type/generator.zig").GeneratorOf;
pub const GeneratorArgOf = @import("../type/generator.zig").GeneratorArgOf;
pub const Promise = @import("../type/promise.zig").Promise;
pub const PromiseOf = @import("../type/promise.zig").PromiseOf;
pub const PromiseArgOf = @import("../type/promise.zig").PromiseArgOf;
const util = @import("../type/util.zig");

const stdio_h = @cImport({
    @cInclude("stdio.h");
});

pub fn WorkQueue(ns: type) type {
    return @import("../type/work-queue.zig").WorkQueue(ns, struct {});
}

threadlocal var in_main_thread: bool = false;

pub fn createBool(initializer: bool) !Value {
    return _createBool(initializer);
}

pub fn createInteger(initializer: i32, is_unsigned: bool) !Value {
    return _createInteger(initializer, is_unsigned);
}

pub fn createBigInteger(initializer: i64, is_unsigned: bool) !Value {
    return _createBigInteger(initializer, is_unsigned);
}

pub fn createString(initializer: []const u8) !Value {
    return _createString(initializer.ptr, initializer.len);
}

pub fn createView(bytes: ?[*]const u8, len: usize, copying: bool, _: @TypeOf(null)) !Value {
    return _createView(bytes, len, copying);
}

pub fn createInstance(structure: Value, dv: Value, slots: ?Value) !Value {
    return _createInstance(structure, dv, slots);
}

pub fn createTemplate(dv: ?Value, slots: ?Value) !Value {
    return _createTemplate(dv, slots);
}

pub fn createList() !Value {
    return _createList();
}

pub fn createObject() !Value {
    return _createObject();
}

pub fn getProperty(object: Value, key: []const u8) !Value {
    return _getProperty(object, key.ptr, key.len) orelse error.UnableToGetProperty;
}

pub fn setProperty(object: Value, key: []const u8, value: Value) !void {
    return _setProperty(object, key.ptr, key.len, value);
}

pub fn getSlotValue(object: ?Value, slot: usize) !Value {
    return _getSlotValue(object, slot) orelse error.UnableToGetSlotValue;
}

pub fn setSlotValue(object: ?Value, slot: usize, value: Value) !void {
    return _setSlotValue(object, slot, value);
}

pub fn appendList(list: Value, value: Value) !void {
    return _appendList(list, value);
}

pub fn getExportHandle(comptime _: anytype) @TypeOf(null) {
    // not used on WASM side since addresses are unchanging
    return null;
}

pub fn beginStructure(structure: Value) !void {
    return _beginStructure(structure);
}

pub fn finishStructure(structure: Value) !void {
    return _finishStructure(structure);
}

pub fn handleJscall(fn_id: usize, arg_ptr: *anyopaque, arg_size: usize) E {
    return _handleJscall(fn_id, arg_ptr, arg_size);
}

pub fn releaseFunction(fn_ptr: anytype) void {
    const FT = util.FnPointerTarget(@TypeOf(fn_ptr));
    const thunk_address = @intFromPtr(fn_ptr);
    const control = js_fn.createThunkController(@This(), FT);
    const controller_address = @intFromPtr(control);
    const fn_id = identifyJsThunk(controller_address, thunk_address);
    _releaseFunction(fn_id);
}

pub fn startMultithread() !void {}

pub fn stopMultithread() void {}

pub fn redirectIO(_: *const anyopaque) !void {
    return error.NoSupport;
}

const empty_ptr: *anyopaque = @ptrCast(@constCast(&.{}));

export fn runThunk(
    thunk_address: usize,
    fn_address: usize,
    arg_address: usize,
) bool {
    const thunk: zig_fn.Thunk = @ptrFromInt(thunk_address);
    const fn_ptr: *anyopaque = @ptrFromInt(fn_address);
    const arg_ptr: *anyopaque = if (arg_address != 0) @ptrFromInt(arg_address) else empty_ptr;
    thunk(fn_ptr, arg_ptr) catch return false;
    if (builtin.link_libc) _ = stdio_h.fflush(stdio_h.stdout);
    return true;
}

export fn runVariadicThunk(
    thunk_address: usize,
    fn_address: usize,
    arg_address: usize,
    attr_address: usize,
    arg_count: usize,
) bool {
    const thunk: zig_fn.VariadicThunk = @ptrFromInt(thunk_address);
    const fn_ptr: *anyopaque = @ptrFromInt(fn_address);
    const arg_ptr: *anyopaque = if (arg_address != 0) @ptrFromInt(arg_address) else empty_ptr;
    const attr_ptr: *anyopaque = if (arg_address != 0) @ptrFromInt(attr_address) else empty_ptr;
    thunk(fn_ptr, arg_ptr, attr_ptr, arg_count) catch return false;
    if (builtin.link_libc) _ = stdio_h.fflush(stdio_h.stdout);
    return true;
}

export fn createJsThunk(controller_address: usize, fn_id: usize) usize {
    // try to use preallocated thunks within module first; if they've been used up,
    // ask JavaScript to create a new instance of this module and get a new
    // thunk from that
    const controller: js_fn.ThunkController = @ptrFromInt(controller_address);
    const can_allocate = builtin.single_threaded and in_main_thread;
    const thunk_address = controller(.create, fn_id) catch switch (can_allocate) {
        true => _allocateJsThunk(controller_address, fn_id),
        false => 0,
    };
    return thunk_address;
}

export fn destroyJsThunk(controller_address: usize, thunk_address: usize) usize {
    const controller: js_fn.ThunkController = @ptrFromInt(controller_address);
    const can_allocate = builtin.single_threaded and in_main_thread;
    const fn_id = controller(.destroy, thunk_address) catch switch (can_allocate) {
        true => _freeJsThunk(controller_address, thunk_address),
        false => 0,
    };
    return fn_id;
}

export fn identifyJsThunk(controller_address: usize, thunk_address: usize) usize {
    const controller: js_fn.ThunkController = @ptrFromInt(controller_address);
    const can_allocate = builtin.single_threaded and in_main_thread;
    const fn_id = controller(.identify, thunk_address) catch switch (can_allocate) {
        true => _findJsThunk(controller_address, thunk_address),
        false => 0,
    };
    return fn_id;
}

export fn initialize() void {
    in_main_thread = true;
}

export fn allocateScratchMemory(len: usize, byte_align: u16) ?[*]u8 {
    const a = getScratchAllocator();
    const alignment = std.mem.Alignment.fromByteUnits(@max(1, byte_align));
    if (a.rawAlloc(len, alignment, 0)) |bytes| {
        return bytes;
    } else {
        return null;
    }
}

export fn freeScratchMemory(bytes: [*]u8, len: usize, byte_align: u16) void {
    const a = getScratchAllocator();
    const alignment = std.mem.Alignment.fromByteUnits(@max(1, byte_align));
    a.rawFree(bytes[0..len], alignment, 0);
}

export fn getModuleAttributes() u32 {
    const attributes: packed struct(u32) {
        little_endian: bool = builtin.target.cpu.arch.endian() == .little,
        runtime_safety: bool = switch (builtin.mode) {
            .Debug, .ReleaseSafe => true,
            else => false,
        },
        libc: bool = builtin.link_libc,
        io_redirection: bool = exporter.options.use_redirection,
        _: u28 = 0,
    } = .{};
    return @bitCast(attributes);
}

pub fn getFactoryThunk(comptime module: type) usize {
    return @intFromPtr(exporter.getFactoryThunk(@This(), module));
}

pub fn panic(msg: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn {
    _displayPanic(msg.ptr, msg.len);
    std.process.abort();
}

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
                .remap = remap,
                .free = free,
            },
        };
    }

    fn alloc(ctx: *anyopaque, len: usize, alignment: std.mem.Alignment, ra: usize) ?[*]u8 {
        const self: *Self = @ptrCast(@alignCast(ctx));
        const fixed = self.fba.allocator();
        if (fixed.rawAlloc(len, alignment, ra)) |buf| {
            return buf;
        } else {
            return self.fallback.rawAlloc(len, alignment, ra);
        }
    }

    fn resize(ctx: *anyopaque, buf: []u8, alignment: std.mem.Alignment, new_len: usize, ra: usize) bool {
        const self: *Self = @ptrCast(@alignCast(ctx));
        if (self.fba.ownsPtr(buf.ptr)) {
            const fixed = self.fba.allocator();
            return fixed.rawResize(buf, alignment, new_len, ra);
        } else {
            return self.fallback.rawResize(buf, alignment, new_len, ra);
        }
    }

    fn free(ctx: *anyopaque, buf: []u8, alignment: std.mem.Alignment, ra: usize) void {
        const self: *Self = @ptrCast(@alignCast(ctx));
        if (self.fba.ownsPtr(buf.ptr)) {
            const fixed = self.fba.allocator();
            return fixed.rawFree(buf, alignment, ra);
        } else {
            return self.fallback.rawFree(buf, alignment, ra);
        }
    }

    fn remap(ctx: *anyopaque, buf: []u8, alignment: std.mem.Alignment, new_len: usize, ra: usize) ?[*]u8 {
        const self: *Self = @ptrCast(@alignCast(ctx));
        if (self.fba.ownsPtr(buf.ptr)) {
            const fixed = self.fba.allocator();
            return fixed.rawRemap(buf, alignment, new_len, ra);
        } else {
            return self.fallback.rawRemap(buf, alignment, new_len, ra);
        }
    }
};
var sfa: ?ScratchAllocator = null;
var scratch_allocator: ?std.mem.Allocator = null;

fn getScratchAllocator() std.mem.Allocator {
    if (scratch_allocator == null) {
        sfa = ScratchAllocator.init(wasm_allocator, 64 * 1024);
        scratch_allocator = sfa.?.allocator();
    }
    return scratch_allocator.?;
}

comptime {
    if (builtin.link_libc) @export(&initializeLibc, .{ .name = "initializeLibc" });
}

var env_variable_list: ?[]?[*:0]u8 = null;
var env_variable_bytes: ?[]u8 = null;

fn initializeLibc() callconv(.c) void {
    if (env_variable_list) |list| {
        wasm_allocator.free(list);
        env_variable_list = null;
    }
    if (env_variable_bytes) |bytes| {
        wasm_allocator.free(bytes);
        env_variable_bytes = null;
    }
    var count: usize = undefined;
    var len: usize = undefined;
    if (std.os.wasi.environ_sizes_get(&count, &len) != .SUCCESS) {
        count = 1;
        len = 0;
    }
    const list = wasm_allocator.alloc(?[*:0]u8, count + 1) catch unreachable;
    const bytes = wasm_allocator.alloc(u8, len) catch unreachable;
    if (count > 0) {
        if (std.os.wasi.environ_get(@ptrCast(list.ptr), bytes.ptr) != .SUCCESS) unreachable;
    }
    list[count] = null;
    std.c.environ = @ptrCast(list.ptr);
    env_variable_list = list;
    env_variable_bytes = bytes;
}

extern fn _createBool(initializer: bool) Value;
extern fn _createInteger(initializer: i32, is_unsigned: bool) Value;
extern fn _createBigInteger(initializer: i64, is_unsigned: bool) Value;
extern fn _createString(initializer: [*]const u8, len: usize) Value;
extern fn _createView(bytes: ?[*]const u8, len: usize, copying: bool) Value;
extern fn _createInstance(structure: Value, dv: Value, slots: ?Value) Value;
extern fn _createTemplate(dv: ?Value, slots: ?Value) Value;
extern fn _createList() Value;
extern fn _createObject() Value;
extern fn _getProperty(object: Value, key: [*]const u8, key_len: usize) ?Value;
extern fn _setProperty(object: Value, key: [*]const u8, key_len: usize, value: Value) void;
extern fn _getSlotValue(object: ?Value, slot: usize) ?Value;
extern fn _setSlotValue(object: ?Value, slot: usize, value: Value) void;
extern fn _appendList(list: Value, value: Value) void;
extern fn _beginStructure(structure: Value) void;
extern fn _finishStructure(structure: Value) void;
extern fn _handleJscall(fn_id: usize, arg_ptr: *anyopaque, arg_size: usize) E;
extern fn _releaseFunction(fn_id: usize) void;
extern fn _allocateJsThunk(controller_address: usize, fn_id: usize) usize;
extern fn _freeJsThunk(controller_address: usize, thunk_address: usize) usize;
extern fn _findJsThunk(controller_address: usize, thunk_address: usize) usize;
extern fn _displayPanic(bytes: [*]const u8, len: usize) void;

comptime {
    if (exporter.options.use_pthread_emulation) {
        const pthread = @import("wasm/pthread.zig");
        for (std.meta.declarations(pthread)) |decl| {
            @export(&@field(pthread, decl.name), .{ .name = decl.name, .visibility = .hidden });
        }
    }
}
