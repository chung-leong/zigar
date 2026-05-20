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
        $this->expectOutputString(<<<OUTPUT
        Handel: Music for the Royal Fireworks (Original Version 1749) - English Concert & Trevor Pinnock
        Armada: Music from the Courts of England and Spain - Fretwork
        Purcell: Music for the Queen Mary - Equale Brass Ensemble, John Eliot Gardiner & Munich Monteverdi Orchestra and Choir
        Mozart: Chamber Music - Nash Ensemble

        OUTPUT);
        $m->search('music');
    }

    public function testUseZigSqliteInMultithreadMode(): void
    {
        $m = ZigImporter::load(__DIR__ . '/use-zig-sqlite/zig-sqlite-threaded.zig', [
            'multithreaded' => true,
        ]);
        $path = __DIR__ . '/use-zig-sqlite/chinook.db';
        $content = file_get_contents($path);
        $file = new VirtualFile($content);
        $dir = new VirtualDir([ 'chinook.db' => $file ]);
        VirtualFSStream::add_root_node('test', $dir);
        $handle = opendir('vfs://test');
        $m->__zigar->redirect('root', $handle);
        $m->startup();
        try {
            $m->open();
            $results = $m->search('death');
            $this->assertEquals([
                (object) [
                    'AlbumId' => 94,
                    'Title' => 'A Matter of Life and Death',
                    'ArtistId' => 90,
                    'Artist' => 'Iron Maiden',
                ],
                (object) [
                    'AlbumId' => 98,
                    'Title' => 'Dance Of Death',
                    'ArtistId' => 90,
                    'Artist' => 'Iron Maiden',
                ],
                (object) [
                    'AlbumId' => 102,
                    'Title' => 'Live After Death',
                    'ArtistId' => 90,
                    'Artist' => 'Iron Maiden',
                ],
            ], $results->__plain);
            $m->close();
        } finally {
            $m->shutdown();
        }
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

