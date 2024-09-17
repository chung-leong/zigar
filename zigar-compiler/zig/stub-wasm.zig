const std = @import("std");
const host = @import("./host-wasm.zig");

const Value = host.Value;
const MemoryType = host.MemoryType;

export fn allocateExternMemory(bin: MemoryType, len: usize, alignment: u16) ?[*]u8 {
    return host.allocateExternMemory(bin, len, alignment);
}

export fn freeExternMemory(bin: MemoryType, bytes: [*]u8, len: usize, alignment: u16) void {
    host.freeExternMemory(bin, bytes, len, alignment);
}

export fn getFactoryThunk() usize {
    return host.getFactoryThunk(@import("module"));
}

export fn runThunk(thunk_address: usize, fn_address: usize, arg_ptr: *anyopaque) bool {
    return host.runThunk(thunk_address, fn_address, arg_ptr);
}

export fn runVariadicThunk(thunk_address: usize, fn_address: usize, arg_ptr: *anyopaque, attr_ptr: *const anyopaque, arg_count: usize) bool {
    return host.runVariadicThunk(thunk_address, fn_address, arg_ptr, attr_ptr, arg_count);
}

export fn getModuleAttributes() i32 {
    return host.getModuleAttributes();
}

export fn flushStdout() void {
    host.flushStdout();
}

pub fn panic(msg: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn {
    std.debug.print("{s}\n", .{msg});
    return std.process.abort();
}
