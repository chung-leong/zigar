const std = @import("std");

const php = @import("root.zig");
const pi = php.imports;

pub const InfoTable = struct {
    pub fn init() @This() {
        pi.php_info_print_table_start();
        return .{};
    }

    pub fn end(_: *@This()) void {
        pi.php_info_print_table_end();
    }

    pub fn addTwoHeaders(_: *@This(), col0: [:0]const u8, col1: [:0]const u8) void {
        pi.php_info_print_table_header(2, col0.ptr, col1.ptr);
    }

    pub fn addThreeHeaders(_: *@This(), col0: [:0]const u8, col1: [:0]const u8, col2: [:0]const u8) void {
        pi.php_info_print_table_header(3, col0.ptr, col1.ptr, col2.ptr);
    }

    pub fn addHeaderSpanTwo(_: *@This(), header: [:0]const u8) void {
        pi.php_info_print_table_colspan_header(2, header);
    }

    pub fn addHeaderSpanThree(_: *@This(), header: [:0]const u8) void {
        pi.php_info_print_table_colspan_header(3, header);
    }

    pub fn addTwoColumns(_: *@This(), col0: [:0]const u8, col1: [:0]const u8) void {
        pi.php_info_print_table_row(2, col0.ptr, col1.ptr);
    }

    pub fn addThreeColumns(_: *@This(), col0: [:0]const u8, col1: [:0]const u8, col2: [:0]const u8) void {
        pi.php_info_print_table_row(3, col0.ptr, col1.ptr, col2.ptr);
    }
};
