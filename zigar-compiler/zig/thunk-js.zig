const std = @import("std");
const types = @import("./types.zig");
const closure = @import("./closure.zig");
const expect = std.testing.expect;

var closure_factory = closure.Factory.init();

pub fn createJSThunk(comptime FT: type, context_ptr: *const anyopaque, key: usize, comptime handler: fn (*const anyopaque, usize, *anyopaque) bool) !*const FT {
    const f = @typeInfo(FT).Fn;
    const PT = comptime extract: {
        var Types: [f.params.len]type = undefined;
        for (f.params, 0..) |param, index| {
            Types[index] = param.type orelse @compileError("Illegal argument type");
        }
        break :extract Types;
    };
    const RT = f.return_type orelse @compileError("Illegal return type");
    const cc = f.calling_convention;
    const ArgStruct = types.ArgumentStruct(FT);
    const ns = struct {
        fn call0() callconv(cc) RT {
            return call(closure.get(), .{});
        }

        fn call1(a0: PT[0]) callconv(cc) RT {
            return call(closure.get(), .{a0});
        }

        fn call2(a0: PT[0], a1: PT[1]) callconv(cc) RT {
            return call(closure.get(), .{ a0, a1 });
        }

        fn call3(a0: PT[0], a1: PT[1], a2: PT[2]) callconv(cc) RT {
            return call(closure.get(), .{ a0, a1, a2 });
        }

        fn call4(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3]) callconv(cc) RT {
            return call(closure.get(), .{ a0, a1, a2, a3 });
        }

        fn call5(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4]) callconv(cc) RT {
            return call(closure.get(), .{ a0, a1, a2, a3, a4 });
        }

        fn call6(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5]) callconv(cc) RT {
            return call(closure.get(), .{ a0, a1, a2, a3, a4, a5 });
        }

        fn call7(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6]) callconv(cc) RT {
            return call(closure.get(), .{ a0, a1, a2, a3, a4, a5, a6 });
        }

        fn call8(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7]) callconv(cc) RT {
            return call(closure.get(), .{ a0, a1, a2, a3, a4, a5, a6, a7 });
        }

        fn call9(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8]) callconv(cc) RT {
            return call(closure.get(), .{ a0, a1, a2, a3, a4, a5, a6, a7, a8 });
        }

        fn call10(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9]) callconv(cc) RT {
            return call(closure.get(), .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9 });
        }

        fn call11(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10]) callconv(cc) RT {
            return call(closure.get(), .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10 });
        }

        fn call12(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11]) callconv(cc) RT {
            return call(closure.get(), .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11 });
        }

        fn call13(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12]) callconv(cc) RT {
            return call(closure.get(), .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12 });
        }

        fn call14(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13]) callconv(cc) RT {
            return call(closure.get(), .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13 });
        }

        fn call15(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14]) callconv(cc) RT {
            return call(closure.get(), .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14 });
        }

        fn call16(a0: PT[0], a1: PT[1], a2: PT[2], a3: PT[3], a4: PT[4], a5: PT[5], a6: PT[6], a7: PT[7], a8: PT[8], a9: PT[9], a10: PT[10], a11: PT[11], a12: PT[12], a13: PT[13], a14: PT[14], a15: PT[15]) callconv(cc) RT {
            return call(closure.get(), .{ a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15 });
        }

        fn call(c: *const closure.Instance, args: anytype) RT {
            var arg_struct: ArgStruct = undefined;
            inline for (args, 0..) |value, index| {
                const name = std.fmt.comptimePrint("{d}", .{index});
                @field(arg_struct, name) = value;
            }
            if (!handler(c.context_ptr, c.key, &arg_struct)) {
                // TODO: look check if RT is an error union whose error set contains unexpected
                if (comptime hasError(RT, "unexpected")) {
                    return error.unexpected;
                } else if (comptime hasError(RT, "Unexpected")) {
                    return error.Unexpected;
                } else {
                    @panic("JavaScript function failed");
                }
            }
            return arg_struct.retval;
        }
    };
    const caller_name = std.fmt.comptimePrint("call{d}", .{f.params.len});
    if (!@hasDecl(ns, caller_name)) {
        @compileError("Too many arguments");
    }
    const caller = &@field(ns, caller_name);
    const instance = try closure_factory.alloc(caller, context_ptr, key);
    return instance.function(FT);
}

test "createJSThunk" {
    const FT = fn (i32, f64) usize;
    const Args = types.ArgumentStruct(FT);
    const ns = struct {
        var context_ptr_received: ?*const anyopaque = null;
        var key_received: ?usize = null;
        var args_received: ?Args = null;

        fn handleCall(context_ptr: *const anyopaque, key: usize, arg_ptr: *anyopaque) bool {
            context_ptr_received = context_ptr;
            key_received = key;
            const args: *Args = @ptrCast(@alignCast(arg_ptr));
            args_received = args.*;
            if (args.@"0" > 0) {
                args.retval = 999;
                return true;
            } else {
                return false;
            }
        }
    };
    const context_ptr: *const anyopaque = @ptrFromInt(0xABCD);
    const key: usize = 1234;
    const f = try createJSThunk(FT, context_ptr, key, ns.handleCall);
    const result = f(777, 3.14);
    try expect(ns.context_ptr_received == context_ptr);
    try expect(ns.key_received == key);
    try expect(ns.args_received != null);
    try expect(ns.args_received.?.@"0" == 777);
    try expect(ns.args_received.?.@"1" == 3.14);
    try expect(result == 999);
}

test "createJSThunk (error handling)" {
    const ns = struct {
        fn handleCall(_: *const anyopaque, _: usize, _: *anyopaque) bool {
            return false;
        }
    };
    const context_ptr: *const anyopaque = @ptrFromInt(0xABCD);
    const key: usize = 1234;
    const ES1 = error{ Unexpected, Cow };
    const FT1 = fn (i32, f64) ES1!usize;
    const f1 = try createJSThunk(FT1, context_ptr, key, ns.handleCall);
    const result1 = f1(777, 3.14);
    try expect(result1 == ES1.Unexpected);
    const ES2 = error{ unexpected, cow };
    const FT2 = fn (i32, f64) ES2!usize;
    const f2 = try createJSThunk(FT2, context_ptr, key, ns.handleCall);
    const result2 = f2(777, 3.14);
    try expect(result2 == ES2.unexpected);
    const FT3 = fn (i32, f64) anyerror!usize;
    const f3 = try createJSThunk(FT3, context_ptr, key, ns.handleCall);
    const result3 = f3(777, 3.14);
    try expect(result3 == ES2.unexpected);
}

fn hasError(comptime T: type, comptime name: []const u8) bool {
    return switch (@typeInfo(T)) {
        .ErrorUnion => |eu| check: {
            if (@typeInfo(eu.error_set).ErrorSet) |errors| {
                inline for (errors) |err| {
                    if (std.mem.eql(u8, err.name, name)) {
                        break :check true;
                    }
                } else {
                    break :check false;
                }
            } else {
                break :check true;
            }
        },
        else => false,
    };
}

test "hasError" {
    try expect(hasError(error{ hello, world }!i32, "hello"));
    try expect(hasError(anyerror!i32, "cow"));
    try expect(!hasError(error{ hello, world }!i32, "cow"));
}
