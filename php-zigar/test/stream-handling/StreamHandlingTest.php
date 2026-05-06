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
        $url_path = '/data://text/plain;base64,' . base64_encode($content);
        $chunk = $m->read($url_path, 32, 16);
        $this->assertSame('ur fathers broug', (string) $chunk);
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
        $m = ZigImporter::load(__DIR__ . '/write-to-file.zig');
    }

    public function testWriteToFileInMainThread(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/write-to-file-in-main-thread.zig');
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
}

class VariableStream {
    var $position;
    var $varname;

    function stream_open($path, $mode, $options, &$opened_path)
    {
        $url = parse_url($path);
        $this->varname = $url["host"];
        $this->position = 0;

        return true;
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
}

stream_wrapper_register("var", "VariableStream")
    or die("Failed to register protocol");