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
            const len = st.field_names.len;
            var field_names: [len][]const u8 = undefined;
            var field_types: [len]type = undefined;
            var field_attrs: [len]std.lang.Type.Struct.FieldAttributes = undefined;
            inline for (st.field_names, 0..) |field_name, i| {
                const FieldType = st.field_types[i];
                field_names[i] = field_name;
                field_types[i] = if (st.field_attrs[i].@"comptime") void else ComptimeFree(FieldType);
                field_attrs[i] = .{
                    .default_value_ptr = null,
                    .@"comptime" = false,
                    .@"align" = if (st.layout != .@"packed") @alignOf(field_types[i]) else 0,
                };
            }
            break :derive @Struct(st.layout, st.backing_integer, &field_names, &field_types, &field_attrs);
        },
        .@"union" => |un| derive: {
            const len = un.field_names.len;
            var field_names: [len][]const u8 = undefined;
            var field_types: [len]type = undefined;
            var field_attrs: [len]std.lang.Type.Union.FieldAttributes = undefined;
            inline for (un.field_names, 0..) |field_name, i| {
                const FieldType = un.field_types[i];
                field_names[i] = field_name;
                field_types[i] = ComptimeFree(FieldType);
                field_attrs[i] = .{};
            }
            break :derive @Union(un.layout, un.tag_type, &field_names, &field_types, &field_attrs);
        },
        .optional => |op| ?ComptimeFree(op.child),
        .error_union => |eu| eu.error_set!ComptimeFree(eu.payload),
        else => T,
    };
}
