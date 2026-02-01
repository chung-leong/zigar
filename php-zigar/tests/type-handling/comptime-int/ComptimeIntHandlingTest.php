<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class ComptimeIntHandlingTest extends TestCase
{   
    public function testImportComptimeIntAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(127, $m->small);
        $this->assertSame(-167, $m->negative);
        $this->assertSame(0x1234_5678, $m->larger);

        $this->expectExceptionMessage("write protected (zig)");
        $m->larger = 1234;
    }

    public function testIgnoreFunctionAcceptingComptimeInt(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectException(Error::class);
        $m->print();
    }

    public function testIgnoreFunctionReturningComptimeInt(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->expectException(Error::class);
        $m->getComptimeInt();
    }

    public function testHandleComptimeIntInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame(1, $m->array1[0]);
        $this->assertSame(2, $m->array1[1]);
        $this->assertSame(3, $m->array1[2]);
        $this->assertSame(4, $m->array1[3]);
        $this->assertSame(0x1000_0000_0000_0000, $m->array2[0]);
        $this->assertSame(0x2000_0000_0000_0000, $m->array2[1]);
    }

    public function testHandleComptimeIntInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeIntInPackedStruct(): void
    {
        $this->expectExceptionMessage("unable to create module 'in-packed-struct'");
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
    }

    public function testHandleComptimeIntAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeIntInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeIntInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeIntInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame(1234, $m->optional1);
        $this->assertSame(null, $m->optional2);
    }

    public function testHandleComptimeIntInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeIntInVector(): void
    {
        $this->expectExceptionMessage("unable to create module 'vector-of'");
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
    }   
}

