const std = @import("std");
const fn_transform = @import("./fn-transform.zig");

pub const context_placeholder: usize = switch (@bitSizeOf(usize)) {
    32 => 0xbad_beef_0,
    64 => 0xdead_beef_bad_00000,
    else => unreachable,
};
pub const fn_placeholder: usize = switch (@bitSizeOf(usize)) {
    32 => 0xbad_ee15_0,
    64 => 0xdead_ee15_bad_00000,
    else => unreachable,
};

pub fn get(comptime FT: type, comptime HT: type) [*]const u8 {
    const h = @typeInfo(HT).Fn;
    const ns = struct {
        fn call(args: std.meta.ArgsTuple(FT)) h.return_type.? {
            const handler: *const HT = @ptrFromInt(fn_placeholder);
            var handle_args: std.meta.ArgsTuple(HT) = undefined;
            inline for (args, 0..) |arg, i| {
                handle_args[i] = arg;
            }
            // last argument is the context pointer
            handle_args[handle_args.len - 1] = @ptrFromInt(context_placeholder);
            return @call(.auto, handler, handle_args);
        }
    };
    const caller = fn_transform.spreadArgs(ns.call, h.calling_convention);
    return @ptrCast(&caller);
}
