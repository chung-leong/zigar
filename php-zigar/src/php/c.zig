const std = @import("std");
const builtin = @import("builtin");

const pd = @import("c");
pub const declarations = pd;

pub const pi = switch (builtin.target.os.tag) {
    // on Windows, we link symbols in PHP DLL manually
    .windows => @import("c-win32.zig"),
    else => pd,
};
pub const imports = pi;
pub const use_tsrm = @hasDecl(pd, "ZTS");

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

pub inline fn globals(comptime name: []const u8) *@field(pd, "zend_" ++ name ++ "_globals") {
    if (use_tsrm) {
        const cache_address = @intFromPtr(pi.tsrm_get_ls_cache());
        const offset = deref(@field(pi, name ++ "_globals_offset"));
        return @ptrFromInt(cache_address + offset);
    } else {
        return deref(&@field(pi, name ++ "_globals"));
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

pub extern fn set_zval_stream(*pd.zval, *const pd.php_stream) void;
pub extern fn get_stream_context(*const pd.php_stream) ?*pd.php_stream_context;
pub extern fn get_stream_resource(*const pd.php_stream) *pd.zend_resource;
pub extern fn get_stream_path(*const pd.php_stream) ?[*:0]const u8;
pub extern fn get_stream_flags(*const pd.php_stream) u32;
pub extern fn get_stream_handlers(*const pd.php_stream) *const pd.php_stream_ops;
pub extern fn get_stream_mode(*const pd.php_stream) ?[*:0]const u8;
pub extern fn get_stream_wrapper_data(*const pd.php_stream) *pd.zval;
pub extern fn get_stream_wrapper(*const pd.php_stream) *pd.php_stream_wrapper;
pub extern fn set_stream_wrapper(*pd.php_stream, *const pd.php_stream_wrapper) void;
pub extern fn set_stream_no_close(*pd.php_stream) void;
pub extern fn is_stdio_stream(*const pd.php_stream) bool;
pub extern fn get_argument_info(*const pd.zend_execute_data, *ArgPtrCountExtra) void;
pub const ArgPtrCountExtra = extern struct {
    ptr: [*]pd.zval,
    len: usize,
    extra: bool,
};
