const c = @cImport({
    @cInclude("print-thru-c.c");
});

pub const test_printf = c.test_printf;
pub const test_fprintf = c.test_fprintf;
pub const test_putc = c.test_putc;
pub const test_fputc = c.test_fputc;
pub const test_putchar = c.test_putchar;
pub const test_fputs = c.test_fputs;
pub const test_puts = c.test_puts;
pub const test_fwrite = c.test_fwrite;
pub const test_write = c.test_write;
pub const test_perror = c.test_perror;
