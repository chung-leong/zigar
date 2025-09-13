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
    fn isFieldString(comptime CT: type, comptime field_name: []const u8) bool {
        _ = CT;
        _ = field_name;
        return false;
    }

    fn isFieldPlain(comptime CT: type, comptime field_name: []const u8) bool {
        _ = CT;
        _ = field_name;
        return false;
    }

    fn isRetvalString(comptime func: anytype) bool {
        _ = func;
        return false;
    }

    fn isRetvalPlain(comptime func: anytype) bool {
        _ = func;
        return false;
    }

    fn isArgumentString(comptime FT: type, comptime arg_index: usize) bool {
        _ = FT;
        _ = arg_index;
        return false;
    }

    fn isArgumentPlain(comptime FT: type, comptime arg_index: usize) bool {
        _ = FT;
        _ = arg_index;
        return false;
    }
};
