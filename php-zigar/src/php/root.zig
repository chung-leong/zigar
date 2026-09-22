const std = @import("std");
const builtin = @import("builtin");

pub const c = @import("c");

pub const allocator = @import("Allocator.zig").allocator;
pub const Array = @import("Array.zig").Array;
pub const Callable = @import("Callable.zig").Callable;
pub const ClassEntry = @import("ClassEntry.zig").ClassEntry;
pub const Dictionary = @import("Dictionary.zig").Dictionary;
pub const efree = @import("Allocator.zig").efree;
pub const emalloc = @import("Allocator.zig").emalloc;
pub const failure = @import("failure.zig");
pub const free = @import("Allocator.zig").efree;
pub const Function = @import("Function.zig").Function;
pub const InfoTable = @import("InfoTable.zig").InfoTable;
pub const malloc = @import("Allocator.zig").emalloc;
pub const Module = @import("Module.zig").Module;
pub const Object = @import("Object.zig").Object;
pub const Reference = @import("Reference.zig").Reference;
pub const Resource = @import("Resource.zig").Resource;
pub const Stream = @import("Stream.zig").Stream;
pub const String = @import("String.zig").String;
pub const Value = @import("Value.zig").Value;

pub const api_no = c.ZEND_MODULE_API_NO + 0;
pub const build_id = std.fmt.comptimePrint("API{d}{s}{s}{s}{s}", .{
    c.ZEND_MODULE_API_NO,
    c.ZEND_BUILD_TS,
    c.ZEND_BUILD_DEBUG,
    c.ZEND_BUILD_SYSTEM,
    c.ZEND_BUILD_EXTRA,
});
pub const debug = c.ZEND_DEBUG != 0;
pub const use_tsrm = @hasDecl(c, "ZTS");

pub const imports = switch (builtin.target.os.tag) {
    // on Windows, we link symbols in PHP DLL manually
    .windows => @import("win32-imports.zig"),
    else => c,
};
pub const linkWindowsImports = switch (builtin.target.os.tag) {
    .windows => imports.link,
    else => {},
};

// while function pointer dereference automatically, manually linked data variables
// need to be dereferenced manually
pub inline fn deref(arg: anytype) switch (builtin.target.os.tag) {
    .windows => @TypeOf(arg.*),
    else => @TypeOf(arg),
} {
    return switch (builtin.target.os.tag) {
        .windows => arg.*,
        else => arg,
    };
}

pub inline fn globals(comptime name: []const u8) *@field(c, "zend_" ++ name ++ "_globals") {
    if (use_tsrm) {
        const cache_address = @intFromPtr(imports.tsrm_get_ls_cache());
        const offset = deref(@field(imports, name ++ "_globals_offset"));
        return @ptrFromInt(cache_address + offset);
    } else {
        return deref(&@field(imports, name ++ "_globals"));
    }
}

pub fn throwException(obj: *Object) error{ExceptionThrown} {
    const value: Value = .fromObject(obj);
    imports.zend_throw_exception_object(@ptrCast(@constCast(&value)));
    return error.ExceptionThrown;
}

pub fn exceptionThrown() bool {
    const eg = globals("executor");
    return eg.exception != null;
}

pub fn zendCast(ptr: anytype) ZendTypePointer(@TypeOf(ptr)) {
    return @ptrCast(ptr);
}

fn ZendTypePointer(comptime Ptr: type) type {
    switch (@typeInfo(Ptr)) {
        .pointer => |pt| {
            const Impl = switch (@typeInfo(pt.child)) {
                .@"struct" => |st| get: {
                    if (st.field_types.len != 1) @compileError("Pointer to struct type with a single field expected, received: " ++ @typeName(Ptr));
                    break :get st.field_types[0];
                },
                else => @compileError("Pointer to struct type expected, received: " ++ @typeName(Ptr)),
            };
            return @Pointer(pt.size, pt.attrs, Impl, null);
        },
        else => @compileError("Pointer expected, received: " ++ @typeName(Ptr)),
    }
}

pub fn argCount(comptime Func: type) usize {
    return switch (@typeInfo(Func)) {
        .pointer => |pt| argCount(pt.child),
        .@"fn" => @typeInfo(Func).@"fn".param_types.len,
        else => @compileError("Not a function or function pointer"),
    };
}
