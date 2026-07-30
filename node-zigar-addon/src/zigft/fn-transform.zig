const std = @import("std");
const expectEqual = std.testing.expectEqual;
const expect = std.testing.expect;

/// Take a function that accepts a tuple as its only argument and create a new one with the tuple
/// elements spread across the argument list.
///
/// When conv is null, the output function will have the same calling convention as the input
/// function.
pub fn spreadArgs(func: anytype, comptime conv: ?std.builtin.CallingConvention) SpreadFn(@TypeOf(func), conv) {
    const pyramid = getPyramid(func, conv);
    const fields = getTupleFields(@TypeOf(func));
    const caller_name = std.fmt.comptimePrint("call{d}", .{fields.len});
    if (!@hasDecl(pyramid, caller_name)) {
        @compileError("Too many arguments");
    }
    return @field(pyramid, caller_name);
}

/// Return type of spreadArgs().
pub fn SpreadFn(comptime T: type, comptime conv: ?std.builtin.CallingConvention) type {
    const fields = getTupleFields(T);
    const f = @typeInfo(T).@"fn";
    var params: [fields.len]std.builtin.Type.Fn.Param = undefined;
    inline for (fields, 0..) |field, index| {
        params[index] = .{
            .type = field.type,
            .is_generic = false,
            .is_noalias = false,
        };
    }
    return @Type(.{
        .@"fn" = .{
            .params = &params,
            .is_generic = false,
            .is_var_args = false,
            .return_type = f.return_type.?,
            .calling_convention = conv orelse f.calling_convention,
        },
    });
}

test "spreadArgs" {
    const test_ns = struct {
        var logged = false;

        fn add(a: i32, b: i32) i32 {
            return a + b;
        }

        fn getNegateFunc(func: anytype) fn (i32, i32) i32 {
            const ns = struct {
                fn negate(args: std.meta.ArgsTuple(@TypeOf(func))) i32 {
                    return -@call(.auto, func, args);
                }
            };
            return spreadArgs(ns.negate, null);
        }

        fn addLogging(func: anytype) @TypeOf(func) {
            const ns = struct {
                fn call(args: std.meta.ArgsTuple(@TypeOf(func))) @typeInfo(@TypeOf(func)).@"fn".return_type.? {
                    logged = true;
                    return @call(.auto, func, args);
                }
            };
            return spreadArgs(ns.call, null);
        }

        fn sum(args: std.meta.Tuple(&.{ i32, i32, i32 })) i32 {
            var n: i32 = 0;
            inline for (args) |arg| {
                n += arg;
            }
            return n;
        }
    };
    const f1 = test_ns.getNegateFunc(test_ns.add);
    try expectEqual(-150, f1(100, 50));
    const f2 = spreadArgs(test_ns.sum, .c);
    try expectEqual(6, f2(1, 2, 3));
    const f3 = test_ns.addLogging(test_ns.add);
    try expectEqual(150, f3(100, 50));
    try expectEqual(true, test_ns.logged);
}

