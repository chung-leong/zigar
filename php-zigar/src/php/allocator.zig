const std = @import("std");

const c = @import("c.zig");
const pd = c.declarations;
const pi = c.imports;
const argCount = c.argCount;

pub fn emalloc(size: usize, comptime src: std.builtin.SourceLocation) ?*anyopaque {
    const ptr = switch (comptime argCount(@TypeOf(pi._emalloc))) {
        5 => pi._emalloc(size, src.file, src.line, null, 0),
        1 => pi._emalloc(size),
        else => @compileError("Unexpected _emalloc argument count"),
    };
    return ptr;
}

pub fn efree(ptr: ?*anyopaque, comptime src: std.builtin.SourceLocation) void {
    switch (comptime argCount(@TypeOf(pi._efree))) {
        5 => pi._efree(ptr, src.file, src.line, null, 0),
        1 => pi._efree(ptr),
        else => @compileError("Unexpected _efree argument count"),
    }
}

pub fn estrdup(s: [*:0]const u8, comptime src: std.builtin.SourceLocation) [*:0]const u8 {
    return switch (comptime argCount(@TypeOf(c.estrdup))) {
        5 => c._estrdup(s, src.file, src.line + 1, null, 0),
        1 => c._estrdup(s),
        else => @compileError("Unexpected _estrdup argument count"),
    };
}

pub fn malloc(size: usize) ?*anyopaque {
    const src = @src();
    return switch (comptime argCount(@TypeOf(pi.__zend_malloc))) {
        5 => pi.__zend_malloc(size, src.file, src.line + 1, null, 0),
        1 => pi.__zend_malloc(size),
        else => @compileError("Unexpected __zend_malloc argument count"),
    };
}

pub fn free(ptr: ?*anyopaque) void {
    c.free(ptr);
}

pub const instance: std.mem.Allocator = .{
    .ptr = undefined,
    .vtable = &allocator_impl.vtable,
};
const allocator_impl = struct {
    const vtable: std.mem.Allocator.VTable = .{
        .alloc = alloc,
        .resize = resize,
        .remap = remap,
        .free = @This().free,
    };

    fn alloc(_: *anyopaque, len: usize, alignment: std.mem.Alignment, return_address: usize) ?[*]u8 {
        _ = return_address;
        _ = alignment;
        std.debug.assert(len > 0);
        const ptr = emalloc(len, @src());
        return @ptrCast(ptr);
    }

    fn resize(_: *anyopaque, memory: []u8, alignment: std.mem.Alignment, new_len: usize, return_address: usize) bool {
        _ = alignment;
        _ = return_address;
        std.debug.assert(new_len > 0);
        if (new_len <= memory.len) {
            return true; // in-place shrink always works
        }
        return false;
    }

    fn remap(ctx: *anyopaque, memory: []u8, alignment: std.mem.Alignment, new_len: usize, return_address: usize) ?[*]u8 {
        std.debug.assert(new_len > 0);
        if (resize(ctx, memory, alignment, new_len, return_address)) {
            return memory.ptr;
        }
        return null;
    }

    fn free(_: *anyopaque, memory: []u8, alignment: std.mem.Alignment, return_address: usize) void {
        _ = return_address;
        _ = alignment;
        efree(memory.ptr, @src());
    }
};
