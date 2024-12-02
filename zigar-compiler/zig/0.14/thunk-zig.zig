const std = @import("std");
const builtin = @import("builtin");
const types = @import("types.zig");
const variadic = @import("variadic.zig");
const fn_transform = @import("fn-transform.zig");
const expect = std.testing.expect;

const is_wasm = switch (builtin.target.cpu.arch) {
    .wasm32, .wasm64 => true,
    else => false,
};

const Memory = types.Memory;

pub const Thunk = *const fn (*const anyopaque, *anyopaque) anyerror!void;
pub const VariadicThunk = *const fn (*const anyopaque, *anyopaque, *const anyopaque, usize) anyerror!void;

pub fn ThunkType(comptime FT: type) type {
    return switch (@typeInfo(FT).@"fn".is_var_args) {
        false => Thunk,
        true => VariadicThunk,
    };
}

test "ThunkType" {
    try expect(ThunkType(fn (usize) void) == Thunk);
    try expect(ThunkType(fn (usize, ...) callconv(.C) void) == VariadicThunk);
}

pub fn getFunctionPointer(comptime function: anytype) *const @TypeOf(function) {
    return switch (is_wasm) {
        true => &function,
        false => indirection: {
            // on the Node side, use a pointer to a pointer so that it's always pointing
            // to the address space of the shared library even if the function is outside it
            // (e.g. from libc)
            const ns = struct {
                const ptr: *const @TypeOf(function) = &function;
            };
            break :indirection @ptrCast(&ns.ptr);
        },
    };
}

pub fn createThunk(comptime FT: type) ThunkType(FT) {
    const f = @typeInfo(FT).@"fn";
    const ArgStruct = types.ArgumentStruct(FT);
    const ns_regular = struct {
        fn invokeFunction(fn_ptr: *const anyopaque, arg_ptr: *anyopaque) anyerror!void {
            // extract arguments from argument struct
            const arg_struct: *ArgStruct = @ptrCast(@alignCast(arg_ptr));
            var args: std.meta.ArgsTuple(FT) = undefined;
            const fields = @typeInfo(@TypeOf(args)).@"struct".fields;
            inline for (fields) |field| {
                @field(args, field.name) = @field(arg_struct, field.name);
            }
            const function: *const FT = switch (is_wasm) {
                true => @ptrCast(fn_ptr),
                false => @as(*const *const FT, @ptrCast(@alignCast(fn_ptr))).*,
            };
            const retval = @call(.auto, function, args);
            if (comptime @TypeOf(retval) != noreturn) {
                arg_struct.retval = retval;
            }
        }
    };
    const ns_variadic = struct {
        fn invokeFunction(fn_ptr: *const anyopaque, arg_ptr: *anyopaque, attr_ptr: *const anyopaque, arg_count: usize) anyerror!void {
            return variadic.call(FT, fn_ptr, arg_ptr, attr_ptr, arg_count);
        }
    };
    const ns = switch (f.is_var_args) {
        false => ns_regular,
        true => ns_variadic,
    };
    return ns.invokeFunction;
}

test "createThunk" {
    const thunk1 = createThunk(fn (i32, bool) bool);
    switch (@typeInfo(@TypeOf(thunk1))) {
        .pointer => |pt| {
            switch (@typeInfo(pt.child)) {
                .@"fn" => |f| {
                    try expect(f.params.len == 3);
                    try expect(f.calling_convention == .C);
                },
                else => {
                    try expect(false);
                },
            }
        },
        else => {
            try expect(false);
        },
    }
    const thunk2 = createThunk(fn (i32, bool, ...) callconv(.C) bool);
    switch (@typeInfo(@TypeOf(thunk2))) {
        .pointer => |pt| {
            switch (@typeInfo(pt.child)) {
                .@"fn" => |f| {
                    try expect(f.params.len == 5);
                    try expect(f.calling_convention == .C);
                },
                else => {
                    try expect(false);
                },
            }
        },
        else => {
            try expect(false);
        },
    }
}
