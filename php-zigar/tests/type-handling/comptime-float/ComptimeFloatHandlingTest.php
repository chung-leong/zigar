<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class ComptimeFloatHandlingTest extends TestCase
{   
    public function testImportComptimeFloatAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(M_PI, $m->pi);
        
        $this->expectExceptionMessage("write protected (zig)");
        $m->pi = 1234;
    }

    public function testPrintComptimeFloatArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectException(Error::class);
        $m->print();
    }

    public function testReturnComptimeFloat(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->expectException(Error::class);
        $m->getComptimeFloat();
    }

    public function testHandleComptimeFloatInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame([ 1.1, 2.1, 3.1, 4.1 ], (array) $m->array);
    }

    public function testHandleComptimeFloatInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame([ 'number1' => 1.1, 'number2' => 2.2 ], (array) $m->struct_a);

        $this->expectExceptionMessage("write protected (zig)");
        $x = new $m->StructA(number1: 1.0);

        $b = new $m->StructA([]);
        $this->assertSame([ 'number1' => 0.1, 'number2' => 0.2 ], (array) $b);
        $this->expectOutputString(<<<OUTPUT
        .{ .number1 = 1.1, .number2 = 2.2 }

        OUTPUT);
        $m->print();
    }

    public function testHandleComptimeFloatInPackedStruct(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
    }

    public function testHandleComptimeFloatAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame(1.234, $m->struct_a->number);
        $b = new $m->StructA(state: false);
        $this->assertSame([ 'state' => false, 'number' => 1.234 ], (array) $b);
    }

    public function testHandleComptimeFloatInBareUnion(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
    }

    public function testHandleComptimeFloatInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame(1.23, $m->union_a->number);
        $this->assertSame([ 'number' => 1.23 ], (array) $m->union_a);
        $tag = $m->TagType($m->union_a);
        $this->assertSame('number', (string) $tag);

        $b = new $m->UnionA(state: true);
        $this->assertSame([ 'state' => true ], (array) $b);

        $this->expectExceptionMessage("write protected (zig)");
        $x = new $m->UnionA(number: 0.0);
    }

    public function testHandleComptimeFloatInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame(1234.0, $m->optional1);
        $this->assertSame(null, $m->optional2);
    }

    public function testHandleComptimeFloatInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame(1234.0, $m->error_union1);
        $this->expectExceptionMessage("goldfish died");
        $x = $m->error_union2;
    }

    public function testHandleComptimeFloatInVector(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
    }   

    public function testConstructComptimeFloat(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $this->assertSame(false, isset($m->ComptimeFloat));
    }
}

