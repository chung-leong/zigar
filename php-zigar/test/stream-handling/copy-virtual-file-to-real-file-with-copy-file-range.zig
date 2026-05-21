const std = @import("std");
const builtin = @import("builtin");

const c = @cImport({
    @cDefine("_GNU_SOURCE", {});
    @cInclude("unistd.h");
});

pub fn copy(src: std.fs.File, dest: std.fs.File, src_offset: isize, dest_offset: isize, len: usize) !usize {
    var src_off: isize = src_offset;
    var dest_off: isize = dest_offset;
    const sent = c.copy_file_range(src.handle, &src_off, dest.handle, &dest_off, len, 0);
    if (sent < 0) return error.UnableToCopyFile;
    if (src_off != src_offset + @as(isize, @intCast(len))) return error.IncorrectOffsetAfter;
    return @intCast(sent);
}
