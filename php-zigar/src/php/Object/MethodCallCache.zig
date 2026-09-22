pub const std = @import("std");

const php = @import("../root.zig");
const Array = php.Array;
const Function = php.Function;
const String = php.String;
const Value = php.Value;

pub fn @"fn"(comptime names: anytype) type {
    const Entries = init: {
        var field_names: [names.len][]const u8 = undefined;
        var field_types: [names.len]type = undefined;
        var field_attrs: [names.len]std.lang.Type.Struct.FieldAttributes = undefined;
        inline for (names, 0..) |name, i| {
            field_names[i] = @tagName(name);
            field_types[i] = Function.CallCache;
            field_attrs[i] = .{};
        }
        break :init @Struct(.auto, null, &field_names, &field_types, &field_attrs);
    };
    return struct {
        pub fn init(context: Value) !@This() {
            var entries: Entries = undefined;
            const field_names = comptime std.meta.fieldNames(Entries);
            var init_count: usize = 0;
            errdefer {
                inline for (0..field_names.len) |i| {
                    if (i == init_count) break;
                    @field(entries, field_names[i]).deinit();
                }
            }
            var arr: *Array = .create();
            defer arr.release();
            arr.set(0, context);
            inline for (field_names) |field_name| {
                const name: Value = .fromString(.static(field_name));
                arr.set(1, name);
                @field(entries, field_name) = try .init(arr.toValue());
                init_count += 1;
            }
            return .{ .method = entries };
        }

        pub fn deinit(self: *@This()) void {
            const field_names = comptime std.meta.fieldNames(Entries);
            inline for (field_names) |field_name| @field(self.method, field_name).deinit();
        }

        method: Entries,
    };
}
