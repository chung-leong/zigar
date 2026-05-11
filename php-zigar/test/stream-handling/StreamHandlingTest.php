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

    public function testOpenFileUsingDirectSyscall(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-file-through-direct-syscall.zig');
        $url_path = '/data://text/plain;base64,SSBsb3ZlIFBIUAo=';
        $result = $m->check($url_path);
        $this->assertSame(true, $result);
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
        $this->expectOutputString(<<<OUTPUT
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
        $this->assertSame(true, $result);
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
        $this->assertSame(true, $result1);
        $result2 = $m->check($url_path, write: true);
        $this->assertSame(true, $result2);
        $result3 = $m->check($url_path, execute: true);
        $this->assertSame(false, $result3);
        $stat = [
            'mode' => 0o0040000,
            'size' => 0,
        ];
        $result4 = $m->check($url_path, execute: true);
        $this->assertSame(true, $result4);
    }

    public function testCheckAccessOfFileinDirectoryUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/check-access-at-dir-with-posix-function.zig');
    }

    public function testCheckAccessOfFileinDirectoryInFileSystemUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/check-access-at-dir-in-file-system-with-posix-function.zig');
        $path = __DIR__ . 'data/statat_test';
        mkdir($path, 0o0777, true);
        try {
            file_put_contents("$path/file.txt", "Hello world");
            $result = $m->check($path, "file.txt", read: true);
            $this->assertSame(true, $result);
        } finally {
            unlink("$path/file.txt");
            rmdir($path);
        }
    }

    public function testOpenFileInDirectoryUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-file-at-dir-with-posix-function.zig');
    }

    public function testOpenFileFileInDirectoryInFileSystemUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/open-file-at-dir-in-file-system-with-posix-function.zig');
        $path = __DIR__ . 'data/openat_test';
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

    public function testOpenFileInDirectoryInFileSystemUsingPosixFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/stat-file-at-dir-in-file-system-with-posix-function.zig');
        $path = __DIR__ . 'data/statat_test';
        mkdir($path, 0o0777, true);
        try {
            file_put_contents("$path/file.txt", "Hello world");
            $this->expectOutputString(<<<OUTPUT
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

    public function testOpenAndReadFromFileUsingPread(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/open-and-read-file-with-pread.zig');
        $path = __DIR__ . '/data/test.txt';        
        $content = file_get_contents($path);
        $url_path = '/data://text/plain;base64,' . base64_encode($content);
        $chunk = $m->readAt($url_path, 120, 16);
        $this->assertSame('cated to the pro', (string) $chunk);
    }

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

    public function testGetCharactersFromFileUsingFgetc(): void {
        $m = ZigImporter::load(__DIR__ . '/read-file-content-with-fgetc.zig');
        $path = __DIR__ . '/data/macbetch.txt';
        // TODO
    }

    public function testGetCharactersFromStdinUsingGetchar(): void {
        // TODO
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