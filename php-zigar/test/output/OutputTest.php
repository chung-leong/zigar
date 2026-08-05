<?php declare(strict_types=1);

final class OutputTest extends ZigarTestCase
{   
    public function testPrintToPhpOutput(): void
    {
        $m = ZigImporter::load(__DIR__ . '/print-with-newline.zig');
        $this->expectOutput(<<<OUTPUT
        Hello world!
        
        OUTPUT);
        $m->hello();
    }

    public function testPrintThruC(): void
    {
        $m = ZigImporter::load(__DIR__ . '/print-thru-c.zig');
        switch (PHP_OS_FAMILY) {
            case 'Windows': $error_msg = 'Permission denied'; break;
            default: $error_msg = 'No such file or directory';
        }
        $this->expectOutput(<<<OUTPUT
        Hello 1234
        Hello Richard Nixon
        Hello 1234 3.14
        Hello Joe Blow
        H
        H
        H
        Hello world
        Hello world
        Hello worldHello worldHello: $error_msg
        
        OUTPUT);
        $m->test_printf();
        $m->test_fprintf();
        $m->test_putc();
        $m->test_fputc();
        $m->test_putchar();
        $m->test_fputs();
        $m->test_puts();
        $m->test_fwrite();
        $m->test_write();
        $m->test_perror();
    }
}
