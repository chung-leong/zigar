const std = @import("std");

pub fn ComptimeFree(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .comptime_float,
        .comptime_int,
        .enum_literal,
        .type,
        .null,
        .undefined,
        => void,
        .array => |ar| [ar.len]ComptimeFree(ar.child),
        .@"struct" => |st| derive: {
            var field_names: [st.fields.len][]const u8 = undefined;
            var field_types: [st.fields.len]type = undefined;
            var field_attrs: [st.fields.len]std.builtin.Type.StructField.Attributes = undefined;
            inline for (st.fields, 0..) |field, i| {
                field_names[i] = field.name;
                field_types[i] = if (field.is_comptime) void else ComptimeFree(field.type);
                field_attrs[i] = .{
                    .default_value_ptr = null,
                    .@"comptime" = false,
                    .@"align" = if (st.layout != .@"packed") @alignOf(field_types[i]) else 0,
                };
            }
            break :derive @Struct(st.layout, st.backing_integer, &field_names, &field_types, &field_attrs);
        },
        .@"union" => |un| derive: {
            var field_names: [un.fields.len][]const u8 = undefined;
            var field_types: [un.fields.len]type = undefined;
            var field_attrs: [un.fields.len]std.builtin.Type.UnionField.Attributes = undefined;
            inline for (un.fields, 0..) |field, i| {
                field_names[i] = field.name;
                field_types[i] = ComptimeFree(field.type);
                field_attrs[i] = .{};
            }
            break :derive @Union(un.layout, un.tag_type, &field_names, &field_types, &field_attrs);
        },
        .optional => |op| ?ComptimeFree(op.child),
        .error_union => |eu| eu.error_set!ComptimeFree(eu.payload),
        else => T,
    };
}
