const std = @import("std");
const builtin = @import("builtin");

pub const c = @import("c");

pub const allocator = @import("allocator.zig").allocator;
pub const Array = @import("array.zig").Array;
pub const Callable = @import("callable.zig").Callable;
pub const ClassEntry = @import("class-entry.zig").ClassEntry;
pub const Closure = @import("closure.zig").Closure;
pub const Dictionary = @import("dictionary.zig").Dictionary;
pub const efree = @import("allocator.zig").efree;
pub const emalloc = @import("allocator.zig").emalloc;
pub const failure = @import("failure.zig");
pub const free = @import("allocator.zig").efree;
pub const Function = @import("function.zig").Function;
pub const InfoTable = @import("info-table.zig").InfoTable;
pub const malloc = @import("allocator.zig").emalloc;
pub const Module = @import("module.zig").Module;
pub const Object = @import("object.zig").Object;
pub const Reference = @import("reference.zig").Reference;
pub const Resource = @import("resource.zig").Resource;
pub const Stream = @import("stream.zig").Stream;
pub const String = @import("string.zig").String;
pub const Value = @import("value.zig").Value;

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