fn getPyramid(func: anytype, comptime conv: ?std.builtin.CallingConvention) type {
    const PT = comptime param_types: {
        const fields = getTupleFields(@TypeOf(func));
        var list: [fields.len]type = undefined;
        for (fields, 0..) |field, index| {
            list[index] = field.type;
        }
        break :param_types list;
    };
    const f = @typeInfo(@TypeOf(func)).@"fn";
    const RT = f.return_type.?;
    const cc = conv orelse f.calling_convention;
    return struct {
        fn call0() callconv(cc) RT {
            return func(.{});
        }

        fn call1(a0: PT[0]) callconv(cc) RT {
            return func(.{a0});
        }

        fn call2(a0: PT[0], a1: PT[1]) callconv(cc) RT {
            return func(.{ a0, a1 });
        }

        fn call3(a0: PT[0], a1: PT[1], a2: PT[2]) callconv(cc) RT {
            return func(.{ a0, a1, a2 });
        }

        fn call4(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3 });
        }

        fn call5(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4 });
        }

        fn call6(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5 });
        }

        fn call7(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6 });
        }

        fn call8(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7 });
        }

        fn call9(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8 });
        }

        fn call10(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9 });
        }

        fn call11(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10 });
        }

        fn call12(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11 });
        }

        fn call13(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12 });
        }

        fn call14(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13 });
        }

        fn call15(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14 });
        }

        fn call16(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15 });
        }

        fn call17(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16 });
        }

        fn call18(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17 });
        }

        fn call19(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18 });
        }

        fn call20(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19 });
        }

        fn call21(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20 });
        }

        fn call22(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21 });
        }

        fn call23(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22 });
        }

        fn call24(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23 });
        }

        fn call25(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24 });
        }

        fn call26(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25 });
        }

        fn call27(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26 });
        }

        fn call28(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27 });
        }

        fn call29(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28 });
        }

        fn call30(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29 });
        }

        fn call31(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30 });
        }

        fn call32(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31 });
        }

        fn call33(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32 });
        }

        fn call34(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33 });
        }

        fn call35(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34 });
        }

        fn call36(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35 });
        }

        fn call37(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36 });
        }

        fn call38(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37 });
        }

        fn call39(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38 });
        }

        fn call40(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39 });
        }

        fn call41(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40 });
        }

        fn call42(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41 });
        }

        fn call43(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42 });
        }

        fn call44(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43 });
        }

        fn call45(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44 });
        }

        fn call46(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45 });
        }

        fn call47(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46 });
        }

        fn call48(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46], a47: PT[47]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47 });
        }

        fn call49(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46], a47: PT[47], a48: PT[48]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47, a48 });
        }

        fn call50(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46], a47: PT[47], a48: PT[48], a49: PT[49]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47, a48, a49 });
        }

        fn call51(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46], a47: PT[47], a48: PT[48], a49: PT[49], a50: PT[50]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47, a48, a49, a50 });
        }

        fn call52(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46], a47: PT[47], a48: PT[48], a49: PT[49], a50: PT[50], a51: PT[51]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47, a48, a49, a50, a51 });
        }

        fn call53(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46], a47: PT[47], a48: PT[48], a49: PT[49], a50: PT[50], a51: PT[51], a52: PT[52]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47, a48, a49, a50, a51, a52 });
        }

        fn call54(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46], a47: PT[47], a48: PT[48], a49: PT[49], a50: PT[50], a51: PT[51], a52: PT[52], a53: PT[53]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47, a48, a49, a50, a51, a52, a53 });
        }

        fn call55(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46], a47: PT[47], a48: PT[48], a49: PT[49], a50: PT[50], a51: PT[51], a52: PT[52], a53: PT[53], a54: PT[54]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47, a48, a49, a50, a51, a52, a53, a54 });
        }

        fn call56(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46], a47: PT[47], a48: PT[48], a49: PT[49], a50: PT[50], a51: PT[51], a52: PT[52], a53: PT[53], a54: PT[54], a55: PT[55]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47, a48, a49, a50, a51, a52, a53, a54, a55 });
        }

        fn call57(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46], a47: PT[47], a48: PT[48], a49: PT[49], a50: PT[50], a51: PT[51], a52: PT[52], a53: PT[53], a54: PT[54], a55: PT[55], a56: PT[56]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47, a48, a49, a50, a51, a52, a53, a54, a55, a56 });
        }

        fn call58(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46], a47: PT[47], a48: PT[48], a49: PT[49], a50: PT[50], a51: PT[51], a52: PT[52], a53: PT[53], a54: PT[54], a55: PT[55], a56: PT[56], a57: PT[57]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47, a48, a49, a50, a51, a52, a53, a54, a55, a56, a57 });
        }

        fn call59(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46], a47: PT[47], a48: PT[48], a49: PT[49], a50: PT[50], a51: PT[51], a52: PT[52], a53: PT[53], a54: PT[54], a55: PT[55], a56: PT[56], a57: PT[57], a58: PT[58]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47, a48, a49, a50, a51, a52, a53, a54, a55, a56, a57, a58 });
        }

        fn call60(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46], a47: PT[47], a48: PT[48], a49: PT[49], a50: PT[50], a51: PT[51], a52: PT[52], a53: PT[53], a54: PT[54], a55: PT[55], a56: PT[56], a57: PT[57], a58: PT[58], a59: PT[59]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47, a48, a49, a50, a51, a52, a53, a54, a55, a56, a57, a58, a59 });
        }

        fn call61(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46], a47: PT[47], a48: PT[48], a49: PT[49], a50: PT[50], a51: PT[51], a52: PT[52], a53: PT[53], a54: PT[54], a55: PT[55], a56: PT[56], a57: PT[57], a58: PT[58], a59: PT[59], a60: PT[60]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47, a48, a49, a50, a51, a52, a53, a54, a55, a56, a57, a58, a59, a60 });
        }

        fn call62(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46], a47: PT[47], a48: PT[48], a49: PT[49], a50: PT[50], a51: PT[51], a52: PT[52], a53: PT[53], a54: PT[54], a55: PT[55], a56: PT[56], a57: PT[57], a58: PT[58], a59: PT[59], a60: PT[60], a61: PT[61]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47, a48, a49, a50, a51, a52, a53, a54, a55, a56, a57, a58, a59, a60, a61 });
        }

        fn call63(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46], a47: PT[47], a48: PT[48], a49: PT[49], a50: PT[50], a51: PT[51], a52: PT[52], a53: PT[53], a54: PT[54], a55: PT[55], a56: PT[56], a57: PT[57], a58: PT[58], a59: PT[59], a60: PT[60], a61: PT[61], a62: PT[62]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47, a48, a49, a50, a51, a52, a53, a54, a55, a56, a57, a58, a59, a60, a61, a62 });
        }

        fn call64(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15], a16: PT[16], a17: PT[17], a18: PT[18], a19: PT[19], a20: PT[20], a21: PT[21], a22: PT[22], a23: PT[23], a24: PT[24], a25: PT[25], a26: PT[26], a27: PT[27], a28: PT[28], a29: PT[29], a30: PT[30], a31: PT[31], a32: PT[32], a33: PT[33], a34: PT[34], a35: PT[35], a36: PT[36], a37: PT[37], a38: PT[38], a39: PT[39], a40: PT[40], a41: PT[41], a42: PT[42], a43: PT[43], a44: PT[44], a45: PT[45], a46: PT[46], a47: PT[47], a48: PT[48], a49: PT[49], a50: PT[50], a51: PT[51], a52: PT[52], a53: PT[53], a54: PT[54], a55: PT[55], a56: PT[56], a57: PT[57], a58: PT[58], a59: PT[59], a60: PT[60], a61: PT[61], a62: PT[62], a63: PT[63]) callconv(cc) RT {
            return func(.{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, a32, a33, a34, a35, a36, a37, a38, a39, a40, a41, a42, a43, a44, a45, a46, a47, a48, a49, a50, a51, a52, a53, a54, a55, a56, a57, a58, a59, a60, a61, a62, a63 });
        }
    };
}

