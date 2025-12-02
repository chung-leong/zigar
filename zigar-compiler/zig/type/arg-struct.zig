const std = @import("std");
const expectEqualSlices = std.testing.expectEqualSlices;
const expectEqual = std.testing.expectEqual;

pub fn ArgStruct(comptime T: type) type {
    const f = @typeInfo(T).@"fn";
    const count = get: {
        var count = 1;
        for (f.params) |param| {
            if (param.type != null) {
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
    var field_attrs: [count]std.builtin.Type.StructField.Attributes = undefined;
    field_names[0] = "retval";
    field_types[0] = RT;
    field_attrs[0] = .{};
    inline for (f.params, 0..) |param, i| {
        field_names[i + 1] = std.fmt.comptimePrint("{d}", .{i});
        field_types[i + 1] = param.type orelse void;
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
    const fieldsA = std.meta.fields(ArgA);
    try expectEqual(3, fieldsA.len);
    try expectEqualSlices(u8, "retval", fieldsA[0].name);
    try expectEqualSlices(u8, "0", fieldsA[1].name);
    try expectEqualSlices(u8, "1", fieldsA[2].name);
    const ArgB = ArgStruct(@TypeOf(ns.B));
    const fieldsB = std.meta.fields(ArgB);
    try expectEqual(2, fieldsB.len);
    try expectEqualSlices(u8, "retval", fieldsB[0].name);
    try expectEqualSlices(u8, "0", fieldsB[1].name);
    const ArgC = ArgStruct(@TypeOf(ns.C));
    const fieldsC = std.meta.fields(ArgC);
    try expectEqual(4, fieldsC.len);
}
