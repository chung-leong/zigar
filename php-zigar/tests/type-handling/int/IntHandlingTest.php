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
        $this->assertSame(7, $m->int4);
        $this->assertSame(1234, $m->size1);
        $this->assertSame(-1234, $m->size2);

        // TODO: test big int implementation

        $this->expectExceptionMessage("write protected (zig)");
        $m->int16 = -123;

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
        $this->assertSame(0x7FFF_FFFF_FFFF_FFFF, $m->getUsize());
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

        $this->expectOutputString(<<<OUTPUT
        .{ .number1 = -5, .number2 = -444 }

        OUTPUT);
        $m->print();
    }

    public function testHandleIntInPackedStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleIntAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleIntInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleIntInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame("B", "B");
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
        $this->assertSame("B", "B");
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

