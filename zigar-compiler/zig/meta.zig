const root = @import("root");

pub fn call(comptime name: []const u8, comptime args: anytype) bool {
    const ns = find: {
        if (@hasDecl(root, "meta(zigar)")) {
            const meta = @field(root, "meta(zigar)");
            if (@hasDecl(meta, name)) break :find meta;
        }
        break :find default;
    };
    const func = @field(ns, name);
    return @call(.auto, func, args);
}

const default = struct {
    fn isFieldString(comptime container: type, comptime field_name: []const u8) bool {
        _ = container;
        _ = field_name;
        return false;
    }

    fn isRetvalString(comptime func: anytype) bool {
        _ = func;
        return false;
    }

    fn isArgumentString(comptime FT: type, comptime arg_index: usize) bool {
        _ = FT;
        _ = arg_index;
        return false;
    }
};
