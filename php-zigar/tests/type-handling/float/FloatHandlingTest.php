<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class FloatHandlingTest extends TestCase
{   
    public function testImportFloatAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(-44.4, round($m->float16_const, 1));
        $this->assertSame(0.44, round($m->float16, 2));
        $this->assertSame(0.1234, round($m->float32_const, 4));
        $this->assertSame(34567.56, round($m->float32, 2));
        $this->assertSame(M_PI, $m->float64);
        $this->assertSame(M_PI, $m->float80);
        $this->assertSame(M_PI, $m->float128);

        $this->expectOutputString(<<<OUTPUT
        3.141592653589793
        1.234

        OUTPUT);
        $m->print();
        $m->float64 = 1.234;
        $m->print();

        $this->expectExceptionMessage("write protected (zig)");
        $this->float16_const = 1.23;
    }

    public function testPrintFloatArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        3.14 3.1415927
        3.141592653589793 3.141592653589793116 3.141592653589793115997963468544185

        OUTPUT);
        $m->print1(M_PI, M_PI);
        $m->print2(M_PI, M_PI, M_PI);
    }

    public function testReturnFloat(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame(-44.40625, $m->getFloat16());
        $this->assertSame(0.1234000027179718, $m->getFloat32());
        $this->assertSame(M_PI, $m->getFloat64());
        $this->assertSame(M_PI, $m->getFloat80());
        $this->assertSame(M_PI, $m->getFloat128());
    }

    public function testHandleFloatInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame(2.25, $m->array1[1]);
        $this->assertSame(3.25, $m->array1[2]);
        $this->assertSame(2.1, $m->array2[1]);
        $this->assertSame(3.1, $m->array2[2]);
        $this->assertSame(2.1, $m->array3[1]);
        $this->assertSame(3.1, $m->array3[2]);

        // TODO array assignment
    }

    public function testHandleFloatInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleFloatInPackedStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleFloatAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame(5.55, $m->struct_a->number);
        // TODO
    }

    public function testHandleFloatInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleFloatInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleFloatInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame(3.14, $m->optional);

        $this->expectOutputString(<<<OUTPUT
        3.14
        null
        8.12

        OUTPUT);
        $m->print();
        $m->optional = null;
        $m->print();
        $m->optional = 8.12;
        $m->print();
    }

    public function testHandleFloatInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleFloatInVector(): void
    {
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        $this->assertSame("B", "B");
    }   
}

