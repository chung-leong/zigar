const std = @import("std");

const php = @import("php.zig");
const ArgInfo = php.ArgInfo;
const ExecuteData = php.ExecuteData;
const FunctionEntry = php.FunctionEntry;
const TsContext = php.TsContext;
const Value = php.Value;

fn hello_world(execute_data: ?*ExecuteData, return_value: ?*Value, ctx: TsContext) !void {
    _ = execute_data;
    _ = php.c.php_printf("Hello from ZIG!\n");
    _ = ctx;
    if (return_value) |ptr| ptr.* = php.createString("Hello world");
}

const arg_info = [_]ArgInfo{
    .{
        .name = null,
        .type = .{
            .type_mask = php.c.MAY_BE_NULL,
            .ptr = null,
        },
    },
};
export const hello_world_export = php.exportTs(hello_world);
export const php_zigar_functions = [_]FunctionEntry{
    .{
        .fname = "hello_world",
        .handler = hello_world_export,
        .arg_info = &arg_info,
        .num_args = 0,
        .flags = 0,
    },
    .{
        .fname = null,
        .handler = null,
        .arg_info = null,
        .num_args = 0,
        .flags = 0,
    },
};
