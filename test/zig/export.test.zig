const std = @import("std");
const ex = @import("../../src/zig/export.zig");

export const zig_module = ex.createModule(@import("./functions.zig"));

test "module content" {
    std.debug.print("\n", .{});
    for (zig_module.items, 0..zig_module.count) |entry, _| {
        std.debug.print("{s}\t", .{entry.name});
        switch (entry.content.type) {
            .function => std.debug.print("[function]\n", .{}),
            .enum_set => {
                std.debug.print("enum {{\n", .{});
                const items = entry.content.params.enum_set.items;
                const count = entry.content.params.enum_set.count;
                for (items, 0..count) |item, _| {
                    std.debug.print("  {s} = {d}\n", .{ item.name, item.value });
                }
                std.debug.print("}}\n", .{});
            },
            .int_value, .enum_value => std.debug.print("{d}\n", .{entry.content.params.int_value}),
            .float_value => std.debug.print("{d}\n", .{entry.content.params.float_value}),
            else => {
                std.debug.print("[unknown]\n", .{});
            },
        }
    }
}
