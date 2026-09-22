const std = @import("std");

const php = @import("root.zig");
const argCount = php.argCount;
const pi = php.imports;

pub const vtable: std.mem.Allocator.VTable = .{
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

pub fn emalloc(size: usize, comptime src: std.builtin.SourceLocation) [*]u8 {
    const ptr = switch (comptime argCount(@TypeOf(pi._emalloc))) {
        5 => pi._emalloc(size, src.file, src.line, null, 0),
        1 => pi._emalloc(size),
        else => @compileError("Unexpected _emalloc argument count"),
    };
    return @ptrCast(ptr);
}

pub fn efree(ptr: *anyopaque, comptime src: std.builtin.SourceLocation) void {
    switch (comptime argCount(@TypeOf(pi._efree))) {
        5 => pi._efree(ptr, src.file, src.line, null, 0),
        1 => pi._efree(ptr),
        else => @compileError("Unexpected _efree argument count"),
    }
}

pub fn malloc(size: usize) [*]u8 {
    const src = @src();
    const ptr = switch (comptime argCount(@TypeOf(pi.__zend_malloc))) {
        5 => pi.__zend_malloc(size, src.file, src.line + 1, null, 0),
        1 => pi.__zend_malloc(size),
        else => @compileError("Unexpected __zend_malloc argument count"),
    };
    return @ptrCast(ptr);
}
