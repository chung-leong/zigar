pub const std = @import("std");

const php = @import("../root.zig");
const Array = php.Array;
const Function = php.Function;
const String = php.String;
const Value = php.Value;

pub fn @"fn"(comptime names: anytype) type {
    const Container, const CallCacheContainer, const Name = init: {
        var field_names: [names.len][]const u8 = undefined;
        var field_types: [names.len]type = undefined;
        var field_attrs: [names.len]std.lang.Type.Struct.FieldAttributes = undefined;
        inline for (names, 0..) |name, i| {
            field_names[i] = @tagName(name);
            field_types[i] = Function;
            field_attrs[i] = .{};
        }
        const Container = @Struct(.auto, null, &field_names, &field_types, &field_attrs);
        inline for (&field_types) |*ptr| ptr.* = Function.CallCache;
        const CallCacheContainer = @Struct(.auto, null, &field_names, &field_types, &field_attrs);
        const Tag = std.math.IntFittingRange(0, names.len - 1);
        var field_values: [names.len]Tag = undefined;
        inline for (&field_values, 0..) |*ptr, i| ptr.* = i;
        const Name = @Enum(Tag, .exhaustive, &field_names, &field_values);
        break :init .{ Container, CallCacheContainer, Name };
    };
    return struct {
        pub fn find(self: *const @This(), name: *String) ?*Function {
            return inline for (names) |n| {
                if (name.matchSlice(n)) break &@field(self.entries, n);
            } else null;
        }

        pub const CallCache = struct {
            pub fn init(context: Value) !@This() {
                var entries: CallCacheContainer = undefined;
                var init_count: usize = 0;
                errdefer {
                    inline for (0..names.len) |i| {
                        if (i == init_count) break;
                        const entry = &@field(entries, @tagName(names[i]));
                        entry.deinit();
                    }
                }
                var arr: *Array = .create();
                defer arr.release();
                arr.set(0, context);
                inline for (names) |name| {
                    const name_str = String.static(@tagName(name));
                    arr.set(1, .fromString(name_str));
                    @field(entries, @tagName(name)) = try .init(arr.toValue());
                    init_count += 1;
                }
                return .{ .entries = entries };
            }

            pub fn deinit(self: *@This()) void {
                inline for (names) |name| {
                    const entry = &@field(self.entries, @tagName(name));
                    entry.deinit();
                }
            }

            pub fn invoke(self: *@This(), comptime name: Name, args: []const Value) !Value {
                const entry = &@field(self.entries, @tagName(name));
                return try entry.invoke(args);
            }

            entries: CallCacheContainer,
        };

        entries: Container,
    };
}
