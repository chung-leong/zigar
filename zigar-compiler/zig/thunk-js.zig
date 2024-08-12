const std = @import("std");
const types = @import("./types.zig");
const closure = @import("./closure.zig");

var closure_factory = closure.Factory.init();

pub fn createJSThunk(comptime FT: type, context_ptr: *const anyopaque, key: usize, handler: anytype) *const FT {
    const f = @typeInfo(FT).Fn;
    const PT = extract: {
        var Types: [f.params.len]type = undefined;
        inline for (f.params, 0..) |param, index| {
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

        fn call(c: *const closure.Closure, args: anytype) RT {
            var arg_struct: ArgStruct = undefined;
            inline for (args, 0..) |value, index| {
                const name = std.fmt.comptimePrint("{d}", .{index});
                @field(arg_struct, name) = value;
            }
            handler(c.context_ptr, c.key, &arg_struct);
            return arg_struct.retval;
        }
    };
    if (!@hasDecl(ns, "call" ++ f.params.len)) {
        @compileError("Too many arguments: " ++ f.params.len);
    }
    const caller = @field(ns, "call" ++ f.params.len);
    const instance = closure_factory.alloc(caller, context_ptr, key);
    return instance.function(FT);
}
