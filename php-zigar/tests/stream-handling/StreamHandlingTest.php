<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class StreamHandlingTest extends TestCase
{
    public function testOpenAndCloseFile(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-and-close-file.zig');
        $path = "php://memory";
        $m->check($path);
    }

    public function testReadFromFile(): void
    {
        $m = ZigImporter::load(__DIR__ . '/read-from-file.zig');
    }

    public function testOpenAndReadFromFileUsingPosixFunctions(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-and-read-file-with-posix-functions.zig');
        $correct = 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
        $path = __DIR__ . '/data/test.txt';
        $url = "/php://filter/resource=${path}";
        $hash = (string) $m->hash($url);
        $this->assertSame($correct, $hash);
    }

    public function testOpenAndReadFromFileUsingLibcFunctions(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-and-read-file-with-libc-functions.zig');
        $correct = 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
        $path = __DIR__ . '/data/test.txt';
        $url = "/php://filter/resource=${path}";
        $hash = (string) $m->hash($url);
        $this->assertSame($correct, $hash);
    }

    public function testReadFromFileInMainThread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/read-from-file-in-main-thread.zig');
        $correct = 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
    }

    public function testOpenAndReadFromFileInMainThread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-and-read-from-file-in-main-thread.zig');
    }
}