fn getTupleFields(comptime FT: type) []const std.builtin.Type.StructField {
    const valid = switch (@typeInfo(FT)) {
        .@"fn" => |f| is_tuple: {
            if (f.params.len == 1) {
                if (f.params[0].type) |PT| {
                    switch (@typeInfo(PT)) {
                        .@"struct" => |st| break :is_tuple st.is_tuple,
                        else => {},
                    }
                }
            }
            break :is_tuple false;
        },
        else => false,
    };
    if (!valid) {
        @compileError("Function accepting a tuple as argument expected");
    }
    const Tuple = @typeInfo(FT).@"fn".params[0].type.?;
    return @typeInfo(Tuple).@"struct".fields;
}

/// Take an inline function create a regular function
pub fn uninline(func: anytype) Uninlined(@TypeOf(func)) {
    const FT = @TypeOf(func);
    const f = @typeInfo(FT).@"fn";
    if (f.calling_convention != .@"inline") return func;
    const ns = struct {
        inline fn call(args: std.meta.ArgsTuple(FT)) f.return_type.? {
            return @call(.auto, func, args);
        }
    };
    return spreadArgs(ns.call, .auto);
}

test "uninline" {
    const ns = struct {
        inline fn a(x: i32, y: i32) i32 {
            return x + y;
        }

        fn b(x: i32) i32 {
            return x;
        }

        const new_a = uninline(a);
        const new_b = uninline(b);
    };
    try expectEqual(.auto, @typeInfo(@TypeOf(ns.new_a)).@"fn".calling_convention);
    try expectEqual(ns.b, ns.new_b);
}

/// Return type of uninline().
pub fn Uninlined(comptime FT: type) type {
    const f = @typeInfo(FT).@"fn";
    if (f.calling_convention != .@"inline") return FT;
    return @Type(.{
        .@"fn" = .{
            .calling_convention = .auto,
            .is_generic = f.is_generic,
            .is_var_args = f.is_var_args,
            .return_type = f.return_type,
            .params = f.params,
        },
    });
}

test "Uninlined" {
    try expectEqual(fn () void, Uninlined(fn () callconv(.@"inline") void));
    try expectEqual(fn () void, Uninlined(fn () void));
}
