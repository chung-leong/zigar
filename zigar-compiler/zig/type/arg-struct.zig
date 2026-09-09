const std = @import("std");
const expectEqualSlices = std.testing.expectEqualSlices;
const expectEqual = std.testing.expectEqual;

pub fn ArgStruct(comptime T: type) type {
    const fn_type = if (@typeInfo(T).@"fn".attrs.varargs) .variadic else .normal;
    return Arg(fn_type, T);
}

pub fn Arg(comptime _: @TypeOf(.enum_literal), comptime T: type) type {
    @setEvalBranchQuota(2_000_000);
    const f = @typeInfo(T).@"fn";
    const count = get: {
        var count = 1;
        for (f.param_types) |param_type| {
            if (param_type != null) {
                count += 1;
            }
        }
        break :get count;
    };
    const RT = if (f.return_type) |RT| switch (RT) {
        noreturn => void,
        else => RT,
    } else void;
    var field_names: [count][]const u8 = undefined;
    var field_types: [count]type = undefined;
    var field_attrs: [count]std.lang.Type.Struct.FieldAttributes = undefined;
    field_names[0] = "retval";
    field_types[0] = RT;
    field_attrs[0] = .{};
    inline for (f.param_types, 0..) |param_type, i| {
        field_names[i + 1] = std.fmt.comptimePrint("{d}", .{i});
        field_types[i + 1] = param_type orelse void;
        field_attrs[i + 1] = .{};
    }
    return @Struct(.auto, null, &field_names, &field_types, &field_attrs);
}

test "ArgStruct" {
    const ns = struct {
        fn A(a: i32, b: bool) bool {
            return if (a > 10 and b) true else false;
        }

        fn B(s: []const u8) void {
            _ = s;
        }

        fn C(alloc: std.mem.Allocator, arg1: i32, arg2: i32) bool {
            _ = alloc;
            return arg1 < arg2;
        }
    };
    const ArgA = ArgStruct(@TypeOf(ns.A));
    const field_names_a = std.meta.fieldNames(ArgA);
    try expectEqual(3, field_names_a.len);
    try expectEqualSlices(u8, "retval", field_names_a[0]);
    try expectEqualSlices(u8, "0", field_names_a[1]);
    try expectEqualSlices(u8, "1", field_names_a[2]);
    const ArgB = ArgStruct(@TypeOf(ns.B));
    const field_names_b = std.meta.fieldNames(ArgB);
    try expectEqual(2, field_names_b.len);
    try expectEqualSlices(u8, "retval", field_names_b[0]);
    try expectEqualSlices(u8, "0", field_names_b[1]);
    const ArgC = ArgStruct(@TypeOf(ns.C));
    const field_names_c = std.meta.fieldNames(ArgC);
    try expectEqual(4, field_names_c.len);
}

pub fn is(comptime T: type, variadic: ?bool) bool {
    if (@typeInfo(T) == .@"struct") {
        if (@hasField(T, "retval")) {
            const name = @typeName(T);
            if (std.mem.indexOf(u8, name, ".Arg(")) |index| {
                if (variadic) |v| {
                    if (v == (name[index + 6] == 'v')) {
                        return true;
                    }
                } else return true;
            }
        }
    }
    return false;
}

test "is" {
    const ns = struct {
        fn foo(a: i32, b: bool) bool {
            return if (a > 10 and b) true else false;
        }

        fn bar(a: i32, ...) callconv(.c) bool {
            return if (a > 10) true else false;
        }
    };
    const ArgFoo = ArgStruct(@TypeOf(ns.foo));
    _ = is(ArgFoo, false);
    try expectEqual(true, is(ArgFoo, false));
    try expectEqual(false, is(ArgFoo, true));
    try expectEqual(true, is(ArgFoo, null));
    const ArgBar = ArgStruct(@TypeOf(ns.bar));
    try expectEqual(false, is(ArgBar, false));
    try expectEqual(true, is(ArgBar, true));
    try expectEqual(true, is(ArgBar, null));
    try expectEqual(false, is(enum { foo, bar }, false));
}
