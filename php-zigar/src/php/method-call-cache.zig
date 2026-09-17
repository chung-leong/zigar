pub const std = @import("std");

const Array = @import("array.zig").Array;
const c = @import("c.zig");
const pd = c.declarations;
const pi = c.imports;
const castTo = c.castTo;
const castFrom = c.castFrom;
const efree = @import("allocator.zig").efree;
const failure = @import("failure.zig");
const FunctionCallCache = @import("function-call-cache.zig").FunctionCallCache;
const String = @import("string.zig").String;
const Value = @import("value.zig").Value;

pub fn MethodCallCache(comptime names: anytype) type {
    const Entries = init: {
        var field_names: [names.len][]const u8 = undefined;
        var field_types: [names.len]type = undefined;
        var field_attrs: [names.len]std.lang.Type.Struct.FieldAttributes = undefined;
        inline for (names, 0..) |name, i| {
            field_names[i] = @tagName(name);
            field_types[i] = FunctionCallCache;
            field_attrs[i] = .{};
        }
        break :init @Struct(.auto, null, &field_names, &field_types, &field_attrs);
    };
    return struct {
        pub fn init(context: *const Value) !@This() {
            var entries: Entries = undefined;
            const field_names = comptime std.meta.fieldNames(Entries);
            var init_count: usize = 0;
            errdefer {
                inline for (0..field_names.len) |i| {
                    if (i == init_count) break;
                    @field(entries, field_names[i]).deinit();
                }
            }
            var arr = .init(null);
            defer arr.deinit();
            arr.set(0, context);
            const callable = arr.toValue();
            inline for (field_names) |field_name| {
                const name: Value = .fromStaticString(field_name);
                arr.set(1, &name);
                @field(entries, field_name) = try .init(&callable);
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
