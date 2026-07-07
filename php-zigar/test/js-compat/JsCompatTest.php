<?php declare(strict_types=1);

final class JsCompatTest extends ZigarTestCase
{   
    public function testArrayBuffer(): void
    {
        $a = new ArrayBuffer(8);
        $this->assertSame(8, $a->byteLength);
        $this->assertFalse($a->detached);
        $this->assertFalse($a->readOnly);
        // ensure $str isn't interned
        $noun = "world";
        $str = "Hello $noun";
        $b = new ArrayBuffer($str);
        $this->assertSame(strlen($str), $b->byteLength);
        $this->assertFalse($b->readOnly);
        ob_start();
        debug_zval_dump($str);
        $text = ob_get_clean();
        $this->assertStringContainsString("refcount(2)", $text);
        $c = new ArrayBuffer($str, true);
        $this->assertSame(strlen($str), $c->byteLength);
        $this->assertTrue($c->readOnly);
        ob_start();
        debug_zval_dump($str);
        $text = ob_get_clean();
        $this->assertStringContainsString("refcount(3)", $text);
        $this->assertTrue($b == $c);
        $d = new ArrayBuffer("Hello world", true);
        $this->assertTrue($b == $d);
        $this->assertTrue($c == $d);
        $e = new stdClass();
        $this->assertFalse($b == $e);

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
        $h = new Int8Array(4);
        $this->assertSame([ 0, 0, 0, 0 ], (array) $h);

        $this->expectOutput(<<<OUTPUT
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

        $this->expectOutput(<<<OUTPUT
        0: 1
        1: 2
        2: 3
        3: 4

        OUTPUT);        
        foreach ($b as $index => $value) {
            echo "$index: $value\n";
        }
    }

    public function testInt16Array(): void
    {
        $b = new Int16Array([ 1, 2, 3, 4 ]);
        $this->assertSame([ 1, 2, 3, 4 ], (array) $b);
        $c = new Int16Array([ 1, 2, 3, 4 ]);
        $this->assertEquals($b, $c);
        $d = new Int16Array($b);
        $this->assertEquals($b, $d);
        $bytes = pack("sssss", -1, -2, -3, -4, -5);
        $buf = new ArrayBuffer($bytes, true);
        $e = new Int16Array($buf);
        $this->assertSame([ -1, -2, -3, -4, -5 ], (array) $e);
        $f = new Int16Array($buf, 4);
        $this->assertSame([ -3, -4, -5 ], (array) $f);
        $g = new Int16Array($buf, 2, 3);
        $this->assertSame([ -2, -3, -4 ], (array) $g);

        $this->expectOutput(<<<OUTPUT
        0: 1
        1: 2
        2: 3
        3: 4

        OUTPUT);        
        foreach ($b as $index => $value) {
            echo "$index: $value\n";
        }
    }

    public function testUint16Array(): void
    {
        $b = new Uint16Array([ 1, 2, 3, 4 ]);
        $this->assertSame([ 1, 2, 3, 4 ], (array) $b);
        $c = new Uint16Array([ 1, 2, 3, 4 ]);
        $this->assertEquals($b, $c);
        $d = new Uint16Array($b);
        $this->assertEquals($b, $d);
        $bytes = pack("SSSSS", 10, 20, 30, 40, 50);
        $buf = new ArrayBuffer($bytes, true);
        $e = new Uint16Array($buf);
        $this->assertSame([ 10, 20, 30, 40, 50 ], (array) $e);
        $f = new Uint16Array($buf, 4);
        $this->assertSame([ 30, 40, 50 ], (array) $f);
        $g = new Uint16Array($buf, 2, 3);
        $this->assertSame([ 20, 30, 40 ], (array) $g);

        $this->expectOutput(<<<OUTPUT
        0: 1
        1: 2
        2: 3
        3: 4

        OUTPUT);        
        foreach ($b as $index => $value) {
            echo "$index: $value\n";
        }
    }

    public function testInt32Array(): void
    {
        $b = new Int32Array([ 1, 2, 3, 4 ]);
        $this->assertSame([ 1, 2, 3, 4 ], (array) $b);
        $c = new Int32Array([ 1, 2, 3, 4 ]);
        $this->assertEquals($b, $c);
        $d = new Int32Array($b);
        $this->assertEquals($b, $d);
        $bytes = pack("iiiii", -1, -2, -3, -4, -5);
        $buf = new ArrayBuffer($bytes, true);
        $e = new Int32Array($buf);
        $this->assertSame([ -1, -2, -3, -4, -5 ], (array) $e);
        $f = new Int32Array($buf, 8);
        $this->assertSame([ -3, -4, -5 ], (array) $f);
        $g = new Int32Array($buf, 4, 3);
        $this->assertSame([ -2, -3, -4 ], (array) $g);

        $this->expectOutput(<<<OUTPUT
        0: 1
        1: 2
        2: 3
        3: 4

        OUTPUT);        
        foreach ($b as $index => $value) {
            echo "$index: $value\n";
        }
    }

    public function testUint32Array(): void
    {
        $b = new Uint32Array([ 1, 2, 3, 4 ]);
        $this->assertSame([ 1, 2, 3, 4 ], (array) $b);
        $c = new Uint32Array([ 1, 2, 3, 4 ]);
        $this->assertEquals($b, $c);
        $d = new Uint32Array($b);
        $this->assertEquals($b, $d);
        $bytes = pack("IIIII", 10, 20, 30, 40, 50);
        $buf = new ArrayBuffer($bytes, true);
        $e = new Uint32Array($buf);
        $this->assertSame([ 10, 20, 30, 40, 50 ], (array) $e);
        $f = new Uint32Array($buf, 8);
        $this->assertSame([ 30, 40, 50 ], (array) $f);
        $g = new Uint32Array($buf, 4, 3);
        $this->assertSame([ 20, 30, 40 ], (array) $g);

        $this->expectOutput(<<<OUTPUT
        0: 1
        1: 2
        2: 3
        3: 4

        OUTPUT);        
        foreach ($b as $index => $value) {
            echo "$index: $value\n";
        }
    }

    public function testInt64Array(): void
    {
        $b = new Int64Array([ 1, 2, 3, 4 ]);
        $this->assertSame([ 1, 2, 3, 4 ], (array) $b);
        $c = new Int64Array([ 1, 2, 3, 4 ]);
        $this->assertEquals($b, $c);
        $d = new Int64Array($b);
        $this->assertEquals($b, $d);
        $bytes = pack("qqqqq", -1, -2, -3, -4, -5);
        $buf = new ArrayBuffer($bytes, true);
        $e = new Int64Array($buf);
        $this->assertSame([ -1, -2, -3, -4, -5 ], (array) $e);
        $f = new Int64Array($buf, 16);
        $this->assertSame([ -3, -4, -5 ], (array) $f);
        $g = new Int64Array($buf, 8, 3);
        $this->assertSame([ -2, -3, -4 ], (array) $g);

        $this->expectOutput(<<<OUTPUT
        0: 1
        1: 2
        2: 3
        3: 4

        OUTPUT);        
        foreach ($b as $index => $value) {
            echo "$index: $value\n";
        }
    }

    public function testUint64Array(): void
    {
        $b = new Uint64Array([ 1, 2, 3, 4 ]);
        $this->assertSame([ 1, 2, 3, 4 ], (array) $b);
        $c = new Uint64Array([ 1, 2, 3, 4 ]);
        $this->assertEquals($b, $c);
        $d = new Uint64Array($b);
        $this->assertEquals($b, $d);
        $bytes = pack("QQQQQ", 10, 20, 30, 40, 50);
        $buf = new ArrayBuffer($bytes, true);
        $e = new Uint64Array($buf);
        $this->assertSame([ 10, 20, 30, 40, 50 ], (array) $e);
        $f = new Uint64Array($buf, 16);
        $this->assertSame([ 30, 40, 50 ], (array) $f);
        $g = new Uint64Array($buf, 8, 3);
        $this->assertSame([ 20, 30, 40 ], (array) $g);

        $this->expectOutput(<<<OUTPUT
        0: 1
        1: 2
        2: 3
        3: 4

        OUTPUT);        
        foreach ($b as $index => $value) {
            echo "$index: $value\n";
        }
    }

    public function testFloat16Array(): void
    {
        $b = new Float16Array([ 1, 2, 3, 4 ]);
        $this->assertSame([ 1.0, 2.0, 3.0, 4.0 ], (array) $b);
        $c = new Float16Array([ 1, 2, 3, 4 ]);
        $this->assertEquals($b, $c);
        $d = new Float16Array($b);
        $this->assertEquals($b, $d);
        $e = new Float16Array([ -1, -2, -3, -4, -5 ]);
        $buf = $e->buffer;
        $this->assertSame([ -1.0, -2.0, -3.0, -4.0, -5.0 ], (array) $e);
        $f = new Float16Array($buf, 4);
        $this->assertSame([ -3.0, -4.0, -5.0 ], (array) $f);
        $g = new Float16Array($buf, 2, 3);
        $this->assertSame([ -2.0, -3.0, -4.0 ], (array) $g);

        $this->expectOutput(<<<OUTPUT
        0: 1
        1: 2
        2: 3
        3: 4

        OUTPUT);        
        foreach ($b as $index => $value) {
            echo "$index: $value\n";
        }
    }

    public function testFloat32Array(): void
    {
        $b = new Float32Array([ 1, 2, 3, 4 ]);
        $this->assertSame([ 1.0, 2.0, 3.0, 4.0 ], (array) $b);
        $c = new Float32Array([ 1, 2, 3, 4 ]);
        $this->assertEquals($b, $c);
        $d = new Float32Array($b);
        $this->assertEquals($b, $d);
        $bytes = pack("fffff", -1, -2, -3, -4, -5);
        $buf = new ArrayBuffer($bytes, true);
        $e = new Float32Array($buf);
        $this->assertSame([ -1.0, -2.0, -3.0, -4.0, -5.0 ], (array) $e);
        $f = new Float32Array($buf, 8);
        $this->assertSame([ -3.0, -4.0, -5.0 ], (array) $f);
        $g = new Float32Array($buf, 4, 3);
        $this->assertSame([ -2.0, -3.0, -4.0 ], (array) $g);

        $this->expectOutput(<<<OUTPUT
        0: 1
        1: 2
        2: 3
        3: 4

        OUTPUT);        
        foreach ($b as $index => $value) {
            echo "$index: $value\n";
        }
    }

    public function testFloat64Array(): void
    {
        $b = new Float64Array([ 1, 2, 3, 4 ]);
        $this->assertSame([ 1.0, 2.0, 3.0, 4.0 ], (array) $b);
        $c = new Float64Array([ 1, 2, 3, 4 ]);
        $this->assertEquals($b, $c);
        $d = new Float64Array($b);
        $this->assertEquals($b, $d);
        $bytes = pack("ddddd", -1, -2, -3, -4, -5);
        $buf = new ArrayBuffer($bytes, true);
        $e = new Float64Array($buf);
        $this->assertSame([ -1.0, -2.0, -3.0, -4.0, -5.0 ], (array) $e);
        $f = new Float64Array($buf, 16);
        $this->assertSame([ -3.0, -4.0, -5.0 ], (array) $f);
        $g = new Float64Array($buf, 8, 3);
        $this->assertSame([ -2.0, -3.0, -4.0 ], (array) $g);

        $this->expectOutput(<<<OUTPUT
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
