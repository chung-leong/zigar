const std = @import("std");
const expectEqual = std.testing.expectEqual;

pub fn get(comptime T: type) u64 {
    return calculate(T, .{});
}

fn calculate(comptime T: type, comptime checking: anytype) u64 {
    var xxhash = std.hash.XxHash64.init(0);
    switch (@typeInfo(T)) {
        .@"struct" => |st| {
            xxhash.update(switch (st.layout) {
                .@"extern" => "extern struct",
                .@"packed" => "packed struct",
                else => "struct",
            });
            if (st.backing_integer) |BIT| {
                xxhash.update("(");
                xxhash.update(std.mem.asBytes(&calculate(BIT, checking)));
                xxhash.update(")");
            }
            xxhash.update(" {");
            inline for (st.field_names, 0..) |field_name, i| {
                const FieldType = st.field_types[i];
                const field_attrs = st.field_attrs[i];
                if (!field_attrs.@"comptime") {
                    xxhash.update(field_name);
                    xxhash.update(": ");
                    xxhash.update(std.mem.asBytes(&calculate(FieldType, checking ++ .{T})));
                    if (field_attrs.@"align") |al| {
                        if (al != @alignOf(FieldType)) {
                            xxhash.update(std.fmt.comptimePrint(" align({d})", .{al}));
                        }
                    }
                    xxhash.update(", ");
                }
            }
            xxhash.update("}");
        },
        .@"union" => |un| {
            xxhash.update(switch (un.layout) {
                .@"extern" => "extern union",
                else => "union",
            });
            if (un.tag_type) |TT| {
                xxhash.update("(");
                xxhash.update(std.mem.asBytes(&calculate(TT, checking)));
                xxhash.update(")");
            }
            xxhash.update(" {");
            inline for (un.field_names, 0..) |field_name, i| {
                const FieldType = un.field_types[i];
                xxhash.update(field_name);
                xxhash.update(": ");
                xxhash.update(std.mem.asBytes(&calculate(FieldType, checking ++ .{T})));
                if (un.field_attrs[i].@"align") |al| {
                    if (al != @alignOf(FieldType)) {
                        xxhash.update(std.fmt.comptimePrint(" align({d})", .{al}));
                    }
                }
                xxhash.update(", ");
            }
            xxhash.update("}");
        },
        .array => |ar| {
            xxhash.update(std.fmt.comptimePrint("[{d}]", .{ar.len}));
            xxhash.update(std.mem.asBytes(&calculate(ar.child, checking)));
        },
        .vector => |ar| {
            xxhash.update(std.fmt.comptimePrint("@Vector({d}, ", .{ar.len}));
            xxhash.update(std.mem.asBytes(&calculate(ar.child, checking)));
            xxhash.update(")");
        },
        .optional => |op| {
            xxhash.update("?");
            xxhash.update(std.mem.asBytes(&calculate(op.child, checking)));
        },
        .error_union => |eu| {
            xxhash.update(std.mem.asBytes(&calculate(eu.error_set, checking)));
            xxhash.update("!");
            xxhash.update(std.mem.asBytes(&calculate(eu.payload, checking)));
        },
        .error_set => |es| {
            if (T == anyerror) {
                xxhash.update("anyerror");
            } else {
                xxhash.update("error{");
                if (es.error_names) |error_names| {
                    inline for (error_names) |error_name| {
                        xxhash.update(error_name);
                        xxhash.update(",");
                    }
                }
                xxhash.update("}");
            }
        },
        .pointer => |pt| {
            xxhash.update(switch (pt.size) {
                .one => "*",
                .many => "[*",
                .slice => "[",
                .c => "[*c",
            });
            if (pt.sentinel_ptr) |ptr| {
                const value = @as(*const pt.child, @ptrCast(@alignCast(ptr))).*;
                xxhash.update(std.fmt.comptimePrint(":{d}", .{value}));
            }
            xxhash.update(switch (pt.size) {
                .one => "",
                else => "]",
            });
            if (pt.attrs.@"const") {
                xxhash.update("const ");
            }
            if (pt.attrs.@"allowzero") {
                xxhash.update("allowzero ");
            }
            const child_sig: u64 = inline for (checking) |C| {
                if (pt.child == C) break 0;
            } else calculate(pt.child, checking);
            xxhash.update(std.mem.asBytes(&child_sig));
        },
        .@"fn" => |f| {
            xxhash.update("fn (");
            inline for (f.param_types, 0..) |param_type, i| {
                if (f.param_attrs[i].@"noalias") {
                    xxhash.update("noalias ");
                }
                if (param_type) |PT| {
                    xxhash.update(std.mem.asBytes(&calculate(PT, checking)));
                } else {
                    xxhash.update("anytype");
                }
                xxhash.update(", ");
            }
            if (f.attrs.varargs) {
                xxhash.update("...");
            }
            xxhash.update(") ");
            if (f.attrs.@"callconv" != .auto) {
                xxhash.update("callconv(.");
                xxhash.update(@tagName(f.attrs.@"callconv"));
                xxhash.update(") ");
            }
            if (f.return_type) |RT| {
                xxhash.update(std.mem.asBytes(&calculate(RT, checking)));
            }
        },
        else => xxhash.update(@typeName(T)),
    }
    return xxhash.final();
}

test "get" {
    try expectEqual(get(struct { a: u32 }), get(struct { a: u32 }));
    try expectEqual(get(struct { a: *@This() }), get(struct { a: *@This() }));
}
