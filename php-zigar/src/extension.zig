const std = @import("std");
const builtin = @import("builtin");

const ModuleHost = @import("host.zig").ModuleHost;
const php = @import("php.zig");
const ArgInfo = php.ArgInfo;
const FunctionInfo = php.FunctionInfo;
const ExecuteData = php.ExecuteData;
const FunctionEntry = php.FunctionEntry;
const ModuleEntry = php.ModuleEntry;
const String = php.String;
const Value = php.Value;
const ZigClass = @import("class.zig").ZigClass;

export fn php_zigar_init(_: c_int, _: c_int) php.Result {
    ZigClass.registerGlobalClasses() catch return php.FAILURE;
    return php.SUCCESS;
}

export fn php_zigar_shutdown(_: c_int, _: c_int) php.Result {
    return php.SUCCESS;
}

export fn php_zigar_info(_: *ModuleEntry) void {
    php.infoTableStart();
    php.infoTableHeader(2, "PHP Zigar", "enabled");
    php.infoTableEnd();
}

const functions = struct {
    pub const zigar_load_module = struct {
        pub const arg_info = [_]ArgInfo{
            .{
                .name = "path",
                .type = .{
                    .type_mask = php.MAY_BE_STRING,
                    .ptr = null,
                },
            },
        };
        pub const info = FunctionInfo{
            .required_num_args = 1,
        };

        pub fn run(_: *ExecuteData, return_value: *Value) !void {
            var module_path: *String = undefined;
            try php.parseArguments("S", .{&module_path});
            const so_path = try std.fs.path.resolve(php.allocator, &.{
                php.getStringContent(module_path),
                getSharedLibraryName(),
            });
            defer php.allocator.free(so_path);
            std.debug.print("path = {s}\n", .{so_path});
            const module = try ModuleHost.load(so_path);
            return_value.* = module.*;
        }

        fn getSharedLibraryName() []const u8 {
            return comptime fmt: {
                const arch = switch (builtin.target.cpu.arch) {
                    .arm => "arm",
                    .aarch64 => "arm64",
                    .x86 => "ia32",
                    .loongarch64 => "loong64",
                    .mips => "mips",
                    .mipsel => "mipsel",
                    .powerpc => "ppc",
                    .powerpc64 => "ppc64",
                    .powerpc64le => "ppc64",
                    .riscv64 => "riscv64",
                    .s390x => "s390x",
                    .x86_64 => "x64",
                    else => |tag| @tagName(tag),
                };
                const platform = switch (builtin.target.os.tag) {
                    .aix => "aix",
                    .macos, .ios, .tvos, .visionos, .watchos => "darwin",
                    .freebsd => "freebsd",
                    .linux => "linux",
                    .openbsd => "openbsd",
                    .solaris => "sunos",
                    .windows => "win32",
                    else => |tag| @tagName(tag),
                };
                const ext = switch (builtin.target.os.tag) {
                    .macos, .ios, .tvos, .visionos, .watchos => "dynlib",
                    .windows => "dll",
                    else => "so",
                };
                break :fmt platform ++ "." ++ arch ++ "." ++ ext;
            };
        }
    };
};

comptime {
    const decls = std.meta.declarations(functions);
    var entries: [decls.len + 1]FunctionEntry = undefined;
    for (decls, 0..) |decl, i| {
        const function = @field(functions, decl.name);
        const handler = php.transform(function.run);
        @export(&handler, .{ .name = decl.name });
        const arg_info = init: {
            var buf: [function.arg_info.len + 1]ArgInfo = undefined;
            const info_ptr: *FunctionInfo = @ptrCast(&buf[0]);
            info_ptr.* = function.info;
            for (function.arg_info, 0..) |a, j| buf[j + 1] = a;
            break :init buf;
        };
        entries[i] = .{
            .fname = decl.name,
            .handler = &handler,
            .arg_info = @ptrCast(&arg_info),
            .num_args = @truncate(function.arg_info.len),
            .flags = 0,
        };
    }
    entries[decls.len] = std.mem.zeroes(FunctionEntry);
    const const_entries = entries;
    @export(&const_entries, .{ .name = "php_zigar_functions" });
}
