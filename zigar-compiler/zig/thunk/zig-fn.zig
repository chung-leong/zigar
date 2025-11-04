const std = @import("std");
const expect = std.testing.expect;
const expectEqual = std.testing.expectEqual;

const ArgStruct = @import("../type/arg-struct.zig").ArgStruct;
const fn_transform = @import("../zigft/fn-transform.zig");
const variadic = @import("variadic.zig");

pub const Thunk = *const fn (*const anyopaque, *anyopaque) anyerror!void;
pub const VariadicThunk = *const fn (*const anyopaque, *anyopaque, *const anyopaque, usize) anyerror!void;

pub fn ThunkType(comptime FT: type) type {
    return switch (@typeInfo(FT).@"fn".is_var_args) {
        false => Thunk,
        true => VariadicThunk,
    };
}

test "ThunkType" {
    try expectEqual(Thunk, ThunkType(fn (usize) void));
    try expectEqual(VariadicThunk, ThunkType(fn (usize, ...) callconv(.C) void));
}

pub fn createThunk(comptime FT: type) ThunkType(FT) {
    const f = @typeInfo(FT).@"fn";
    const ns_regular = struct {
        fn invokeFunction(fn_ptr: *const anyopaque, arg_ptr: *anyopaque) anyerror!void {
            // extract arguments from argument struct
            const arg_s: *ArgStruct(FT) = @ptrCast(@alignCast(arg_ptr));
            var arg_t: std.meta.ArgsTuple(FT) = undefined;
            inline for (comptime std.meta.fields(@TypeOf(arg_t))) |field| {
                @field(arg_t, field.name) = @field(arg_s, field.name);
            }
            const function: *const FT = @ptrCast(@alignCast(fn_ptr));
            const retval = @call(.auto, function, arg_t);
            if (comptime @TypeOf(retval) != noreturn) {
                arg_s.retval = retval;
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
                    try expectEqual(3, f.params.len);
                    try expectEqual(std.builtin.CallingConvention.c, f.calling_convention);
                },
                else => try expect(false),
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
                    try expectEqual(5, f.params.len);
                    try expectEqual(std.builtin.CallingConvention.c, f.calling_convention);
                },
                else => try expect(false),
            }
        },
        else => try expect(false),
    }
}
