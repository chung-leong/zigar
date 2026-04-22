<?php declare(strict_types=1);

final class ComptimeFloatHandlingTest extends ZigarTestCase
{   
    public function testImportComptimeFloatAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(M_PI, $m->pi);
        
        $this->assertExceptionMessage("write protected (zig)", function() use($m) {
            $m->pi = 1234;
        });
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
        $this->assertSame([ 1.1, 2.1, 3.1, 4.1 ], $m->array->__plain);
    }

    public function testHandleComptimeFloatInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame([ 'number1' => 1.1, 'number2' => 2.2 ], (array) $m->struct_a);

        $this->assertExceptionMessage("write protected (zig)", function() use($m) {
            $x = new $m->StructA(number1: 1.0);
        });

        $b = new $m->StructA([]);
        $this->assertSame([ 'number1' => 0.1, 'number2' => 0.2 ], (array) $b);
        $this->expectOutputString(<<<OUTPUT
        .{ .number1 = 1.1, .number2 = 2.2 }

        OUTPUT);
        $m->print();
    }

    public function testFailWithComptimeFloatInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandleComptimeFloatAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame(1.234, $m->struct_a->number);
        $b = new $m->StructA(state: false);
        $this->assertSame([ 'state' => false, 'number' => 1.234 ], (array) $b);
    }

    public function testFailWithComptimeFloatInBareUnion(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        });
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

        $this->assertExceptionMessage("comptime value", function() use($m) {
            $x = new $m->UnionA(number: 0.0);
        });
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
        $this->assertExceptionMessage("goldfish died", function() use($m) {
            $x = $m->error_union2;
        });
    }

    public function testFailWithComptimeFloatInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }   

    public function testConstructComptimeFloat(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $this->assertSame(true, isset($m->ComptimeFloat));
        $this->assertSame(true, is_callable($m->ComptimeFloat));
        $this->assertSame(true, is_callable([ $m, 'ComptimeFloat' ]));
        $this->assertExceptionMessage("cannot create comptime object", function() use($m) {
            $x = new $m->ComptimeFloat(1.0);
        });
    }
}

