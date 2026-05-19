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
        $m = ZigImporter::load(__DIR__ . '/use-zig-sqlite/zig-sqlite.zig');
        // VirtualDir, VirtualFile, and VirtualFSStream are defined in ../stream-handling/StreamHandlingTest.php
        $path = __DIR__ . '/use-zig-sqlite/chinook.db';
        $content = file_get_contents($path);
        $file = new VirtualFile($content);
        $dir = new VirtualDir([ 'chinook.db' => $file ]);
        VirtualFSStream::add_root_node('test', $dir);
        $handle = opendir('vfs://test');
        $m->__zigar->redirect('root', $handle);
        $m->search('music');
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

