<?php declare(strict_types=1);

final class JsCompatTest extends ZigarTestCase
{   
    public function testArrayBuffer(): void
    {
        $a = new ArrayBuffer(8);
        $this->assertSame(8, $a->byteLength);
        $this->assertSame(false, $a->detached);
        $this->assertSame(false, $a->readOnly);
        // ensure $str isn't interned
        $noun = "world";
        $str = "Hello $noun";
        $b = new ArrayBuffer($str);
        $this->assertSame(strlen($str), $b->byteLength);
        $this->assertSame(false, $b->readOnly);
        ob_start();
        debug_zval_dump($str);
        $text = ob_get_clean();
        $this->assertStringContainsString("refcount(2)", $text);
        $c = new ArrayBuffer($str, true);
        $this->assertSame(strlen($str), $c->byteLength);
        $this->assertSame(true, $c->readOnly);
        ob_start();
        debug_zval_dump($str);
        $text = ob_get_clean();
        $this->assertStringContainsString("refcount(3)", $text);
        $this->assertSame(false, $b == $c);
        $d = new ArrayBuffer("Hello world", true);
        $this->assertSame(false, $b == $d);
        $this->assertSame(true, $c == $d);
        $e = new stdClass();
        $this->assertSame(false, $b == $e);

        $this->assertExceptionMessage("did not create an Iterator", function() use($b) {
            foreach ($b as $value) {}
        });
    }

    public function testInt8Array(): void
    {
        $b = new Int8Array([ 1, 2, 3, 4 ]);
        $this->assertSame([ 1, 2, 3, 4 ], (array) $b);
        $c = new Int8Array([ 1, 2, 3, 4 ]);
        $this->assertEquals($b, $c);
        $d = new Int8Array($b);
        $this->assertEquals($b, $d);
        $bytes = pack("ccccc", -1, -2, -3, -4, -5);
        $buf = new ArrayBuffer($bytes, true);
        $e = new Int8Array($buf);
        $this->assertSame([ -1, -2, -3, -4, -5 ], (array) $e);
        $f = new Int8Array($buf, 2);
        $this->assertSame([ -3, -4, -5 ], (array) $f);
        $g = new Int8Array($buf, 1, 3);
        $this->assertSame([ -2, -3, -4 ], (array) $g);

        $this->expectOutputString(<<<OUTPUT
        0: 1
        1: 2
        2: 3
        3: 4

        OUTPUT);        
        foreach ($b as $index => $value) {
            echo "$index: $value\n";
        }
    }

    public function testUint8Array(): void
    {
        $b = new Uint8Array([ 1, 2, 3, 4 ]);
        $this->assertSame([ 1, 2, 3, 4 ], (array) $b);
        $c = new Uint8Array([ 1, 2, 3, 4 ]);
        $this->assertEquals($b, $c);
        $d = new Uint8Array($b);
        $this->assertEquals($b, $d);
        $bytes = pack("CCCCC", 10, 20, 30, 40, 50);
        $buf = new ArrayBuffer($bytes, true);
        $e = new Uint8Array($buf);
        $this->assertSame([ 10, 20, 30, 40, 50 ], (array) $e);
        $f = new Uint8Array($buf, 2);
        $this->assertSame([ 30, 40, 50 ], (array) $f);
        $g = new Uint8Array($buf, 1, 3);
        $this->assertSame([ 20, 30, 40 ], (array) $g);

        $this->expectOutputString(<<<OUTPUT
        0: 1
        1: 2
        2: 3
        3: 4

        OUTPUT);        
        foreach ($b as $index => $value) {
            echo "$index: $value\n";
        }
    }
}
