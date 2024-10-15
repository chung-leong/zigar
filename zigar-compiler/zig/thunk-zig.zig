const std = @import("std");
const types = @import("types.zig");
const variadic = @import("variadic.zig");
const fn_transform = @import("fn-transform.zig");
const expect = std.testing.expect;

const Memory = types.Memory;

pub const Thunk = *const fn (*const anyopaque, *anyopaque) anyerror!void;
pub const VariadicThunk = *const fn (*const anyopaque, *anyopaque, *const anyopaque, usize) anyerror!void;

pub fn ThunkType(comptime FT: type) type {
    return switch (@typeInfo(FT).Fn.is_var_args) {
        false => Thunk,
        true => VariadicThunk,
    };
}

test "ThunkType" {
    try expect(ThunkType(fn (usize) void) == Thunk);
    try expect(ThunkType(fn (usize, ...) callconv(.C) void) == VariadicThunk);
}

pub fn createThunk(comptime FT: type) ThunkType(FT) {
    const f = @typeInfo(FT).Fn;
    const ArgStruct = types.ArgumentStruct(FT);
    const ns_regular = struct {
        fn invokeFunction(fn_ptr: *const anyopaque, arg_ptr: *anyopaque) anyerror!void {
            // extract arguments from argument struct
            const arg_struct: *ArgStruct = @ptrCast(@alignCast(arg_ptr));
            var args: std.meta.ArgsTuple(FT) = undefined;
            const fields = @typeInfo(@TypeOf(args)).Struct.fields;
            inline for (fields) |field| {
                @field(args, field.name) = @field(arg_struct, field.name);
            }
            const function: *const FT = @ptrCast(fn_ptr);
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
        .Pointer => |pt| {
            switch (@typeInfo(pt.child)) {
                .Fn => |f| {
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
        .Pointer => |pt| {
            switch (@typeInfo(pt.child)) {
                .Fn => |f| {
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

pub fn uninline(comptime function: anytype) types.Uninlined(@TypeOf(function)) {
    const FT = types.Uninlined(@TypeOf(function));
    if (comptime FT == @TypeOf(function)) {
        return function;
    }
    const f = @typeInfo(FT).Fn;
    const ns = struct {
        inline fn call(args: std.meta.ArgsTuple(FT)) f.return_type.? {
            return @call(.auto, function, args);
        }
    };
    return fn_transform.spreadArgs(ns.call, f.calling_convention);
}

test "uninline" {
    const ns = struct {
        inline fn add(a: i32, b: i32) i32 {
            return a + b;
        }
    };
    const f = uninline(ns.add);
    const c = f(1, 2);
    try expect(c == 3);
}
