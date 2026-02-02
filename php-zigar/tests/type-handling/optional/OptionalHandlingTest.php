<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class OptionalHandlingTest extends TestCase
{   
    public function testImportOptionalAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(null, $m->i32_empty);
        $this->assertSame(1234, $m->i32_value);
    }

    public function testPrintOptionalArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        1234
        null

        OUTPUT);
        $m->print(1234);
        $m->print(null);
    }

    public function testReturnOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame(1234, $m->getSomething());
        $this->assertSame(null, $m->getNothing());
    }

    public function testHandleOptionalInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame(2, $m->array[1]);
        $this->assertSame(null, $m->array[2]);

        $this->expectOutputString(<<<OUTPUT
        .{ 1, 2, null, 4 }
        .{ 1, null, null, 4 }
        .{ 1, null, 777, 4 }

        OUTPUT);
        $m->print();
        $m->array[1] = null;
        $m->print();
        $m->array[2] = 777;
        $m->print();
    }

    public function testHandleOptionalInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleOptionalInPackedStruct(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
    }

    public function testHandleOptionalAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleOptionalInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleOptionalInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleOptionalInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame(null, $m->optional);

        $this->expectOutputString(<<<OUTPUT
        void
        null

        OUTPUT);
        $m->print();
        $m->optional = null;
        $m->print();

        $this->expectExceptionMessage("not null (zig)");
        $m->optional = 123;
    }

    public function testHandleOptionalInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleOptionalInVector(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
    }
}

