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

        fn call(c: *const closure.Instance, args: anytype) RT {
            var arg_struct: ArgStruct = undefined;
            inline for (args, 0..) |value, index| {
                const name = std.fmt.comptimePrint("{d}", .{index});
                @field(arg_struct, name) = value;
            }
            if (!handler(c.context_ptr, c.key, &arg_struct)) {
                // TODO: look check if RT is an error union whose error set contains unexpected
                @panic("JavaScript function failed");
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
            const args: Args = @ptrCast(@alignCast(arg_ptr));
            args_received = args;
            args.retval = 999;
            return true;
        }
    };
    const context_ptr: *const anyopaque = @ptrFromInt(0xABCD);
    const key: usize = 1234;
    const f = try createJSThunk(FT, context_ptr, key, ns.handleCall);
    const result = f(777, 3.14);
    try expect(ns.context_ptr_received == context_ptr);
    try expect(ns.key_received == key);
    try expect(ns.args_received != null);
    try expect(ns.args_received.?.arg0 == 777);
    try expect(ns.args_received.?.arg1 == 3.14);
    try expect(result == 999);
}
