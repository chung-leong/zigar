const std = @import("std");

const module_host = @import("module-host.zig");
const ModuleHost = module_host.ModuleHost;
const php = @import("php.zig");
const ArgInfo = php.ArgInfo;
const FunctionInfo = php.FunctionInfo;
const ExecuteData = php.ExecuteData;
const FunctionEntry = php.FunctionEntry;
const ModuleEntry = php.ModuleEntry;
const String = php.String;
const Value = php.Value;
const fn_transform = @import("zigft/fn-transform.zig");

export fn php_zigar_init(_: c_int, _: c_int) php.Result {
    return php.SUCCESS;
}

export fn php_zigar_shutdown(_: c_int, _: c_int) php.Result {
    return php.SUCCESS;
}

export fn php_zigar_info(_: *ModuleEntry) void {
    // php_info_print_table_start();
    // php_info_print_table_header(2, "PHP Zigar", "enabled");
    // php_info_print_table_end();
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
            var path_str: *String = undefined;
            try php.parseArguments("S", .{&path_str});
            const path = php.getStringContent(path_str);
            std.debug.print("path = {s}\n", .{path});
            const module = try ModuleHost.load(path);
            _ = php.addValueRef(module);
            return_value.* = module.*;
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
