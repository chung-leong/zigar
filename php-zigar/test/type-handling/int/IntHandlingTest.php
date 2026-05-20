<?php declare(strict_types=1);

final class IntHandlingTest extends ZigarTestCase
{   
    public function testImportIntAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(127, $m->int8);
        $this->assertSame(0, $m->uint8);
        $this->assertSame(-44, $m->int16);
        $this->assertSame(44, $m->uint16);
        $this->assertSame(1234, $m->int32);
        $this->assertSame(34567, $m->uint32);
        $this->assertSame(0x1FFF_FFFF_FFFF_FFFF, $m->int64);
        $this->assertSame(0x7FFF_FFFF_FFFF_FFFF, $m->uint64);
        $this->assertSame((string) gmp_init("0xFFFFFFFFFFFFFFFF12345678"), (string) $m->int128);
        $this->assertSame(7, $m->int4);
        $this->assertSame(1234, $m->size1);
        $this->assertSame(-1234, $m->size2);
        $this->assertFalse(isset($m->private));

        $this->expectOutputString(<<<OUTPUT
        44
        66
        88

        OUTPUT);
        $m->print();
        $m->uint16 = 66;
        $m->print();
        $m->uint16 = 88;
        $m->print();

        $this->assertExceptionMessage("write protected (zig)", function() use($m) {
            $m->int16 = -123;
        });
    }

    public function testPrintIntArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        123 456
        deadbeef badf00d

        OUTPUT);
        $m->print1(123, 456);
        $m->print2(0xdead_beef, 0xbad_f00d);
    }

    public function testReturnInt(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame(127, $m->getInt8());
        $this->assertSame(0, $m->getUint8());
        $this->assertSame(-44, $m->getInt16());
        $this->assertSame(44, $m->getUint16());
        $this->assertSame(1234, $m->getInt32());
        $this->assertSame(34567, $m->getUint32());
        $this->assertSame(0x1FFF_FFFF_FFFF_FFFF, $m->getInt64());
        $this->assertSame(0x7FFF_FFFF_FFFF_FFFF, $m->getUint64());
        $this->assertSame(1000, $m->getIsize());
        if (PHP_INT_SIZE == 4) {
            $this->assertSame(0x7FFF_FFFF, $m->getUsize());
        } else {
            $this->assertSame(0x7FFF_FFFF_FFFF_FFFF, $m->getUsize());
        } 
    }

    public function testHandleIntInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame(1, $m->array1[0]);
        $this->assertSame(2, $m->array2[1]);
        $this->assertSame((string) gmp_init("3"), (string) $m->array3[2]);

        for ($i = 0; $i < count($m->array2); $i++) {
            $m->array2[$i] *= 10;
        }
        for ($i = 0; $i < count($m->array3); $i++) {
            $m->array3[$i] *= 100;
        }
        $this->expectOutputString(<<<OUTPUT
        { 1, 2, 3, 4 }
        { 10, 20, 30, 40 }
        { 100, 200, 300, 400 }

        OUTPUT);
        $m->print1();
        $m->print2();
        $m->print3();
    }

    public function testHandleIntInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $m->struct_a->number2 = -555;
        $m->print();
        $this->expectOutputString(<<<OUTPUT
        .{ .number1 = -5, .number2 = -555 }

        OUTPUT);
    }

    public function testHandleIntInPackedStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        $this->assertSame(15, $m->struct_a->number1);
        $this->assertSame(777, $m->struct_a->number2);
        $this->assertSame(-420, $m->struct_a->number3);
        $this->assertSame(1, $m->struct_b->number1);
        $this->assertSame((string) gmp_init("12345678901234567890"), (string) $m->struct_b->number2);
        $this->assertFalse($m->struct_b->state);

        $m->print();
        $this->expectOutputString(<<<OUTPUT
        .{ .number1 = 15, .number2 = 777, .state = true, .number3 = -420 }

        OUTPUT);
    }

    public function testHandleIntAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertTrue($m->struct_a->state);
        $this->assertSame(5000, $m->struct_a->number);
        $b = new $m->StructA(state: true);
        $this->assertSame([ 'state' => true, 'number' => 5000 ], (array) $b);
    }

    public function testHandleIntInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame(1234, $m->union_a->number);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m) {
                $x = $m->union_a->state;
            });
        }
        $b = new $m->UnionA(number: 4567);
        $c = new $m->UnionA(state: false);
        $this->assertSame(4567, $b->number);
        $this->assertFalse($c->state);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'state' is active", function() use($c) {
                $x = $c->number;
            });
        }

        $m->union_a = $b;
        $this->assertSame(4567, $m->union_a->number);
        $m->union_a = $c;
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'state' is active", function() use($m) {
                $x = $m->union_a->number;
            });
        }
    }

    public function testHandleIntInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame(3456, $m->union_a->number);
        $tag = $m->TagType($m->union_a);
        $this->assertSame('number', (string) $tag);
        $this->assertSame(null, $m->union_a->state);

        $b = new $m->UnionA(number: 123);
        $c = new $m->UnionA(state: false);
        $this->assertFalse($c->state);
        $this->assertSame(null, $c->number);
        
        $m->union_a = $b;
        $this->assertSame(123, $m->union_a->number);
        $this->assertExceptionMessage("access of union field 'state' while field 'number' is active", function() use($m) {
            $m->union_a->state = false;
        });
        $m->union_a = $c;
        $this->assertSame(null, $m->union_a->number);
    }

    public function testHandleIntInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->expectOutputString(<<<OUTPUT
        3000
        null
        12345
        12345
        
        OUTPUT);
        $m->print();
        $m->optional = null;
        $m->print(); 
        $m->optional = 12345;
        $m->print();
        $print = $m->print;
        $print();
    }

    public function testHandleIntInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame(3000, $m->error_union);

        $this->expectOutputString(<<<OUTPUT
        3000
        error.GoldfishDied
        4000

        OUTPUT);
        $m->print();
        $m->error_union = $m->Error->GoldfishDied;
        $m->print();
        $m->error_union = 4000;
        $m->print();

        $m->error_union = new Exception('no money');
        $this->expectException('ZigError');
        $x = $m->error_union;
    }

    public function testHandleIntInVector(): void
    {
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        $this->assertSame(1, $m->vector1[0]);
        $this->assertSame(2, $m->vector1[1]);
        for ($i = 0; $i < count($m->vector2); $i++) {
            $m->vector2[$i] *= 10;
        }
        for ($i = 0; $i < count($m->vector3); $i++) {
            $m->vector3[$i] *= 100;
        }

        $this->expectOutputString(<<<OUTPUT
        { 1, 2, 3, 4 }
        { 10, 20, 30, 40 }
        { 100, 200, 300, 400 }

        OUTPUT);
        $m->print1();
        $m->print2();
        $m->print3();
    }

    public function testConstructInt(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $a = new $m->Int(1234);
        $b = new $m->Int(-2);
        $this->assertSame(1234, (int) $a);
        $this->assertSame(-2, (int) $b);
        $c = new $m->Int('4567');
        $this->assertSame(4567, (int) $c);
        $this->assertExceptionMessage('not integer', function() use($m) {
            $x = new $m->Int('Hello');
        });
        $d = new $m->Int('2000.0');
        $this->assertSame(2000, (int) $d);
        $e = new $m->Int(2000.0);
        $this->assertSame(2000, (int) $e);
        $this->assertExceptionMessage('not integer', function() use($m) {
            $x = new $m->Int(3.01);
        });
        $d = new $m->BigInt('12345678901234567890123456789012345678');
        $this->assertSame('12345678901234567890123456789012345678', (string) $d);
        $e = new $m->Int('4567');
        $this->assertTrue($c == $e);
        $f = new $m->BigInt('12345678901234567890123456789012345678');
        $this->assertFalse($c == $f);
        $this->assertTrue($d == $f);
    }
}

