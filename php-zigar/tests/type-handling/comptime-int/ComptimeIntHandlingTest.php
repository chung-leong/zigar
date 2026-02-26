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
        $this->assertSame([ 1, 2, 3, 4 ], (array) $m->array1);
        // $this->assertSame(0x1000_0000_0000_0000, $m->array2[0]);
        // $this->assertSame(0x2000_0000_0000_0000, $m->array2[1]);
    }

    public function testHandleComptimeIntInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame([ 'number1' => 1, 'number2' => 2 ], (array) $m->struct_a);

        $this->expectExceptionMessage("write protected (zig)");
        $x = new $m->StructA(number1: 1);

        $b = new $m->StructA([]);
        $this->assertSame([ 'number1' => 100, 'number2' => 200 ], (array) $b);
        $this->expectOutputString(<<<OUTPUT
        .{ .number1 = 1, .number2 = 2 }

        OUTPUT);
        $m->print();
    }

    public function testHandleComptimeIntInPackedStruct(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
    }

    public function testHandleComptimeIntAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame(1234, $m->struct_a->number);
        $b = new $m->StructA(state: false);
        $this->assertSame([ 'number' => 1234, 'state' => false ], (array) $b);
    }

    public function testHandleComptimeIntInBareUnion(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
    }

    public function testHandleComptimeIntInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame(123, $m->union_a->number);
        $this->assertSame([ 'number' => 123 ], (array) $m->union_a);
        $tag = $m->TagType($m->union_a);
        $this->assertSame('number', (string) $tag);

        $b = new $m->UnionA(state: true);
        $this->assertSame([ 'state' => true ], (array) $b);

        $this->expectExceptionMessage("write protected (zig)");
        $x = new $m->UnionA(number: 0);
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
        $this->assertSame(1234, $m->error_union1);
        $this->expectExceptionMessage("goldfish died");
        $x = $m->error_union2;
    }

    public function testHandleComptimeIntInVector(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
    }   

    public function testConstructComptimeInt(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $this->assertSame(false, isset($m->ComptimeInt));
    }
}

