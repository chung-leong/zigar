const std = @import("std");
const allocator = std.heap.wasm_allocator;
const E = std.os.wasi.errno_t;
const builtin = @import("builtin");

const exporter = @import("./exporter.zig");
const thunk_js = @import("./thunk-js.zig");
const thunk_zig = @import("./thunk-zig.zig");
const types = @import("./types.zig");
const AnyValue = types.AnyValue;
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

threadlocal var in_main_thread: bool = false;

pub fn createBool(initializer: bool) !AnyValue {
    return _createBool(initializer);
}

pub fn createInteger(initializer: i32, is_unsigned: bool) !AnyValue {
    return _createInteger(initializer, is_unsigned);
}

pub fn createBigInteger(initializer: i64, is_unsigned: bool) !AnyValue {
    return _createBigInteger(initializer, is_unsigned);
}

pub fn createString(initializer: []const u8) !AnyValue {
    return _createString(initializer.ptr, initializer.len);
}

pub fn createView(bytes: ?[*]const u8, len: usize, copying: bool, _: @TypeOf(null)) !AnyValue {
    return _createView(bytes, len, copying);
}

pub fn createInstance(structure: AnyValue, dv: AnyValue, slots: ?AnyValue) !AnyValue {
    return _createInstance(structure, dv, slots);
}

pub fn createTemplate(dv: ?AnyValue, slots: ?AnyValue) !AnyValue {
    return _createTemplate(dv, slots);
}

pub fn createList() !AnyValue {
    return _createList();
}

pub fn createObject() !AnyValue {
    return _createObject();
}

pub fn getProperty(object: AnyValue, key: []const u8) !AnyValue {
    return _getProperty(object, key.ptr, key.len) orelse error.UnableToGetProperty;
}

pub fn setProperty(object: AnyValue, key: []const u8, value: AnyValue) !void {
    return _setProperty(object, key.ptr, key.len, value);
}

pub fn getSlotValue(object: ?AnyValue, slot: usize) !AnyValue {
    return _getSlotValue(object, slot) orelse error.UnableToGetSlotValue;
}

pub fn setSlotValue(object: ?AnyValue, slot: usize, value: AnyValue) !void {
    return _setSlotValue(object, slot, value);
}

pub fn appendList(list: AnyValue, value: AnyValue) !void {
    return _appendList(list, value);
}

pub fn getExportHandle(comptime _: anytype) @TypeOf(null) {
    // not used on WASM side since addresses are unchanging
    return null;
}

pub fn beginStructure(structure: AnyValue) !void {
    return _beginStructure(structure);
}

pub fn finishStructure(structure: AnyValue) !void {
    return _finishStructure(structure);
}

pub fn handleJscall(fn_id: usize, arg_ptr: *anyopaque, arg_size: usize) E {
    return _handleJscall(fn_id, arg_ptr, arg_size);
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
    const thunk_address = controller(.create, fn_id) catch switch (can_allocate) {
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
    const fn_id = controller(.destroy, thunk_address) catch switch (can_allocate) {
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
        sfa = ScratchAllocator.init(allocator, 64 * 1024);
        scratch_allocator = sfa.?.allocator();
    }
    return scratch_allocator.?;
}

extern fn _createBool(initializer: bool) AnyValue;
extern fn _createInteger(initializer: i32, is_unsigned: bool) AnyValue;
extern fn _createBigInteger(initializer: i64, is_unsigned: bool) AnyValue;
extern fn _createString(initializer: [*]const u8, len: usize) AnyValue;
extern fn _createView(bytes: ?[*]const u8, len: usize, copying: bool) AnyValue;
extern fn _createInstance(structure: AnyValue, dv: AnyValue, slots: ?AnyValue) AnyValue;
extern fn _createTemplate(dv: ?AnyValue, slots: ?AnyValue) AnyValue;
extern fn _createList() AnyValue;
extern fn _createObject() AnyValue;
extern fn _getProperty(object: AnyValue, key: [*]const u8, key_len: usize) ?AnyValue;
extern fn _setProperty(object: AnyValue, key: [*]const u8, key_len: usize, value: AnyValue) void;
extern fn _getSlotValue(object: ?AnyValue, slot: usize) ?AnyValue;
extern fn _setSlotValue(object: ?AnyValue, slot: usize, value: AnyValue) void;
extern fn _appendList(list: AnyValue, value: AnyValue) void;
extern fn _beginStructure(structure: AnyValue) void;
extern fn _finishStructure(structure: AnyValue) void;
extern fn _handleJscall(fn_id: usize, arg_ptr: *anyopaque, arg_size: usize) E;
extern fn _releaseFunction(fn_id: usize) void;
extern fn _allocateJsThunk(controller_address: usize, fn_id: usize) usize;
extern fn _freeJsThunk(controller_address: usize, thunk_address: usize) usize;
extern fn _displayPanic(bytes: [*]const u8, len: usize) void;
