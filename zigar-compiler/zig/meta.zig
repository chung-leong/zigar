const std = @import("std");

const module = @import("module");

pub fn call(comptime name: []const u8, comptime args: anytype) bool {
    const ns = find: {
        if (@hasDecl(module, "meta(zigar)")) {
            const meta = @field(module, "meta(zigar)");
            if (@hasDecl(meta, name)) break :find meta;
            switch (@typeInfo(meta)) {
                inline .@"struct", .@"union", .@"opaque", .@"enum" => |st| {
                    if (st.decls.len == 0) @compileError("meta(zigar) has no public declarations");
                },
                else => {},
            }
        }
        break :find default;
    };
    const func = @field(ns, name);
    return @call(.auto, func, args);
}

const default = struct {
    pub fn isDeclString(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        _ = decl;
        return false;
    }

    pub fn isDeclPlain(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        _ = decl;
        return false;
    }

    pub fn isDeclTypedArray(comptime T: type, comptime decl: std.meta.DeclEnum(T)) bool {
        _ = decl;
        return false;
    }

    pub fn isFieldString(comptime T: type, comptime field: std.meta.FieldEnum(T)) bool {
        _ = field;
        return false;
    }

    pub fn isFieldPlain(comptime T: type, comptime field: std.meta.FieldEnum(T)) bool {
        _ = field;
        return false;
    }

    pub fn isFieldTypedArray(comptime T: type, comptime field: std.meta.FieldEnum(T)) bool {
        _ = field;
        return false;
    }

    pub fn isArgumentString(comptime T: type, comptime arg_index: usize) bool {
        _ = T;
        _ = arg_index;
        return false;
    }

    pub fn isArgumentPlain(comptime T: type, comptime arg_index: usize) bool {
        _ = T;
        _ = arg_index;
        return false;
    }

    pub fn isArgumentTypedArray(comptime T: type, comptime arg_index: usize) bool {
        _ = T;
        _ = arg_index;
        return false;
    }
};
