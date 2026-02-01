const std = @import("std");

const windows_h = @cImport({
    @cInclude("windows.h");
});

pub fn print(file: std.fs.File) !void {
    var info: windows_h.BY_HANDLE_FILE_INFORMATION = undefined;
    if (windows_h.GetFileInformationByHandle(file.handle, &info) == 0) return error.UnableToGetFileInfo;
    std.debug.print("size = {d}\n", .{info.nFileSizeLow});
    std.debug.print("ctime = {d}, {d}\n", .{ info.ftCreationTime.dwLowDateTime, info.ftCreationTime.dwHighDateTime });
    std.debug.print("atime = {d}, {d}\n", .{ info.ftLastAccessTime.dwLowDateTime, info.ftLastAccessTime.dwHighDateTime });
    std.debug.print("mtime = {d}, {d}\n", .{ info.ftLastWriteTime.dwLowDateTime, info.ftLastWriteTime.dwHighDateTime });
}
