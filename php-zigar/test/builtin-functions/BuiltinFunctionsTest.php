<?php declare(strict_types=1);

final class BuiltinFunctionsTest extends ZigarTestCase
{   
    public function testGenerateMd5Hash(): void
    {
        $m = ZigImporter::load(__DIR__ . '/generate-md5-hash.zig');
        $data = '';
        for ($i = 0; $i < 1024 * 1024; $i++) {
            $data .= chr($i & 0xff);
        }
        $digest1_bin = md5($data, true);
        $digest1 = [];
        for ($i = 0; $i < strlen($digest1_bin); $i++) {
            $digest1[] = ord($digest1_bin[$i]);
        }
        $digest2 = $m->md5($data);
        $this->assertSame($digest1, (array) $digest2);
    }

    public function testGenerateSha1Hash(): void
    {
        $m = ZigImporter::load(__DIR__ . '/generate-sha1-hash.zig');
        $data = '';
        for ($i = 0; $i < 1024 * 1024; $i++) {
            $data .= chr($i & 0xff);
        }
        $digest1_bin = sha1($data, true);
        $digest1 = [];
        for ($i = 0; $i < strlen($digest1_bin); $i++) {
            $digest1[] = ord($digest1_bin[$i]);
        }
        $digest2 = $m->sha1($data);
        $this->assertSame($digest1, (array) $digest2);
    }

    // public function testThrowWhenArgumentIsInvalid(): void
    // {
    //     $m = ZigImporter::load(__DIR__ . '/accept-u8.zig');
    //     $m->accept1(1, 123);
    // }
}
