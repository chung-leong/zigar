pub const std = @import("std");

const php = @import("../root.zig");
const c = php.c;
const pi = php.imports;
pub const Ops = c.php_stream_wrapper_ops;

pub fn getOp(path: []const u8, comptime name: []const u8) !@Tuple(&.{ *c.php_stream_wrapper, @FieldType(Ops, name) }) {
    const w = pi.php_stream_locate_url_wrapper(path.ptr, null, 0);
    if (w == null or w.*.wops == null or @field(w.*.wops.*, name) == null) {
        return error.Failure;
    }
    return .{ w, @field(w.*.wops.*, name) };
}

impl: c.php_stream_wrapper,
