<?php declare(strict_types=1);

final class StreamHandlingTest extends ZigarTestCase
{
    public function testReadFromFile(): void
    {
        $m = ZigImporter::load(__DIR__ . '/read-from-file.zig');
        $correct = (PHP_OS_FAMILY === 'Windows')
        ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
        : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
        $m->startup(1);
        $path = __DIR__ . '/data/test.txt';        
        try {
            $f = fopen($path, 'r');
            $digest1 = $m->hash($f);
            $this->assertSame($correct, $digest1->__string);
        } finally {
            $m->shutdown();
        }
    }
    
    public function testReadFromFileInMainThread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/read-from-file-in-main-thread.zig');
        $correct = (PHP_OS_FAMILY === 'Windows')
        ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
        : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
        $path = __DIR__ . '/data/test.txt';        
        $f = fopen($path, 'r');
        $digest1 = $m->hash($f);
        $this->assertSame($correct, $digest1->__string);
    }

    public function testOpenAndReadFromFileInMainThread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-and-read-from-file-in-main-thread.zig');
        $correct = (PHP_OS_FAMILY === 'Windows')
        ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
        : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
        $path = __DIR__ . '/data/test.txt';        
        $content = file_get_contents($path);
        $url_path = '/data://text/plain;base64,' . base64_encode($content);
        $digest = $m->hash($url_path);
        $this->assertSame($correct, $digest->__string);
    }

    public function testOpenAndReadFromFileSystem(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-and-read-from-file-system.zig');
        $correct = (PHP_OS_FAMILY === 'Windows')
        ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
        : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
        $path = __DIR__ . '/data/test.txt';        
        $digest = $m->hash($path);
        $this->assertSame($correct, $digest->__string);
    }

    public function testOpenAndReadFromFileSystemUsingPosixFunctions(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-and-read-from-file-system-with-posix-function.zig');
        $correct = 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
        $path = __DIR__ . '/data/test.txt';
        $digest = $m->hash($path);
        $this->assertSame($correct, $digest->__string);
    }

    public function testOpenAndReadFromFileSystemUsingLibcFunctions(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-and-read-from-file-system-with-libc-function.zig');
        $correct = 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
        $path = __DIR__ . '/data/test.txt';
        $digest = $m->hash($path);
        $this->assertSame($correct, $digest->__string);
    }

    /**
     * @requires OS Linux
     */
    public function testOpenFileUsingDirectSyscall(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-file-through-direct-syscall.zig');
        $url_path = '/data://text/plain;base64,SSBsb3ZlIFBIUAo=';
        $result = $m->check($url_path);
        $this->assertTrue($result);
    }

    public function testOpenAndReadFromFileUsingPosixFunctions(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-and-read-file-with-posix-functions.zig');
        $correct = (PHP_OS_FAMILY === 'Windows')
        ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
        : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
        $path = __DIR__ . '/data/test.txt';        
        $content = file_get_contents($path);
        $url_path = '/data://text/plain;base64,' . base64_encode($content);
        $digest = $m->hash($url_path);
        $this->assertSame($correct, $digest->__string);
    }

    public function testOpenAndReadFromFileUsingLibcFunctions(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-and-read-file-with-libc-functions.zig');
        $correct = (PHP_OS_FAMILY === 'Windows')
        ? '8b25078fffd077f119a53a0121a560b3eba816a0' 
        : 'bbfdc0a41a89def805b19b4f90bb1ce4302b4aef';
        $path = __DIR__ . '/data/test.txt';        
        $content = file_get_contents($path);
        $url_path = '/data://text/plain;base64,' . base64_encode($content);
        $digest = $m->hash($url_path);
        $this->assertSame($correct, $digest->__string);
    }

    public function testSeekToParticularPosition(): void
    {
        $m = ZigImporter::load(__DIR__ . '/seek-file.zig');
        $path = __DIR__ . '/data/test.txt';        
        $content = file_get_contents($path);
        $url = 'data://text/plain;base64,' . base64_encode($content);
        $f = fopen($url, 'r');
        $chunk = $m->read($f, 32, 16);
        $this->assertSame('ur fathers broug', (string) $chunk);
    }

    public function testSeekToParticularPositionInThread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/seek-file-in-thread.zig');
        $m->startup(1);
        try {
            $path = __DIR__ . '/data/test.txt';        
            $content = file_get_contents($path);
            $url = 'data://text/plain;base64,' . base64_encode($content);
            $f = fopen($url, 'r');
            $chunk = $m->read($f, 32, 16);
            $this->assertSame('ur fathers broug', (string) $chunk);
        } finally {
            $m->shutdown();
        }
    }

    public function testOpenFileAndSeekToParticularPositionUsingPosixFunctions(): void
    {
        $m = ZigImporter::load(__DIR__ . '/seek-file-with-posix-functions.zig');
        $path = __DIR__ . '/data/test.txt';        
        $content = file_get_contents($path);
        $url_path = '/data://text/plain;base64,' . base64_encode($content);
        $chunk = $m->read($url_path, 32, 16);
        $this->assertSame('ur fathers broug', (string) $chunk);
    }

    public function testOpenFileAndSeekToParticularPositionUsingLibcFunctions(): void
    {
        $m = ZigImporter::load(__DIR__ . '/seek-file-with-libc-functions.zig');
        $path = __DIR__ . '/data/test.txt';        
        $content = file_get_contents($path);
        $url_path = '/data://text/plain;base64,' . base64_encode($content);
        $chunk = $m->read($url_path, 32, 16);
        $this->assertSame('ur fathers broug', (string) $chunk);
    }

    public function testObtainExpectedPositionAfterSeekUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/return-file-position-with-posix-functions.zig');
        $content = 'Hello world!';
        $url_path = '/data://text/plain;base64,' . base64_encode($content);
        $pos = $m->seek($url_path, -2);
        $this->assertSame($pos, strlen($content) - 2);
    }

    public function testObtainExpectedPositionAfterSeekUsingLibcFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/return-file-position-with-libc-functions.zig');
        $content = 'Hello world!';
        $url_path = '/data://text/plain;base64,' . base64_encode($content);
        $pos = $m->seek($url_path, -2);
        $this->assertSame($pos, strlen($content) - 2);
    }

    public function testSaveAndRestoreFilePositionUsingLibcFunctions(): void
    {
        $m = ZigImporter::load(__DIR__ . '/save-and-restore-file-position-with-libc-functions.zig');
        $path = __DIR__ . '/data/test.txt';        
        $content = file_get_contents($path);
        $url_path = '/data://text/plain;base64,' . base64_encode($content);
        $this->expectOutput(<<<OUTPUT
        ur fathers broug
        ur fathers broug

        OUTPUT);
        $m->printTwice($url_path, 32, 16);
    }

    public function testWriteToFile(): void 
    {
        global $output;
        $m = ZigImporter::load(__DIR__ . '/write-to-file.zig');
        $m->startup(1);
        try {
            $output = '';
            $f = fopen('var://output', 'w');
            $len = $m->save('This is a test', $f);
            $this->assertSame(14, $len);
            $this->assertSame('This is a test', $output);
        } finally {
            $m->shutdown();
        }
    }

    public function testWriteToFileInMainThread(): void 
    {
        global $output;
        $m = ZigImporter::load(__DIR__ . '/write-to-file-in-main-thread.zig');
        $output = '';
        $f = fopen('var://output', 'w');
        $len = $m->save('This is a test', $f);
        $this->assertSame(14, $len);
        $this->assertSame('This is a test', $output);
    }

    public function testOpenAndWriteToFileInMainThread(): void 
    {
        global $output;
        $m = ZigImporter::load(__DIR__ . '/open-and-write-to-file-in-main-thread.zig');
        $output = '';
        $url_path = '/var://output';
        $len = $m->save($url_path, "This is a test");
        $this->assertSame(14, $len);
        $this->assertSame("This is a test", $output);
    }

    public function testOpenAndWriteToFileUsingPosixFunctions(): void 
    {
        global $output;
        $m = ZigImporter::load(__DIR__ . '/open-and-write-to-file-with-posix-functions.zig');
        $output = '';
        $url_path = '/var://output';
        $len = $m->save($url_path, "This is a test");
        $this->assertSame(14, $len);
        $this->assertSame("This is a test", $output);
    }

    public function testOpenAndWriteToFileUsingLibcFunctions(): void 
    {
        global $output;
        $m = ZigImporter::load(__DIR__ . '/open-and-write-to-file-with-libc-functions.zig');
        $output = '';
        $url_path = '/var://output';
        $len = $m->save($url_path, "This is a test");
        $this->assertSame(14, $len);
        $this->assertSame("This is a test", $output);
    }

    /**
     * @requires OS Windows
     */
    public function testOpenAndWriteToFileUsingWin32Functions(): void 
    {
        global $output;
        $m = ZigImporter::load(__DIR__ . '/open-and-write-to-file-with-win32-functions.zig');
        // TODO
    }

    public function testObtainErrorCodeUsingLibcFunction(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/return-last-error-with-libc-function.zig');
        $result = $m->triggerError("/cow://moo");
    }

    public function testDetectEndOfFileUsingLibcFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/detect-end-of-file-with-libc-function.zig');
        $url_path = '/data://text/plain;base64,' . base64_encode(str_repeat(' ', 256));
        $result = $m->detectEOF($url_path);
        $this->assertTrue($result);
    }

    public function testRewindFileUsingLibcFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/rewind-file-with-libc-function.zig');
        $url_path = '/data://text/plain;base64,' . base64_encode(str_repeat(' ', 256));
        $result = $m->getStartingPos($url_path);
        $this->assertSame(0, $result);
    }

    public function testCheckFileAccessUsingPosixFunction(): void
    {
        global $output, $stat;
        $m = ZigImporter::load(__DIR__ . '/check-access-with-posix-function.zig');
        $output = '';
        $stat = [
            'mode' => 0o0100000,
            'size' => 5,
        ];
        $url_path = '/var://output/stat';
        $result1 = $m->check($url_path, read: true);
        $this->assertTrue($result1);
        $result2 = $m->check($url_path, write: true);
        $this->assertTrue($result2);
        $result3 = $m->check($url_path, execute: true);
        $this->assertFalse($result3);
        $stat = [
            'mode' => 0o0040000,
            'size' => 0,
        ];
        $result4 = $m->check($url_path, execute: true);
        $this->assertTrue($result4);
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testCheckAccessOfFileInDirectoryUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/check-access-at-dir-with-posix-function.zig');
        $file1 = new VirtualFile();
        $file1->mode = 0o0100000 | 0111;
        $file2 = new VirtualFile();
        $file2->mode = 0o0100000 | 0222;
        $subdir = new VirtualDir();
        $dir = new VirtualDir([ 
            'readable.txt' => $file1,
            'writable.txt' => $file2,
            'subdirectory' => $subdir,
        ]);
        VirtualFSStream::add_root_node('hello', $dir);
        $handle = opendir("vfs://hello");
        $result1 = $m->check($handle, 'readable.txt', read: true);
        $result2 = $m->check($handle, 'writable.txt', write: true);
        $result3 = $m->check($handle, 'subdirectory', execute: true);
        $this->assertTrue($result1);
        $this->assertTrue($result2);
        $this->assertTrue($result3);
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testCheckAccessOfFileInDirectoryInFileSystemUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/check-access-at-dir-in-file-system-with-posix-function.zig');
        $path = __DIR__ . '/data/statat_test';
        mkdir($path, 0o0777, true);
        try {
            file_put_contents("$path/file.txt", "Hello world");
            $result = $m->check($path, "file.txt", read: true);
            $this->assertTrue($result);
        } finally {
            unlink("$path/file.txt");
            rmdir($path);
        }
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testOpenFileInDirectoryUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-file-at-dir-with-posix-function.zig');
        $file = new VirtualFile();
        $dir = new VirtualDir([ 'writable.txt' => $file ]);
        VirtualFSStream::add_root_node('hello', $dir);
        $handle = opendir("vfs://hello");
        $text = 'Hello world!!!';
        $len = $m->write($handle, 'writable.txt', $text);
        $this->assertSame(strlen($text), $len);
        $this->assertSame($text, $file->content);
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testOpenFileInDirectoryInFileSystemUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-file-at-dir-in-file-system-with-posix-function.zig');
        $path = __DIR__ . '/data/openat_test';
        mkdir($path, 0o0777, true);
        try {
            $text = 'Hello world!!!';
            $len = $m->write($path, "writable.txt", $text);
            $this->assertSame(strlen($text), $len);
            $content = file_get_contents("$path/writable.txt");
            $this->assertSame($text, $content);
        } finally {
            unlink("$path/writable.txt");
            rmdir($path);
        }
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testRetrieveStatsOfFileInDirectoryUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/stat-file-at-dir-with-posix-function.zig');
        $file = new VirtualFile('This is a test and this is only a test');
        $file->ctime = 123;
        $file->mtime = 124;
        $file->atime = 125;
        $dir = new VirtualDir([ "test.txt" => $file ]);
        VirtualFSStream::add_root_node('hello', $dir);
        $handle = opendir('vfs://hello');
        $this->expectOutput(<<<OUTPUT
        size = 38
        ctime = 123,0
        mtime = 124,0
        atime = 125,0

        OUTPUT);
        $m->stat($handle, 'test.txt');
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testRetrieveStatsOfFileInDirectoryInFileSystemUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/stat-file-at-dir-in-file-system-with-posix-function.zig');
        $path = __DIR__ . '/data/statat_test';
        mkdir($path, 0777, true);
        file_put_contents("$path/file.txt", "Hello world");
        try {
            $this->expectOutput(<<<OUTPUT
            size = 11

            OUTPUT);
            $m->stat($path, "file.txt");
        } finally {
            unlink("$path/file.txt");
            rmdir($path);
        }
    }

    public function testDecompressGzipFile(): void
    {
        $m = ZigImporter::load(__DIR__ . '/decompress.zig');
        $m->startup(1);
        try {
            $input_path = __DIR__ . '/data/test.txt.gz';
            $input = fopen($input_path, 'r');
            $output_path = __DIR__ . '/data/decompressed.txt';
            $output = fopen($output_path, 'w');
            $m->decompress($input, $output);
            fclose($input);
            fclose($output);
            $content = file_get_contents($output_path);
            $this->assertStringContainsString('Four score', $content);
            $this->assertStringContainsString('shall not perish from the earth', $content);
        } finally {
            $m->shutdown();
        }
    }

    public function testGetStatsOfVirtualFile(): void
    {
        $m = ZigImporter::load(__DIR__ . '/stat-opened-file.zig');
        $file = new VirtualFile('This is a test and this is only a test');
        $file->ctime = 1234;
        $dir = new VirtualDir([ "test.txt" => $file ]);
        VirtualFSStream::add_root_node('hello', $dir);
        $handle = fopen("vfs://hello/test.txt", 'r');
        $this->expectOutput(<<<OUTPUT
        size = 38
        ctime = 1234000000000
        mtime = 0
        atime = 0

        OUTPUT);
        $m->print($handle);
    }

    public function testGetStatsOfOpenedFileUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/stat-opened-file-with-posix-function.zig');
        $file = new VirtualFile('This is a test and this is only a test');
        $file->ctime = 1234;
        $dir = new VirtualDir([ "test.txt" => $file ]);
        VirtualFSStream::add_root_node('hello', $dir);
        $this->expectOutput(<<<OUTPUT
        size = 38
        ctime = 1234,0
        mtime = 0,0
        atime = 0,0

        OUTPUT);
        $m->print("/vfs://hello/test.txt");
    }

    public function testGetStatsOfOpenedFileInFileSystemUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/stat-opened-file-in-file-system-with-posix-function.zig');
        $path = __DIR__ . '/data/fstat_test';        
        file_put_contents($path, 'This is a test and this is only a test');
        try {
            $this->expectOutput(<<<OUTPUT
            size = 38

            OUTPUT);
            $m->print($path);
        } finally {
            unlink($path);
        }
    }

    public function testGetStatsOfFileReferencedByPathUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/stat-file-by-path-with-posix-function.zig');
        $file = new VirtualFile('This is a test and this is only a test');
        $file->ctime = 1234;
        $file->atime = 4567;
        $file->mtime = 8888;
        $dir = new VirtualDir([ "test.txt" => $file ]);
        VirtualFSStream::add_root_node('hello', $dir);
        $this->expectOutput(<<<OUTPUT
        size = 38
        ctime = 1234,0
        mtime = 8888,0
        atime = 4567,0

        OUTPUT);
        $m->print("/vfs://hello/test.txt");
    }

    /**
     * @requires OS Windows
     */
    public function testGetSizeOfOpenedFileUsingWin32Function(): void
    {
        // TODO
    }

    /**
     * @requires OS Windows
     */
    public function testGetStatsOfOpenedFileUsingWin32Function(): void
    {
        // TODO
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testSetAccessAndModifiedTimeOfOpenedFileUsingPosixFunction(): void    
    {
        $m = ZigImporter::load(__DIR__ . '/set-times-of-opened-file-with-posix-function.zig');
        $file = new VirtualFile('Hello world!!!');
        $dir = new VirtualDir([ 'hello.txt' => $file ]);
        VirtualFSStream::add_root_node('test', $dir);
        $m->setTimes('/vfs://test/hello.txt', 123, 456);
        $this->assertSame(123, $file->atime);
        $this->assertSame(456, $file->mtime);
    }

    /**
     * @requires OS Windows
     */
    public function testSetAccessAndModifiedTimeOfOpenedFileUsingFutime(): void
    {
        // TODO
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testSetAccessAndModifiedTimeOfOpenedFileUsingPosixFunctionWithNsPrecision(): void    
    {
        $m = ZigImporter::load(__DIR__ . '/set-ns-times-of-opened-file-with-posix-function.zig');
        $file = new VirtualFile('Hello world!!!');
        $dir = new VirtualDir([ 'hello.txt' => $file ]);
        VirtualFSStream::add_root_node('test', $dir);
        $m->setTimes('/vfs://test/hello.txt', 123, 456);
        $this->assertSame(123, $file->atime);
        $this->assertSame(456, $file->mtime);
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testSetAccessAndModifiedTimeOfFileUsingPosixFunction(): void    
    {
        $m = ZigImporter::load(__DIR__ . '/set-times-of-file-by-path-with-posix-function.zig');
        $file1 = new VirtualFile('Hello world!!!');
        $file2 = new VirtualFile('Hello world!!!');
        $dir = new VirtualDir([ 
            'hello.txt' => $file1,
            'world.txt' => $file2,
        ]);
        VirtualFSStream::add_root_node('test', $dir);
        $m->setTimes('/vfs://test/hello.txt', 123, 456);
        $this->assertSame(123, $file1->atime);
        $this->assertSame(456, $file1->mtime);
        $m->setLinkTimes('/vfs://test/world.txt', 1234, 5678);
        $this->assertSame(1234, $file2->atime);
        $this->assertSame(5678, $file2->mtime);
    }

    public function testSetAccessAndModifiedTimeOfFileInDirectoryUsingPosixFunction(): void    
    {
        $m = ZigImporter::load(__DIR__ . '/set-times-of-file-at-dir-with-posix-function.zig');
        $file = new VirtualFile('Hello world!!!');
        $dir = new VirtualDir([ 'hello.txt' => $file ]);
        VirtualFSStream::add_root_node('test', $dir);
        $handle = opendir('vfs://test');
        $m->setTimes($handle, 'hello.txt', 123, 456);
        $this->assertSame(123, $file->atime);
        $this->assertSame(456, $file->mtime);
    }

    public function testGetDirectoryEntries(): void
    {
        $m = ZigImporter::load(__DIR__ . '/read-directory.zig');
        $dir1 = new VirtualDir([ 
            'hello.txt' => new VirtualFile(),
            'world' => new VirtualDir(),
        ]);
        VirtualFSStream::add_root_node('test1', $dir1);
        $handle1 = opendir('vfs://test1');
        $this->expectOutput(<<<OUTPUT
        hello.txt file
        world directory

        OUTPUT);
        $m->print($handle1);
        closedir($handle1);
        $initializers = [];
        for ($i = 0; $i < 100; $i++) {
            $name = str_repeat('x', $i + 1) . '.txt';
            $initializers[$name] = new VirtualFile();
        }
        $dir2 = new VirtualDir($initializers);
        VirtualFSStream::add_root_node('test2', $dir2);
        $handle2 = opendir('vfs://test2');
        ob_start();
        $m->print($handle2);
        $text = ob_get_clean();
        $lines = explode("\n", trim($text));
        $this->assertSame(100, count($lines));
        closedir($handle2);
    }

    public function testGetDirectoryEntriesInThread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/read-directory-in-thread.zig');
        $dir1 = new VirtualDir([ 
            'hello.txt' => new VirtualFile(),
            'world' => new VirtualDir(),
        ]);
        $m->startup(1);
        try {
            VirtualFSStream::add_root_node('test1', $dir1);
            $handle1 = opendir('vfs://test1');
            $this->expectOutput(<<<OUTPUT
            hello.txt file
            world directory

            OUTPUT);
            $m->print($handle1);
            closedir($handle1);
            $initializers = [];
            for ($i = 0; $i < 100; $i++) {
                $name = str_repeat('x', $i + 1) . '.txt';
                $initializers[$name] = new VirtualFile();
            }
            $dir2 = new VirtualDir($initializers);
            VirtualFSStream::add_root_node('test2', $dir2);
            $handle2 = opendir('vfs://test2');
            ob_start();
            $m->print($handle2);
            $text = ob_get_clean();
            $lines = explode("\n", trim($text));
            $this->assertSame(100, count($lines));
            closedir($handle2);
        } finally {
            $m->shutdown();
        }
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testPerformSyncOperationUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/perform-sync-with-posix-function.zig');
        $file = new VirtualFile();
        $dir = new VirtualDir([ 'hello.txt' => $file ]);
        VirtualFSStream::add_root_node('test', $dir);
        $m->save("/vfs://test/hello.txt", "This is a test");
        $this->assertSame("This is a test", $file->content);
    }

    /**
     * @requires OS Linux
     */
    public function testPerformDataSyncOperationUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/perform-datasync-with-posix-function.zig');
        $file = new VirtualFile();
        $dir = new VirtualDir([ 'hello.txt' => $file ]);
        VirtualFSStream::add_root_node('test', $dir);
        $m->save("/vfs://test/hello.txt", "This is a test");
        $this->assertSame("This is a test", $file->content);
    }

    /**
     * @requires OS Linux
     */
    public function testPerformAdviseOperationUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/perform-advise-with-posix-function.zig');
        $file = new VirtualFile();
        $dir = new VirtualDir([ 'hello.txt' => $file ]);
        VirtualFSStream::add_root_node('test', $dir);
        $m->save("/vfs://test/hello.txt", "This is a test");
        $this->assertSame("This is a test", $file->content);
    }

    /**
     * @requires OS Linux
     */
    public function testFailToPerformAllocateOperationUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/perform-allocate-with-posix-function.zig');
        $file = new VirtualFile();
        $dir = new VirtualDir([ 'hello.txt' => $file ]);
        VirtualFSStream::add_root_node('test', $dir);
        $this->assertExceptionMessage('allocation failed', function() use($m) {
            $m->save("/vfs://test/hello.txt", "This is a test");
        });
    }

    public function testOpenFileInDirectory(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-file-at-dir.zig');
        $dir = new VirtualDir([
            'hello.txt' => new VirtualFile('Hello world'),
            'test.txt' => new VirtualFile('This is a test and this is only a test'),
            'world' => new VirtualDir(),
        ]);
        VirtualFSStream::add_root_node('test', $dir);
        $this->expectOutput(<<<OUTPUT
        This is a test and this is only a test
        OUTPUT);
        $handle = opendir('vfs://test');
        $m->print($handle, 'test.txt');
    } 

    public function testRetrieveNamesOfFilesInDirectory(): void
    {
        $m = ZigImporter::load(__DIR__ . '/scan-directory.zig');
        $dir = new VirtualDir([
            'hello.txt' => new VirtualFile('Hello world'),
            'test.txt' => new VirtualFile('This is a test and this is only a test'),
            'world' => new VirtualDir(),
        ]);
        VirtualFSStream::add_root_node('test', $dir);
        $this->expectOutput(<<<OUTPUT
        hello.txt (file)
        test.txt (file)
        world (dir)

        OUTPUT);
        $handle = opendir('vfs://test');
        $m->print($handle);
    } 

    public function testRetrieveNamesOfFilesInDirectoryUsingPosixFunctions(): void
    {
        $m = ZigImporter::load(__DIR__ . '/scan-directory-with-posix-functions.zig');
        $dir = new VirtualDir([
            'hello.txt' => new VirtualFile('Hello world'),
            'test.txt' => new VirtualFile('This is a test and this is only a test'),
            'world' => new VirtualDir(),
        ]);
        VirtualFSStream::add_root_node('test', $dir);
        $this->expectOutput(<<<OUTPUT
        hello.txt (file)
        test.txt (file)
        world (dir)

        OUTPUT);
        $m->print('/vfs://test');
    } 

    public function testDeleteFileInDirectory(): void
    {
        $m = ZigImporter::load(__DIR__ . '/delete-file-at-dir.zig');
        $dir = new VirtualDir([
            'hello.txt' => new VirtualFile('Hello world'),
            'test.txt' => new VirtualFile('This is a test and this is only a test'),
            'world' => new VirtualDir(),
        ]);
        VirtualFSStream::add_root_node('test', $dir);
        $handle = opendir("vfs://test");
        $m->remove($handle, 'test.txt');
        $this->assertArrayNotHasKey('test.txt', $dir->children);
        $this->assertExceptionMessage('not found', function() use($handle, $m) {
            $m->remove($handle, 'test.txt');
        });
    }

    public function testRemoveDirectoryInDirectory(): void
    {
        $m = ZigImporter::load(__DIR__ . '/remove-directory-at-dir.zig');
        $dir = new VirtualDir([
            'hello.txt' => new VirtualFile('Hello world'),
            'test.txt' => new VirtualFile('This is a test and this is only a test'),
            'world' => new VirtualDir(),
        ]);
        VirtualFSStream::add_root_node('test', $dir);
        $handle = opendir("vfs://test");
        $m->remove($handle, 'world');
        $this->assertArrayNotHasKey('world', $dir->children);
        $this->assertExceptionMessage('not found', function() use($handle, $m) {
            $m->remove($handle, 'world');
        });
    }

    public function testMakeDirectoryInDirectory(): void
    {
        $m = ZigImporter::load(__DIR__ . '/make-directory-at-dir.zig');
        $dir = new VirtualDir([
            'hello.txt' => new VirtualFile('Hello world'),
            'test.txt' => new VirtualFile('This is a test and this is only a test'),
            'world' => new VirtualDir(),
        ]);
        VirtualFSStream::add_root_node('test', $dir);
        $handle = opendir("vfs://test");
        $m->add($handle, 'cow');
        $this->assertArrayHasKey('cow', $dir->children);
        $this->assertExceptionMessage('path already exists', function() use($handle, $m) {
            $m->add($handle, 'world');
        });
    }

    public function testFailToPollFile(): void
    {
        $m = ZigImporter::load(__DIR__ . '/poll-file.zig');
        $dir = new VirtualDir([
            'hello.txt' => new VirtualFile('Hello world'),
            'world.txt' => new VirtualFile('Hello world'),
        ]);
        VirtualFSStream::add_root_node('test', $dir);
        $f1 = fopen("vfs://test/hello.txt", 'r');
        $f2 = fopen("vfs://test/world.txt", 'r');
        $result = $m->poll($f1, $f2);
        $this->assertSame(-1, $result);
    }

    public function testCreateDirectoryUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-directory-with-posix-function.zig');
        $dir = new VirtualDir([
            'world' => new VirtualDir(),
        ]);
        VirtualFSStream::add_root_node('test', $dir);
        $m->create('/vfs://test/world/hello');
        $subdir = VirtualFSStream::get_node('vfs://test/world');
        $this->assertArrayHasKey('hello', $subdir->children);
    }

    public function testRemoveDirectoryUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/remove-directory-with-posix-function.zig');
        $subdir = new VirtualDir([
            'hello' => new VirtualDir(),
        ]);
        $dir = new VirtualDir([
            'world' => $subdir,
        ]);
        VirtualFSStream::add_root_node('test', $dir);
        $this->assertArrayHasKey('hello', $subdir->children);
        $m->remove('/vfs://test/world/hello');
        $this->assertArrayNotHasKey('hello', $subdir->children);
    }

    public function testRenameFile(): void
    {
        $m = ZigImporter::load(__DIR__ . '/rename-file.zig');
        $subdir = new VirtualDir([
            'hello.txt' => new VirtualFile('Hello world!'),
        ]);
        $dir = new VirtualDir([
            'world' => $subdir,
            'donut' => new VirtualDir(),
        ]);
        VirtualFSStream::add_root_node('test', $dir);
        $this->assertArrayHasKey('hello.txt', $subdir->children);
        $m->rename('/vfs://test/world/hello.txt', '/vfs://test/donut/earth.txt');
        $this->assertArrayNotHasKey('hello.txt', $subdir->children);
        $content = file_get_contents('vfs://test/donut/earth.txt');
        $this->assertSame('Hello world!', $content);
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testRenameFileInDirectory(): void
    {
        $m = ZigImporter::load(__DIR__ . '/rename-file-at-dir.zig');
        $subdir = new VirtualDir([
            'hello.txt' => new VirtualFile('Hello world!'),
        ]);
        $dir = new VirtualDir([
            'world' => $subdir,
        ]);
        VirtualFSStream::add_root_node('test', $dir);
        $handle = opendir('vfs://test/world');
        $this->assertArrayHasKey('hello.txt', $subdir->children);
        $m->rename($handle, 'hello.txt', 'earth.txt');
        $this->assertArrayNotHasKey('hello.txt', $subdir->children);
        $content = file_get_contents('vfs://test/world/earth.txt');
        $this->assertSame('Hello world!', $content);
    }

    public function testRenameFileUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/rename-file-with-posix-function.zig');
        $subdir = new VirtualDir([
            'hello.txt' => new VirtualFile('Hello world!'),
        ]);
        $dir = new VirtualDir([
            'world' => $subdir,
            'donut' => new VirtualDir(),
        ]);
        VirtualFSStream::add_root_node('test', $dir);
        $this->assertArrayHasKey('hello.txt', $subdir->children);
        $m->rename('/vfs://test/world/hello.txt', '/vfs://test/donut/earth.txt');
        $this->assertArrayNotHasKey('hello.txt', $subdir->children);
        $content = file_get_contents('vfs://test/donut/earth.txt');
        $this->assertSame('Hello world!', $content);
    }

    public function testRenameFileInDirectoryUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/rename-file-at-dir-with-posix-function.zig');
        $subdir = new VirtualDir([
            'hello.txt' => new VirtualFile('Hello world!'),
        ]);
        $dir = new VirtualDir([
            'world' => $subdir,
            'donut' => new VirtualDir(),
        ]);
        VirtualFSStream::add_root_node('test', $dir);
        $this->assertArrayHasKey('hello.txt', $subdir->children);
        $m->renameat('/vfs://test/world', 'hello.txt', '/vfs://test/donut', 'earth.txt');
        $this->assertArrayNotHasKey('hello.txt', $subdir->children);
        $content = file_get_contents('vfs://test/donut/earth.txt');
        $this->assertSame('Hello world!', $content);
    }

    public function testRenameFileInFileSystemUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/rename-file-in-file-system-with-posix-function.zig');
        $path = __DIR__ . '/data/rename_test.txt';
        $new_path = __DIR__ . '/data/new_name_test.txt';
        file_put_contents($path, 'hello world');
        try {
            $m->rename($path, $new_path);
            $content = file_get_contents($new_path);
            $this->assertSame('hello world', $content);
        } finally {
            unlink($new_path);
        }
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testFailToCreateSymlink(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-symlink.zig');
        $this->assertExceptionMessage('access denied', function() use($m) {
            $m->symlink('/vfs://test/hello/world.txt', '/vfs://test/hello/earth.txt');
        });
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testFailToCreateSymlinkInDirectory(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-symlink-at-dir.zig');
        $dir = new VirtualDir([
            'world.txt' => new VirtualFile('Hello world'),
        ]);
        VirtualFSStream::add_root_node('test', $dir);       
        $this->assertExceptionMessage('access denied', function() use($m) {
            $f = opendir('vfs://test');
            $m->symlink($f, 'world.txt', 'earth.txt');
        });
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testFailToCreateSymlinkUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-symlink-with-posix-function.zig');
        $dir = new VirtualDir([
            'world.txt' => new VirtualFile('Hello world'),
        ]);
        VirtualFSStream::add_root_node('test', $dir);       
        $f = opendir('vfs://test');
        $m->__zigar->redirect('root', $f);
        $this->assertExceptionMessage('unable to create symlink', function() use($m) {
            $m->symlink('/world.txt', '/earth.txt');
        });
    }

    /**
     * @requires OS Windows
     */
    public function testFailToCreateSymlinkUsingWin32Function(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-symlink-with-win32-function.zig');
        // TODO
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testFailToCreateSymlinkInDirectoryUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-symlink-at-dir-with-posix-function.zig');
        $dir = new VirtualDir([
            'world.txt' => new VirtualFile('Hello world'),
        ]);
        VirtualFSStream::add_root_node('test', $dir);       
        $this->assertExceptionMessage('unable to create symlink', function() use($m) {
            $m->symlinkat('/vfs://test/world.txt', '/vfs://test', 'earth.txt');
        });
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testSetMtimeAndATimeOfFileInFileSystemUsingPosixFunction(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/set-times-of-file-in-file-system-with-posix-functions.zig');
        $path = __DIR__ . '/data/settimes_test.txt';
        file_put_contents($path, 'Hello world');
        try {
            $m->setTimes($path, 3, 1234);
            $info = stat($path);
            $this->assertSame(3, $info['atime']);
            $this->assertSame(3, $info['mtime']);
        } finally {
            unlink($path);
        }
    }

    public function testScanDirectoryInFileSystemUsingPosixFunction(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/scan-directory-in-file-system-with-posix-functions.zig');
        $path = __DIR__ . '/data/readdir_test';
        mkdir($path, 0777, true);
        file_put_contents("$path/file1.txt", 'Hello world');
        file_put_contents("$path/file2.txt", 'Rats live on no evil start');
        try {
            ob_start();
            $m->print($path);
            $text = ob_get_clean();
            $this->assertStringContainsString('file1.txt (11 bytes)', $text);
            $this->assertStringContainsString('file2.txt (26 bytes)', $text);
        } finally {
            unlink("$path/file1.txt");
            unlink("$path/file2.txt");
            rmdir($path);
        }
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testOpenAndReadFromFileUsingPread(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/open-and-read-file-with-pread.zig');
        $path = __DIR__ . '/data/test.txt';        
        $content = file_get_contents($path);
        $url_path = '/data://text/plain;base64,' . base64_encode($content);
        $chunk = $m->readAt($url_path, 120, 16);
        $this->assertSame('cated to the pro', (string) $chunk);
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testOpenAndReadFromFileUsingPreadv(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/open-and-read-file-with-preadv.zig');
        $path = __DIR__ . '/data/test.txt';        
        $content = file_get_contents($path);
        $url_path = '/data://text/plain;base64,' . base64_encode($content);
        $vectors = [
            new Uint8Array(16),
            new Uint8Array(8),
            new Uint8Array(4),
        ];
        $count = $m->readAt($url_path, $vectors, 76);
        $this->assertSame(28, $count);        
        $this->assertSame([ 'a new nation, co', 'nceived ', 'in L' ], [
            (string) $vectors[0],
            (string) $vectors[1],
            (string) $vectors[2],
        ]);
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testOpenAndReadFromFileUsingReadv(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/open-and-read-file-with-readv.zig');
        $path = __DIR__ . '/data/test.txt';        
        $content = file_get_contents($path);
        $url_path = '/data://text/plain;base64,' . base64_encode($content);
        $vectors = [
            new Uint8Array(16),
            new Uint8Array(8),
            new Uint8Array(4),
        ];
        $count = $m->read($url_path, $vectors);
        $this->assertSame(28, $count);        
        $this->assertSame([ 'Four score and s', 'even yea', 'rs a' ], [
            (string) $vectors[0],
            (string) $vectors[1],
            (string) $vectors[2],
        ]);
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testOpenAndWriteToFileUsingPwrite(): void 
    {
        global $output;
        $m = ZigImporter::load(__DIR__ . '/open-and-write-file-with-pwrite.zig');
        $output = str_repeat(' ', 256);
        $url_path = '/var://output';
        $written = $m->writeAt($url_path, 'Hello world', 120);
        $this->assertSame(11, $written);
        $text = substr($output, 120, 11);
        $this->assertSame('Hello world', $text);
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testOpenAndWriteToFileUsingPwritev(): void 
    {
        global $output;
        $m = ZigImporter::load(__DIR__ . '/open-and-write-file-with-pwritev.zig');
        $output = str_repeat(' ', 256);
        $url_path = '/var://output';
        $written = $m->writeAt($url_path, [ 'Hello', ' world', '???' ], 120);
        $this->assertSame(14, $written);
        $text = substr($output, 120, 14);
        $this->assertSame('Hello world???', $text);
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testOpenAndWriteToFileUsingWritev(): void 
    {
        global $output;
        $m = ZigImporter::load(__DIR__ . '/open-and-write-file-with-writev.zig');
        $output = str_repeat(' ', 256);
        $url_path = '/var://output';
        $written = $m->write($url_path, [ 'Hello', ' world', '???' ]);
        $this->assertSame(14, $written);
        $text = substr($output, 0, 14);
        $this->assertSame('Hello world???', $text);
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testSetLockOnFile(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/set-lock-on-file.zig');
        $file = new VirtualFile();
        $dir = new VirtualDir([ 'hello.txt' => $file ]);
        VirtualFSStream::add_root_node('test', $dir);
        $f = fopen('vfs://test/hello.txt', 'w+');
        $result1 = $m->lock($f);
        $this->assertTrue($result1);
        $this->assertSame(LOCK_EX, $file->lock);
        $result2 = $m->lock($f);
        $this->assertFalse($result2);
        $result3 = $m->unlock($f);
        $this->assertTrue($result3);
        $this->assertSame(0, $file->lock);
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testSetLockOnFileUsingFcntl(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/set-lock-with-fcntl.zig');
        $file1 = new VirtualFile();
        $file2 = new VirtualFile();
        $dir = new VirtualDir([ 
            'hello.txt' => $file1,
            'world.txt' => $file2,
        ]);
        VirtualFSStream::add_root_node('test', $dir);
        $f1 = fopen('vfs://test/hello.txt', 'w+');
        $f2 = fopen('vfs://test/world.txt', 'w+');
        $m->lock($f1);
        $this->assertSame(LOCK_EX, $file1->lock);
        $this->assertExceptionMessage('unable to set lock', function() use($m, $f1) {
            $m->lock($f1);
        });
        $m->lock($f2);
        $this->assertSame(LOCK_EX, $file2->lock);
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testGetLockOnFileUsingFcntl(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/get-lock-with-fcntl.zig');
        $file = new VirtualFile();
        $dir = new VirtualDir([ 'hello.txt' => $file ]);
        VirtualFSStream::add_root_node('test', $dir);
        $f = fopen('vfs://test/hello.txt', 'w+');
        $result1 = $m->check($f, true);
        $this->assertTrue($result1);
        $m->lock($f, false);
        $result2 = $m->check($f, true);
        $this->assertFalse($result2);
        $result3 = $m->check($f, false);
        $this->assertTrue($result3);
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testSetLockOnFileUsingPosixFunction(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/set-lock-with-posix-function.zig');       
        $file = new VirtualFile();
        $dir = new VirtualDir([ 'hello.txt' => $file ]);
        VirtualFSStream::add_root_node('test', $dir);
        $f = fopen('vfs://test/hello.txt', 'w+');
        $result1 = $m->lock($f);
        $this->assertTrue($result1);
        $this->assertSame(LOCK_EX, $file->lock);
        $result2 = $m->lock($f);
        $this->assertFalse($result2);
        $result3 = $m->unlock($f);
        $this->assertTrue($result3);
        $this->assertSame(0, $file->lock);
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testSetLockOnFileInsideThread(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/set-lock-on-file-in-thread.zig');
        $m->startup();
        $file = new VirtualFile();
        $dir = new VirtualDir([ 'hello.txt' => $file ]);
        VirtualFSStream::add_root_node('test', $dir);
        $f = fopen('vfs://test/hello.txt', 'w+');
        try {
            $written = $m->spawn($f);
            $this->assertSame(11, $written);
            $this->assertSame(0, $file->lock);
        } finally {
            $m->shutdown();
        }
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testSetNoblockingFlagUsingFcntl(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/set-non-blocking-flag-with-fcntl.zig');
        $file = new VirtualFile('Hello world!');
        $dir = new VirtualDir([ 'hello.txt' => $file ]);
        VirtualFSStream::add_root_node('test', $dir);
        $f = fopen('vfs://test/hello.txt', 'r');
        $m->setNonBlocking($f, true);
        $this->assertFalse($file->blocking);
        $m->setNonBlocking($f, false);
        $this->assertTrue($file->blocking);
    }

    public function testReadLinesFromFileUsingFgets(): void 
    {
        global $input;
        $m = ZigImporter::load(__DIR__ . '/read-line-from-file-with-fgets.zig');
        $path = __DIR__ . '/data/macbeth.txt';
        $file = fopen($path, 'r');
        $m->startup();
        ob_start();
        try {
            $m->print($file);
            $text = ob_get_clean();
            $this->assertStringContainsString('Signifying nothing', $text);            
        } finally {
            $m->shutdown();
            fclose($file);
        }
    }

    public function testReadLinesFromStdinUsingFgets(): void 
    {
        global $input;
        $m = ZigImporter::load(__DIR__ . '/read-line-from-stdin-with-fgets.zig');
        $path = __DIR__ . '/data/macbeth.txt';
        $m->__zigar->redirect('stdin', $path);
        $m->startup();
        ob_start();
        try {
            $m->print();
            $text = ob_get_clean();
            $this->assertStringContainsString('Signifying nothing', $text);            
        } finally {
            $m->shutdown();
        }
    }

    public function testScanVariablesFromFileUsingFscanf(): void 
    {
        global $input;
        $m = ZigImporter::load(__DIR__ . '/c/scan-file-with-fscanf.zig');
        $input = <<<INPUT
        1 2 3 hello
        4 5 6 world
        123 456

        INPUT;
        $file = fopen("var://input", 'r');
        $this->expectOutput(<<<OUTPUT
        1 2 3 hello
        4 5 6 world
        count = 2

        OUTPUT);
        $m->scan($file);
    }

    public function testScanVariablesFromFileUsingScanf(): void 
    {
        global $input;
        $m = ZigImporter::load(__DIR__ . '/c/scan-stdin-with-scanf.zig');
        $input = <<<INPUT
        1 2 3 hello
        4 5 6 world
        123 456

        INPUT;
        $file = fopen("var://input", 'r');
        $m->__zigar->redirect('stdin', $file);
        $this->expectOutput(<<<OUTPUT
        1 2 3 hello
        4 5 6 world
        count = 2

        OUTPUT);
        $m->scan();
    }  

    public function testGetCharactersFromFileUsingFgetc(): void 
    {
        global $input;
        $m = ZigImporter::load(__DIR__ . '/read-file-content-with-fgetc.zig');
        $path = __DIR__ . '/data/macbeth.txt';
        $file = fopen($path, 'r');
        ob_start();
        $m->print($file);
        $text = ob_get_clean();
        $this->assertStringContainsString('Signifying nothing', $text);
    }

    public function testGetCharactersFromStdinUsingGetchar(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/read-stdin-with-getchar.zig');
        $path = __DIR__ . '/data/macbeth.txt';
        $m->__zigar->redirect('stdin', $path);
        ob_start();
        $m->print();
        $text = ob_get_clean();
        $this->assertStringContainsString('Signifying nothing', $text);
    }

    public function testPutCharacterIntoStdinUsingUngetc(): void 
    {
        global $input;
        $m = ZigImporter::load(__DIR__ . '/push-character-into-stdin-with-ungetc.zig');
        $input = "\x01\x02\x03\x04";
        $m->__zigar->redirect('stdin', 'var://input');
        $m->push(5);
        $result1 = $m->get();
        $this->assertSame(5, $result1);
        $result2 = $m->get();
        $this->assertSame(1, $result2);
        $m->push(6);
        $m->push(7);
        $result3 = $m->get();
        $this->assertSame(7, $result3);
        $result4 = $m->get();
        $this->assertSame(6, $result4);
        $result5 = $m->get();
        $this->assertSame(2, $result5);
    }

    public function testFlushOpenFileUsingFflush(): void 
    {
        global $output;
        $m = ZigImporter::load(__DIR__ . '/flush-buffer-with-fflush.zig');
        $output = '';
        $m->open("/var://output");
        try {
            $m->writeFlush("Hello world");
            $this->assertSame("Hello world", $output);
            $m->writeFlushAll("Hello world");
            $this->assertSame("Hello worldHello world", $output);
            $m->write("Hello world");
            $this->assertSame("Hello worldHello world", $output);
        } finally {
            $m->close();
        }
            $this->assertSame("Hello worldHello worldHello world", $output);
    }

    public function testRedirectIoFromDynamicallyLinkedLibrary(): void
    {
        $m = ZigImporter::load(__DIR__ . '/redirect-shared-lib.zig');
        switch (PHP_OS_FAMILY) {
            case 'Windows': 
                $os = 'windows';
                $ext = 'dll';
                break;
            case 'Darwin':
                $os = 'macox';
                $ext = 'dynlib';
                break;
            case 'Linux':
                $os = 'linux-gnu';
                $ext = 'so';
                break;
        }
        switch (php_uname('m')) {
            case 'i386':
                $arch = 'x86';
                break;
            case 'x86_64':
                $arch = 'x86_64';
                break;
        }
        $lib_path = __DIR__ . "/data/print.$ext";
        $zig_path = __DIR__ . '/redirect-shared-lib-target.zig';
        shell_exec("zig build-lib '$zig_path' -target $arch-$os -dynamic -O ReleaseSmall -femit-bin='$lib_path'");
        ob_start();
        $m->use($lib_path);
        $text = ob_get_clean();
        $this->assertStringContainsString('Hello world', $text);
    }

    public function testCreateDirectoryInFileSystemUsingPosixFunction(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/create-directory-in-file-system-with-posix-function.zig');
        $path = __DIR__ . '/data/mkdir_test';
        $m->makeDirectory($path);
        $this->expectNotToPerformAssertions();
    }

    public function testCreateDirectoryInAnotherDirectoryInFileSystemUsingPosixFunction(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/create-directory-at-dir-in-file-system-with-posix-function.zig');
        $path = __DIR__ . '/data/mkdirat_test';
        mkdir($path, 0o0777, true);
        try {
            $m->makeDirectory($path, 'hello');
            $info = stat("$path/hello");
            $this->assertSame(0o0040000, $info['mode'] & 0o0040000);
        } finally {
            rmdir("$path/hello");
            rmdir($path);
        }
    }

    public function testRemoveDirectoryInFileSystemUsingPosixFunction(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/remove-directory-in-file-system-with-posix-function.zig');
        $path = __DIR__ . '/data/rmdir_test';
        mkdir($path, 0o0777, true);
        try {
            $m->removeDirectory($path);
            $this->expectNotToPerformAssertions();
        } catch (Exception $e) {
            rmdir($path);
        }
    }

    public function testRemoveFileInFileSystemUsingPosixFunction(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/remove-file-in-file-system-with-posix-function.zig');
        $path = __DIR__ . '/data/unlink_test.txt';
        file_put_contents($path, "Hello world");
        try {
            $m->removeFile($path);
            $this->expectNotToPerformAssertions();
        } catch (Exception $e) {
            unmlink($path);
        }
    }

    public function testThrowWhenAttemptingToReadlink(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/read-link-with-posix-function.zig');
        $this->assertExceptionMessage('access denied', function() use($m) {
            $m->readLink('/vfs://test');
        });
    }

    public function testThrowWhenAttemptingToConvertFileWhenUseRedirectionIsFalse(): void
    {        
        $m = ZigImporter::load(__DIR__ . '/fail-to-convert-file.zig', [
            'use_redirection' => false,
        ]);
        $this->assertExceptionMessage('redirection disabled', function() use($m) {
            $f = fopen('php://memory', 'w+');
            $m->call($f);
        });
    }

    public function testThrowWhenAttemptingToConvertDirWhenUseRedirectionIsFalse(): void
    {
        $m = ZigImporter::load(__DIR__ . '/fail-to-convert-dir.zig', [
            'use_redirection' => false,
        ]);
        $dir = new VirtualDir();
        VirtualFSStream::add_root_node('test', $dir);
        $this->assertExceptionMessage('redirection disabled', function() use($m) {
            $f = opendir('vfs://test');
            $m->call($f);
        });
    }

    public function testHandleThreadsCorrectlyWhenUseRedirectionIsFalse(): void
    {
        global $output;
        $m = ZigImporter::load(__DIR__ . '/return-from-thread.zig', [
            'use_redirection' => false,
        ]);        
        $m->startup();
        $output = '';
        try {
            $result = $m->call(1234);
            $this->assertSame(1234, $result);
            $this->assertExceptionMessage('redirection disabled', function() use($m) {
                $m->__zigar->redirect('stdout', 'var://output');
            });
        } finally {
            $m->shutdown();
        }
    }

    /**
     * @requires OS Windows
     */
    public function testIgnoreOffsetToWriteFileWhenStreamIsUnseekable(): void     
    {
        // TODO
    }

    public function testCopyRealFileToVirtualFile(): void 
    {
        global $output, $out_stat;
        $m = ZigImporter::load(__DIR__ . '/copy-real-file-to-virtual-file.zig');
        $path = __DIR__ . '/data/macbeth.txt';
        $stat = stat($path);
        $size = $stat['size'];
        $output = '';
        $out_stat = [ 'size' => '0' ];
        $out_file = fopen("var://output", 'w');
        $in_file = fopen($path, 'r');
        $copied = $m->copy($in_file, $out_file);
        fclose($out_file);
        fclose($in_file);
        $content = file_get_contents($path);
        $this->assertSame($content, $output);
    }

    public function testCopyVirtualFileToVirtualFile(): void 
    {
        global $input, $in_stat, $output, $out_stat;
        $m = ZigImporter::load(__DIR__ . '/copy-virtual-file-to-real-file.zig');
        $output = '';
        $out_file = fopen("var://output/out_stat", 'w');
        $out_stat = [ 'size' => 0 ];
        $input = 'Hello world!';
        $in_file = fopen("var://input/in_stat", 'r');
        $in_stat = [ 'size' => strlen($input) ];
        $size = strlen($input);
        $copied = $m->copy($in_file, $out_file);
        $this->assertSame($size, $copied);
        fclose($out_file);
        $this->assertSame($input, $output);
    }

    public function testCopyVirtualFileToRealFile(): void 
    {
        global $input;
        $m = ZigImporter::load(__DIR__ . '/copy-virtual-file-to-real-file.zig');
        $path = __DIR__ . '/data/virtual-file-test.txt';
        try {
            $out_file = fopen($path, 'w');
            $input = 'Hello world!';
            $in_file = fopen("var://input", 'r');
            $size = strlen($input);
            $copied = $m->copy($in_file, $out_file);
            $this->assertSame($size, $copied);
            fclose($out_file);
            $content = file_get_contents($path);
            $this->assertSame($input, $content);
        } finally {
            unlink($path);
        }
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testCopyRealFileToVirtualFileUsingSendfile(): void 
    {
        global $output;
        $m = ZigImporter::load(__DIR__ . '/copy-real-file-to-virtual-file-with-sendfile.zig');
        $path = __DIR__ . '/data/macbeth.txt';
        $stat = stat($path);
        $size = $stat['size'];
        $output = '';        
        $out_file = fopen("var://output", 'w');
        $in_file = fopen($path, 'r');
        $copied = $m->copy($in_file, $out_file, $size);
        fclose($out_file);
        fclose($in_file);
        $content = file_get_contents($path);
        $this->assertSame($content, $output);
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testCopyVirtualFileToVirtualFileUsingSendfile(): void 
    {
        global $input, $output;
        $m = ZigImporter::load(__DIR__ . '/copy-virtual-file-to-virtual-file-with-sendfile.zig');
        $output = '';
        $out_file = fopen("var://output", 'w');
        $input = "Hello world!";
        $in_file = fopen("var://input", 'r');
        $copied = $m->copy($in_file, $out_file, strlen($input));
        fclose($out_file);
        fclose($in_file);
        $this->assertSame($input, $output);
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testCopyVirtualFileToRealFileUsingSendfile(): void 
    {
        global $input;
        $m = ZigImporter::load(__DIR__ . '/copy-virtual-file-to-real-file-with-sendfile.zig');
        $path = __DIR__ . '/data/virtual-file-test.txt';
        try {
            $out_file = fopen($path, 'w');
            $input = "Hello world!";
            $in_file = fopen("var://input", 'r');
            $copied = $m->copy($in_file, $out_file, strlen($input));
            fclose($out_file);
            fclose($in_file);
            $content = file_get_contents($path);
            $this->assertSame($input, $content);
        } finally {
            unlink($path);
        }
    }

    public function testGetFileDescriptorUsingLibcFunction(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/get-file-descriptor-with-libc-function.zig');
        $result1 = $m->get('/php://memory');
        $this->assertTrue($result1 >= 0xf00000);
        $result2 = $m->get(__FILE__);
        $this->assertTrue($result2 < 1024);
    }

    public function testCheckIfStreamIsTerminalUsingLibcFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/check-if-stream-is-terminal-with-libc-function.zig');
        $f = fopen('php://memory', 'w');
        $result1 = $m->check($f);
        $this->assertFalse($result1);
        $result2 = $m->check(STDIN);
        $this->assertFalse($result2);
    }

    public function testGetTerminalNameUsingLibcFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/get-terminal-name-with-libc-function.zig');
        $f = fopen('php://memory', 'w');
        $result1 = $m->get1($f);
        $this->assertNull($result1);
        $result2 = $m->get2($f);
        $this->assertNull($result2);
        $result3 = $m->get1(STDIN);
        $this->assertNull($result3);
        $result4 = $m->get2(STDIN);
        $this->assertNull($result4);
    }

    public function testTruncateFileUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/truncate-file-with-posix-function.zig');
        $file = new VirtualFile();
        $dir = new VirtualDir([ 'hello.txt' => $file ]);
        VirtualFSStream::add_root_node('test', $dir);
        $path = '/vfs://test/hello.txt';
        $m->truncate($path, 256);
        $this->assertSame(256, $file->size);
        $this->assertSame(256, strlen($file->content));
        $m->truncate($path, 16);
        $this->assertSame(16, $file->size);
    }

    public function testTruncateOpenedFileUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/truncate-opened-file-with-posix-function.zig');
        $file = new VirtualFile();
        $dir = new VirtualDir([ 'hello.txt' => $file ]);
        VirtualFSStream::add_root_node('test', $dir);
        $f = fopen('vfs://test/hello.txt', 'w');
        $m->truncate($f, 256);
        $this->assertSame(256, $file->size);
        $this->assertSame(256, strlen($file->content));
        $m->truncate($f, 16);
        $this->assertSame(16, $file->size);
    }

    /**
     * @requires OS Windows
     */
    public function testTruncateOpenedFileUsingWin32Function(): void
    {
        // TODO
    }

    /**
     * @requires OS Linux
     */
    public function testCopyRealFileToVirtualFileUsingCopyFileRange(): void 
    {
        global $output;
        $m = ZigImporter::load(__DIR__ . '/copy-real-file-to-virtual-file-with-copy-file-range.zig');
        $path = __DIR__ . '/data/macbeth.txt';
        $output = 'Hello world';
        $out_file = fopen("var://output", 'x');
        $in_file = fopen($path, 'r');
        $copied = $m->copy($in_file, $out_file, 28, 4, 32);
        fclose($out_file);
        fclose($in_file);
        $content = file_get_contents($path);
        $chunk = substr($content, 28, 32);
        $this->assertSame("Hell$chunk", $output);
    }

    /**
     * @requires OS Linux
     */
    public function testCopyVirtualFileToRealFileUsingCopyFileRange(): void 
    {
        global $input;
        $m = ZigImporter::load(__DIR__ . '/copy-virtual-file-to-real-file-with-copy-file-range.zig');
        $path = __DIR__ . '/data/macbeth.txt';
        $input = file_get_contents($path);
        $out_path = __DIR__ . '/data/copy-file-range-test.txt';        
        try {
            $out_file = fopen($out_path, 'w');
            fwrite($out_file, "Hello world");
            $initial_pos = ftell($out_file);
            $in_file = fopen("var://input", 'r');
            $copied = $m->copy($in_file, $out_file, 28, 4, 32);
            fclose($out_file);
            fclose($in_file);
            $content = file_get_contents($out_path);
            $chunk = substr($input, 28, 32);
            $this->assertSame("Hell$chunk", $content);
        } finally {
            unlink($out_path);
        }
    }
}

class VariableStream {
    var $position;
    var $varname;
    var $statname;

    function stream_open($path, $mode, $options, &$opened_path)
    {
        $url = parse_url($path);
        $this->varname = $url["host"];
        $this->statname = isset($url["path"]) ? substr($url["path"], 1) : '';
        $this->position = 0;

        return isset($GLOBALS[$this->varname]) ? true : false;
    }

    function stream_read($count)
    {
        $ret = substr($GLOBALS[$this->varname], $this->position, $count);
        $this->position += strlen($ret);
        return $ret;
    }

    function stream_write($data)
    {
        $left = substr($GLOBALS[$this->varname], 0, $this->position);
        $right = substr($GLOBALS[$this->varname], $this->position + strlen($data));
        $GLOBALS[$this->varname] = $left . $data . $right;
        $this->position += strlen($data);
        return strlen($data);
    }

    function stream_tell()
    {
        return $this->position;
    }

    function stream_eof()
    {
        return $this->position >= strlen($GLOBALS[$this->varname]);
    }

    function stream_seek($offset, $whence)
    {
        switch ($whence) {
            case SEEK_SET:
                if ($offset < strlen($GLOBALS[$this->varname]) && $offset >= 0) {
                     $this->position = $offset;
                     return true;
                } else {
                     return false;
                }
                break;

            case SEEK_CUR:
                if ($offset >= 0) {
                     $this->position += $offset;
                     return true;
                } else {
                     return false;
                }
                break;

            case SEEK_END:
                if (strlen($GLOBALS[$this->varname]) + $offset >= 0) {
                     $this->position = strlen($GLOBALS[$this->varname]) + $offset;
                     return true;
                } else {
                     return false;
                }
                break;

            default:
                return false;
        }
    }

    function stream_stat()
    {
        return $GLOBALS[$this->statname] ?? false;
    }

    function stream_metadata($path, $option, $var) 
    {
        if($option == STREAM_META_TOUCH) {
            $url = parse_url($path);
            $varname = $url["host"];
            if(!isset($GLOBALS[$varname])) {
                $GLOBALS[$varname] = '';
            }
            return true;
        }
        return false;
    }

    function url_stat($path, $flags)
    {
        $url = parse_url($path);
        $varname = $url["host"];
        if (!isset($GLOBALS[$varname])) return false;
        $statname = substr($url["path"], 1);
        return $GLOBALS[$statname] ?? false;
    }
}

stream_wrapper_register("var", "VariableStream")
    or die("Failed to register protocol");

class VirtualFSStream {
    var $node;
    var $position;

    static $directories = [];

    static function add_root_node($name, $dir) {
        self::$directories[$name] = $dir;
    }

    static function remove_root_node($name) {
        unset(self::$directories[$name]);
    }

    static function get_node($path) {
        $url = parse_url($path);
        $root_name = $url["host"];
        if (!isset(self::$directories[$root_name])) return false;
        $node = self::$directories[$root_name];
        if (isset($url["path"])) {
            $path = substr($url["path"], 1);
            if ($path) {
                foreach (explode('/', $path) as $part) {
                    if (!isset($node->children[$part])) return false;
                    $node = $node->children[$part];
                }
            }
        }
        return $node;
    }

    function dir_opendir(string $path, int $options)
    {
        $dir = self::get_node($path);
        if (!isset($dir->children)) return false;
        $this->node = $dir;
        $this->path = $path;
        $this->position = 0;
        return true;
    }

    function dir_closedir()
    {
    } 

    function dir_readdir()
    {
        $keys = array_keys($this->node->children);
        if (!isset($keys[$this->position])) return false;
        $name = $keys[$this->position++];
        return $name;
    }

    function dir_rewinddir()
    {
        $this->position = 0;
        return true;
    }

    function mkdir($path, $mode, $options) 
    {
        $parent = self::get_node(dirname($path));
        if (!isset($parent->children)) return false;
        $name = basename($path);
        if (isset($parent->children[$name])) return false;
        $dir = $parent->children[$name] = new VirtualDir();
        $dir->mode = 0o0040000 | $mode;
        return true;
    }

    function rmdir($path, $options) 
    {
        $parent = self::get_node(dirname($path));
        if (!isset($parent->children)) return false;
        $name = basename($path);
        if (!isset($parent->children[$name])) return false;
        $dir = $parent->children[$name];
        if (!isset($dir->children)) return false;
        unset($parent->children[$name]);
        return true;
    }

    function unlink($path) 
    {
        $parent = self::get_node(dirname($path));
        if (!isset($parent->children)) return false;
        $name = basename($path);
        if (!isset($parent->children[$name])) return false;
        $file = $parent->children[$name];
        if (!isset($file->content)) return false;
        unset($parent->children[$name]);
        return true;
    }

    function rename($path_from, $path_to)
    {
        $dir_from = self::get_node(dirname($path_from));
        if (!isset($dir_from->children)) return false;
        $name_from = basename($path_from);
        if (!isset($dir_from->children[$name_from])) return false;
        $target = $dir_from->children[$name_from];
        $dir_to = self::get_node(dirname($path_to));
        if (!isset($dir_to->children)) return false;
        $name_to = basename($path_to);
        $dir_to->children[$name_to] = $target;
        unset($dir_from->children[$name_from]);
        return true;
    }

    function stream_open($path, $mode, $options, &$opened_path)
    {
        $file = self::get_node($path);
        if (!$file && (strstr($mode, 'w') or strstr($mode, 'x') or strstr($mode, 'c'))) {
            $parent = self::get_node(dirname($path));
            if (isset($parent->children)) {
                $name = basename($path);
                $file = $parent->children[$name] = new VirtualFile();
            }
        }
        if (!isset($file->content)) return false;
        $this->path = $path;
        $this->node = $file;
        $this->position = 0;
        return true;
    }

    function stream_read($count)
    {
        $content = $this->node->content;
        $ret = substr($content, $this->position, $count);
        $this->position += strlen($ret);
        return $ret;
    }

    function stream_write($data)
    {
        $content = &$this->node->content;
        $left = substr($content, 0, $this->position);
        $right = substr($content, $this->position + strlen($data));
        $content = $left . $data . $right;
        $this->position += strlen($data);
        $this->size = strlen($content);
        return strlen($data);
    }

    function stream_tell()
    {
        return $this->position;
    }

    function stream_truncate($new_size) {
        $content = &$this->node->content;
        $len = strlen($content);
        if ($len > $new_size) {
            $content = substr($content, 0, $new_size);
        } else if ($len < $new_size) {
            $content .= str_repeat("\x00", $new_size - $len);
        }
        $this->node->size = $new_size;
        return true;
    }

    function stream_eof()
    {
        $content = $this->node->content;
        return $this->position >= strlen($content);
    }

    function stream_seek($offset, $whence)
    {
        $content = $this->node->content;
        switch ($whence) {
            case SEEK_SET:
                if ($offset < strlen($content) && $offset >= 0) {
                     $this->position = $offset;
                     return true;
                } else {
                     return false;
                }
                break;

            case SEEK_CUR:
                if ($offset >= 0) {
                     $this->position += $offset;
                     return true;
                } else {
                     return false;
                }
                break;

            case SEEK_END:
                if (strlen($content) + $offset >= 0) {
                     $this->position = strlen($content) + $offset;
                     return true;
                } else {
                     return false;
                }
                break;

            default:
                return false;
        }
    }

    function stream_stat()
    {
        return (array) $this->node;
    }

    function stream_lock($operation)
    {
        switch ($operation & ~LOCK_NB) {
            case LOCK_UN:
                if (!$this->node->lock) return false;
                if ($this->node->lock === INF) {
                    $this->node->lock = 0;
                } else {
                    $this->node->lock--;
                }
                break;
            case LOCK_SH:
                if ($this->node->lock === INF) {
                    // downgrade
                    $this->node->lock = 1;
                } else {
                    $this->node->lock++;
                }
                break;
            case LOCK_EX:
                $this->node->lock = INF;
                break;
        }
        return true;
    }

    function stream_set_option($option, $arg1, $arg2)
    {
        switch ($option) {
            case STREAM_OPTION_BLOCKING:
                $this->node->blocking = !!$arg1;
                break;
        }
        return true;
    }

    function stream_metadata($path, $option, $var) 
    {
        if($option == STREAM_META_TOUCH) {
            $node = self::get_node($path);
            if ($node) {
                $node->mtime = $var[0];
                $node->atime = $var[1];
                return true;
            }
        }
        return false;
    }

    function url_stat($path, $flags)
    {
        $node = self::get_node($path);
        return ($node) ? (array) $node : false;
    }
}

class VirtualFSObject {
    var $size = 0;
    var $atime = 0;
    var $ctime = 0;
    var $mtime = 0;
    var $mode = 0;
    var $path;
}

class VirtualDir extends VirtualFSObject {
    var $children;

    function __construct($children = []) {
        $this->children = $children;
        $this->mode = 0o0040000 | 0o777;
    }
}

class VirtualFile extends VirtualFSObject {
    var $content;
    var $lock;
    var $blocking;

    function __construct($content = '') {
        $this->content = $content;
        $this->size = strlen($content);
        $this->mode = 0o0100000 | 0o666;
        $this->lock = 0;
        $this->blocking = true;
    }
}

stream_wrapper_register("vfs", "VirtualFSStream")
    or die("Failed to register protocol");
