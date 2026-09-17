const std = @import("std");
const builtin = @import("builtin");

const pd = @import("c");
pub const declarations = pd;

// on Windows, we link symbols in PHP DLL manually
pub const pi = switch (builtin.target.os.tag) {
    .windows => @import("c-win32.zig"),
    else => pd,
};

pub const imports = pi;

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

// TODO: just use @ptrCast() once code is more or less done to reduce amount of comptime calculations
pub fn castTo(comptime T: type, ptr: anytype) PtrWithSameConstAs(T, @TypeOf(ptr)) {
    const pt = @typeInfo(@TypeOf(ptr)).pointer;
    const Impl = ImplementationOf(T);
    if (pt.child != Impl) @compileError("Pointer to '" ++ @typeName(Impl) ++ "' expected, received: " ++ @typeName(@TypeOf(ptr)));
    return @ptrCast(ptr);
}

pub fn castFrom(comptime T: type, ptr: anytype) PtrWithSameConstAs(ImplementationOf(T), @TypeOf(ptr)) {
    const pt = @typeInfo(@TypeOf(ptr)).pointer;
    if (pt.child != T) @compileError("Pointer to '" ++ @typeName(T) ++ "' expected, received: " ++ @typeName(@TypeOf(ptr)));
    return @ptrCast(ptr);
}

fn ImplementationOf(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .@"struct" => |st| get: {
            if (st.field_types.len != 1) @compileError("Struct type with a single field expected, received: " ++ @typeName(T));
            break :get st.field_types[0];
        },
        .@"opaque" => |op| @field(T, op.decl_names[op.decl_names.len - 1]),
        else => @compileError("Struct type expected, received: " ++ @typeName(T)),
    };
}

fn PtrWithSameConstAs(comptime NewChild: type, comptime Ptr: type) type {
    return switch (@typeInfo(Ptr)) {
        .pointer => |pt| switch (pt.attrs.@"const") {
            true => *const NewChild,
            false => *NewChild,
        },
        else => @compileError("Pointer expected, received: " ++ @typeName(Ptr)),
    };
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
pub extern fn set_stream_wrapper(*pd.php_stream, pd.php_stream_wrapper) void;
pub extern fn set_stream_no_close(*pd.php_stream) void;
pub extern fn is_stdio_stream(*const pd.php_stream) bool;
pub extern fn get_argument_info(*const pd.zend_execute_data, *ArgPtrCountExtra) void;
pub const ArgPtrCountExtra = extern struct {
    ptr: [*]pd.zval,
    len: usize,
    extra: bool,
};
