const std = @import("std");
const builtin = @import("builtin");

const module = @import("module");

pub const host = switch (builtin.target.cpu.arch.isWasm()) {
    true => @import("host/wasm.zig"),
    false => @import("host/native.zig"),
};

pub const std_options: std.Options = if (@hasDecl(module, "std_options")) module.std_options else .{};
pub const debug: type = if (@hasDecl(module, "debug")) module.debug else struct {};

pub const panic = switch (@hasDecl(module, "panic") and @TypeOf(module.panic) == type) {
    true => module.panic,
    false => get: {
        const ns = struct {
            fn panic(msg: []const u8, error_return_trace: ?*std.builtin.StackTrace, ret_addr: ?usize) noreturn {
                if (@hasDecl(module, "panic"))
                    module.panic(msg, error_return_trace, ret_addr)
                else
                    host.panic(msg, error_return_trace, ret_addr);
            }
        };
        break :get ns.panic;
    },
};

comptime {
    if (builtin.target.cpu.arch.isWasm()) {
        const ns = struct {
            fn get() callconv(.c) usize {
                return host.getFactoryThunk(module);
            }
        };
        @export(&ns.get, .{
            .name = "getFactoryThunk",
        });
    } else {
        @export(&host.createModule(module), .{
            .name = "zig_module",
        });
    }
}
