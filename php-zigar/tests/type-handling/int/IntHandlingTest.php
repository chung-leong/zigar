<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class IntHandlingTest extends TestCase
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
        $this->assertEquals(gmp_init("0xFFFFFFFFFFFFFFFF12345678"), $m->int128);
        $this->assertSame(7, $m->int4);
        $this->assertSame(1234, $m->size1);
        $this->assertSame(-1234, $m->size2);
        $this->assertSame(false, isset($m->private));

        $this->expectOutputString(<<<OUTPUT
        44
        66
        88

        OUTPUT);
        $m->print();
        $module->uint16 = 66;
        $m->print();
        $module->uint16 = 88;
        $m->print();

        $this->expectExceptionMessage("write protected (zig)");
        $m->int16 = -123;
    }

    public function testPrintIntArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        123 456
        0xdeadbeef 0xbadf00d

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
        $this->assertSame(2, $m->array1[1]);
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
        $m->print();
        $this->expectOutputString(<<<OUTPUT
        .{ .number1 = 15, .number2 = 777, .state = true, .number3 = -420 }

        OUTPUT);
    }

    public function testHandleIntAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame(true, $m->struct_a->state);
        $this->assertSame(5000, $m->struct_a->number);
        $m->struct_a->number = 5000;
    }

    public function testHandleIntInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame(1234, $m->union_a->number);
        $m->union_a->number = 4567;
        $this->assertSame(4567, $m->union_a->number);
    }

    public function testHandleIntInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame(3456, $m->union_a->number);
        $this->expectExceptionMessage("access of union field 'state' while field 'number' is active");
        $m->union_a->state = false;
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
        GoldfishDied
        4000

        OUTPUT);
        $m->print();
        $m->error_union = $m->Error->GoldfishDied;
        $m->print();
        $m->error_union = 4000;
        $m->print();

        $this->expectException(ZigError);
        $m->error_union;
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
}

