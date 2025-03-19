const std = @import("std");
const builtin = @import("builtin");
const exporter = @import("exporter.zig");
const thunk_zig = @import("thunk-zig.zig");
const thunk_js = @import("thunk-js.zig");
const types = @import("types.zig");

const Value = types.Value;
const Result = types.Result;
const Memory = types.Memory;
const Error = types.Error;
const ActionType = thunk_js.ActionType;
const ActionResult = thunk_js.ActionResult;

pub const Promise = types.Promise;
pub const PromiseOf = types.PromiseOf;
pub const PromiseArgOf = types.PromiseArgOf;
pub const Generator = types.Generator;
pub const GeneratorOf = types.GeneratorOf;
pub const GeneratorArgOf = types.GeneratorArgOf;
pub const AbortSignal = types.AbortSignal;

pub fn WorkQueue(ns: type) type {
    return types.WorkQueue(ns, struct {});
}

extern fn _captureString(bytes: ?[*]const u8, len: usize) ?Value;
extern fn _captureView(bytes: ?[*]u8, len: usize, copy: bool) ?Value;
extern fn _castView(bytes: ?[*]u8, len: usize, copy: bool, structure: Value) ?Value;
extern fn _getViewAddress(dv: Value) usize;
extern fn _readSlot(container: ?Value, slot: usize) ?Value;
extern fn _writeSlot(container: ?Value, slot: usize, object: ?Value) void;
extern fn _beginDefinition() Value;
extern fn _insertInteger(container: Value, key: Value, value: i32, unsigned: bool) void;
extern fn _insertBigInteger(container: Value, key: Value, value: i64, unsigned: bool) void;
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
extern fn _handleJsCall(id: usize, arg_ptr: ?*anyopaque, arg_size: usize, futex_handle: usize) Result;
extern fn _releaseFunction(id: usize) void;
extern fn _displayPanic(bytes: ?[*]const u8, len: usize) void;

threadlocal var in_main_thread: bool = false;

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

var js_thunk_list = std.ArrayList(struct {
    fn_id: usize,
    address: usize,
}).init(allocator);

export fn createJsThunk(controller_address: usize, fn_id: usize) usize {
    // try to use preallocated thunks within module first; if they've been used up,
    // ask JavaScript to create a new instance of this module and get a new
    // thunk from that
    const controller: thunk_js.ThunkController = @ptrFromInt(controller_address);
    const can_allocate = builtin.single_threaded and in_main_thread;
    const thunk_address = controller(null, .create, fn_id) catch switch (can_allocate) {
        true => _allocateJsThunk(controller_address, fn_id),
        false => 0,
    };
    if (in_main_thread and thunk_address > 0) {
        js_thunk_list.append(.{ .fn_id = fn_id, .address = thunk_address }) catch {};
    }
    return thunk_address;
}

export fn destroyJsThunk(controller_address: usize, thunk_address: usize) usize {
    const controller: thunk_js.ThunkController = @ptrFromInt(controller_address);
    const can_allocate = builtin.single_threaded and in_main_thread;
    const fn_id = controller(null, .destroy, thunk_address) catch switch (can_allocate) {
        true => _freeJsThunk(controller_address, thunk_address),
        false => 0,
    };
    if (in_main_thread and fn_id > 0) {
        for (js_thunk_list.items, 0..) |item, i| {
            if (item.address == thunk_address) {
                _ = js_thunk_list.swapRemove(i);
                break;
            }
        }
    }
    return fn_id;
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
        std.Thread.Futex.wake(&ptr.value, 1);
    }
}

comptime {
    if (!builtin.single_threaded) {
        @export(&finalizeAsyncCall, .{ .name = "finalizeAsyncCall", .linkage = .weak });
    }
}

export fn getModuleAttributes() i32 {
    return @bitCast(exporter.getModuleAttributes());
}

pub fn getFactoryThunk(comptime module: type) usize {
    return @intFromPtr(exporter.getFactoryThunk(@This(), module));
}

pub fn panic(msg: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn {
    _displayPanic(msg.ptr, msg.len);
    std.process.abort();
}

pub fn captureString(memory: Memory) !Value {
    return _captureString(memory.bytes, memory.len) orelse
        Error.UnableToCreateString;
}

pub fn captureView(memory: Memory, _: @TypeOf(null)) !Value {
    return _captureView(memory.bytes, memory.len, memory.attributes.is_comptime) orelse
        Error.UnableToCreateDataView;
}

pub fn castView(memory: Memory, structure: Value, _: @TypeOf(null)) !Value {
    return _castView(memory.bytes, memory.len, memory.attributes.is_comptime, structure) orelse
        Error.UnableToCreateObject;
}

pub fn getExportHandle(comptime _: anytype) @TypeOf(null) {
    // not used on WASM side since addresses are unchanging
    return null;
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
    if (@typeInfo(T) == .optional) {
        if (value) |v| try insertProperty(container, key, v);
        return;
    }
    const key_str = _captureString(key.ptr, key.len) orelse {
        return Error.UnableToCreateString;
    };
    switch (@typeInfo(T)) {
        .pointer => {
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
        .int => |int| switch (int.bits) {
            64 => _insertBigInteger(container, key_str, @bitCast(value), int.signedness == .unsigned),
            32 => _insertInteger(container, key_str, @bitCast(value), int.signedness == .unsigned),
            else => _insertInteger(container, key_str, @intCast(value), int.signedness == .unsigned),
        },
        .@"enum" => _insertInteger(container, key_str, @intCast(@intFromEnum(value)), true),
        .bool => _insertBoolean(container, key_str, value),
        .@"struct", .@"union" => _insertInteger(container, key_str, @bitCast(value), true),
        else => @compileError("No support for value type: " ++ @typeName(T)),
    }
}

pub fn beginStructure(structure: types.Structure) !Value {
    const def = beginDefinition();
    try insertProperty(def, "name", structure.name);
    try insertProperty(def, "type", structure.type);
    try insertProperty(def, "flags", structure.flags);
    try insertProperty(def, "signature", structure.signature);
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

pub fn handleJsCall(_: ?*anyopaque, fn_id: usize, arg_ptr: *anyopaque, arg_size: usize) Result {
    const initial_value = 0xffff_ffff;
    var futex: Futex = undefined;
    const futex_handle = switch (in_main_thread) {
        true => 0,
        false => init: {
            futex.value = std.atomic.Value(u32).init(initial_value);
            futex.handle = @intFromPtr(&futex);
            break :init futex.handle;
        },
    };
    var result = _handleJsCall(fn_id, arg_ptr, arg_size, futex_handle);
    if (!in_main_thread and result == .ok) {
        if (comptime builtin.single_threaded) unreachable;
        std.Thread.Futex.wait(&futex.value, initial_value);
        result = @enumFromInt(futex.value.load(.acquire));
    }
    return result;
}

pub fn releaseFunction(fn_ptr: anytype) void {
    const thunk_address = @intFromPtr(fn_ptr);
    const fn_id = for (js_thunk_list.items) |item| {
        if (item.address == thunk_address) break item.fn_id;
    } else return;
    _releaseFunction(fn_id);
}

pub fn startMultithread() !void {}

pub fn stopMultithread() void {}

pub fn setParentThreadId(_: std.Thread.Id) void {}

const allocator = std.heap.wasm_allocator;

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
        sfa = ScratchAllocator.init(allocator, 64 * 1024);
        scratch_allocator = sfa.?.allocator();
    }
    return scratch_allocator.?;
}
