<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class VoidHandlingTest extends TestCase
{   
    public function testImportVoidAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(null, $m->empty);
        $this->assertSame(null, $m->empty_writable);

        $m->empty_writable = null;

        $this->expectExceptionMessage("write protected (zig)");
        $m->empty = null;
    }

    public function testPrintVoidArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $m->print(null);
        $this->expectOutputString(<<<OUTPUT
        void

        OUTPUT);

        $this->expectExceptionMessage("not null (zig)");
        $m->print(123);
    }

    public function testReturnVoid(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame(null, $m->getVoid());
    }

    public function testHandleVoidInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame(null, $m->array[1]);
        $this->assertSame([ null, null, null, null ], (array) $m->array);
        $this->assertSame(null, $m->array_writable[3]);
        $m->array_writable[3] = null;

        $this->expectOutputString(<<<OUTPUT
        { void, void, void, void }

        OUTPUT);
        $m->print();

        $this->expectExceptionMessage("write protected (zig)");
        $m->array[2] = null;

        $this->expectExceptionMessage("out of bound (zig)");
        $m->array_writable[4] = null;
    }

    public function testHandleVoidInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleVoidInPackedStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleVoidAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleVoidInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleVoidInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleVoidInOptional(): void
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

    public function testHandleVoidInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleVoidInVector(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
    }
}

