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

    public function testReadFromFileInMainThread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/read-from-file-in-main-thread.zig');
        $correct = (PHP_OS_FAMILY === 'Windows') 
        ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
        : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
    }

    public function testOpenAndReadFromFileInMainThread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-and-read-from-file-in-main-thread.zig');
    }
}
