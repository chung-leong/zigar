<?php declare(strict_types=1);

final class PackageManagerTest extends ZigarTestCase
{   
    public function testLinkInZiglua(): void
    {
        $m = ZigImporter::load(__DIR__ . '/use-ziglua/ziglua.zig');
        $this->expectOutputString(<<<OUTPUT
        Hello world

        OUTPUT);
        $m->run('print "Hello world"');
    }

    public function testLinkInZigSqlite(): void
    {
        $m = ZigImporter::load(__DIR__ . '/use-zig-sqlite/zig-sqlite.zig', [
            'use_llvm' => true,
        ]);
    }

    public function testLinkInLocalPackage(): void
    {
        $m = ZigImporter::load(__DIR__ . '/use-local/local.zig');
        $this->expectOutputString(<<<OUTPUT
        sum = 579

        OUTPUT);
        $m->hello();
    }
}
