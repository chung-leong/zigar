const std = @import("std");

const module_host = @import("module-host.zig");
const ModuleHost = module_host.ModuleHost;
const php = @import("php.zig");
const ArgInfo = php.ArgInfo;
const ExecuteData = php.ExecuteData;
const FunctionEntry = php.FunctionEntry;
const String = php.String;
const Value = php.Value;
const fn_transform = @import("zigft/fn-transform.zig");

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

        pub fn run(_: *ExecuteData, return_value: ?*Value) !void {
            var path_str: *String = undefined;
            try php.parseArguments("S", .{&path_str});
            const path = php.extractString(path_str);
            const host = try ModuleHost.load(path);
            _ = host;
            _ = return_value;
        }
    };
};

comptime {
    const decls = std.meta.declarations(functions);
    var entries: [decls.len + 1]FunctionEntry = undefined;
    for (decls, 0..) |decl, i| {
        const function = @field(functions, decl.name);
        const handler = php.exportFunction(function.run, decl.name);
        entries[i] = .{
            .fname = decl.name,
            .handler = &handler,
            .arg_info = @ptrCast(&function.arg_info),
            .num_args = @truncate(function.arg_info.len),
            .flags = 0,
        };
    }
    entries[decls.len] = std.mem.zeroes(FunctionEntry);
    const const_entries = entries;
    @export(&const_entries, .{ .name = "php_zigar_functions" });
}
