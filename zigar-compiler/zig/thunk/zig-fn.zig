const std = @import("std");
const expect = std.testing.expect;
const expectEqual = std.testing.expectEqual;

const ArgStruct = @import("../type/arg-struct.zig").ArgStruct;
const fn_transform = @import("../zigft/fn-transform.zig");
const variadic = @import("variadic.zig");

pub const Thunk = *const fn (*const anyopaque, *anyopaque) anyerror!void;
pub const VariadicThunk = *const fn (*const anyopaque, *anyopaque, *const anyopaque, usize) anyerror!void;

pub fn ThunkType(comptime FT: type) type {
    return switch (@typeInfo(FT).@"fn".attrs.varargs) {
        false => Thunk,
        true => VariadicThunk,
    };
}

test "ThunkType" {
    try expectEqual(Thunk, ThunkType(fn (usize) void));
    try expectEqual(VariadicThunk, ThunkType(fn (usize, ...) callconv(.c) void));
}

pub fn createThunk(comptime FT: type) ThunkType(FT) {
    const f = @typeInfo(FT).@"fn";
    const ns_regular = struct {
        fn invokeFunction(fn_ptr: *const anyopaque, arg_ptr: *anyopaque) anyerror!void {
            // extract arguments from argument struct
            const arg_s: *ArgStruct(FT) = @ptrCast(@alignCast(arg_ptr));
            var arg_t: std.meta.ArgsTuple(FT) = undefined;
            const arg_t_info = @typeInfo(@TypeOf(arg_t)).@"struct";
            inline for (comptime arg_t_info.field_names) |field_name| {
                @field(arg_t, field_name) = @field(arg_s, field_name);
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
    const ns = switch (f.attrs.varargs) {
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
                    try expectEqual(3, f.param_types.len);
                    try expectEqual(std.builtin.CallingConvention.c, f.attrs.@"callconv");
                },
                else => try expect(false),
            }
        },
        else => {
            try expect(false);
        },
    }
    const thunk2 = createThunk(fn (i32, bool, ...) callconv(.c) bool);
    switch (@typeInfo(@TypeOf(thunk2))) {
        .pointer => |pt| {
            switch (@typeInfo(pt.child)) {
                .@"fn" => |f| {
                    try expectEqual(5, f.param_types.len);
                    try expectEqual(std.builtin.CallingConvention.c, f.attrs.@"callconv");
                },
                else => try expect(false),
            }
        },
        else => try expect(false),
    }
}
