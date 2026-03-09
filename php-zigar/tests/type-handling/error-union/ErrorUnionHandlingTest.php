<?php declare(strict_types=1);

final class ErrorUnionHandlingTest extends ZigarTestCase
{   
    public function testImportErrorUnionAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(123, $m->positive_outcome);
        $this->assertExceptionMessage('condom broke you pregnant', function() use($m) {
            $x = $m->negative_outcome;
        });

        $m->positive_outcome = 456;
        $this->assertSame(456, $m->positive_outcome);
        $m->negative_outcome = $m->Error->DogAteAllMemory;
        $this->assertExceptionMessage('dog ate all memory', function() use($m) {
            $x = $m->negative_outcome;
        });

        $this->assertExceptionMessage('dog ate all memory', function() use($m) {
            $m->encounterBadLuck(true);
        });
        $this->assertSame(456, $m->encounterBadLuck(false));

        $this->assertExceptionMessage('alien invasion', function() use($m) {
            $x = $m->bool_error;
        });
        $this->assertExceptionMessage('system is on fire', function() use($m) {
            $x = $m->i8_error;
        });
        $this->assertExceptionMessage('no more beer', function() use($m) {
            $x = $m->u16_error;
        });
        $this->assertExceptionMessage('dog ate all memory', function() use($m) {
            $x = $m->void_error;
        });

        $m->void_error = null;
        $this->assertSame(null, $m->void_error);
    }

    public function testPrintErrorUnionArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        221
        error.NoMoney

        OUTPUT);
        $m->print(221);
        $m->print(new Exception('no money'));
    }

    public function testReturnErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame(1234, $m->getSomething());

        $this->assertExceptionMessage('goldfish died', function() use($m) {
            $m->getFailure();
        });
    }

    public function testHandleErrorUnionInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame(4, count($m->array));
        $this->assertSame(1, $m->array[0]);
        $this->assertSame(2, $m->array[1]);
        $this->assertExceptionMessage('no money', function() use($m) {
            $x = $m->array[2];
        });
        $this->assertExceptionMessage('no money', function() use($m) {
            $x = (array) $m->array;
        });
        $this->assertSame(4, $m->array[3]);

        $this->expectOutputString(<<<OUTPUT
        { 1, 2, error.NoMoney, 4 }
        { 1, error.GoldfishDied, 3, 4 }

        OUTPUT);
        $m->print();
        $m->array[1] = $m->Error->GoldfishDied;
        $m->array[2] = 3;
        $m->print();
    }

    public function testHandleErrorUnionInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertExceptionMessage('goldfish died', function() use($m) {
            $x = $m->struct_a->number1;
        });
        $this->assertSame('-444', (string) $m->struct_a->number2);

        $b = new $m->StructA();
        $this->assertSame(123, $b->number1);
        $this->assertExceptionMessage('no money', function() use($b) {
            $x = $b->number2;
        });

        $this->expectOutputString(<<<OUTPUT
        .{ .number1 = error.GoldfishDied, .number2 = -444 }
        .{ .number1 = 123, .number2 = error.NoMoney }

        OUTPUT);
        $m->print();
        $m->struct_a = $b;
        $m->print();
    }

    public function testFailWithErrorUnionInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandleErrorUnionAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame(5000, $m->struct_a->number1);
        $this->assertExceptionMessage('goldfish died', function() use($m) {
            $x = $m->struct_a->number2;
        });

        $b = new $m->StructA(state: true);
        $this->assertSame(5000, $b->number1);
        $this->assertExceptionMessage('goldfish died', function() use($b) {
            $x = $b->number2;
        });

        $this->expectOutputString(<<<OUTPUT
        .{ .state = true, .number1 = 5000, .number2 = error.GoldfishDied }

        OUTPUT);
        $m->print($b);
    }

    public function testHandleErrorUnionInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame(3456, $m->union_a->number);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m) {
                $x = $m->union_a->state;
            });
        }

        $b = new $m->UnionA(number: $m->Error->GoldfishDied);
        $c = new $m->UnionA(state: false);
        $this->assertExceptionMessage('goldfish died', function() use($b) {
            $x = $b->number;
        });
        $this->assertSame(false, $c->state);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'state' is active", function() use($m, $c) {
                $x = $c->number;
            });
        }

        $m->union_a = $b;
        $this->assertExceptionMessage('goldfish died', function() use ($m) {
            $x = $m->union_a->number;
        });
        $m->union_a = $c;
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'state' is active", function() use($m) {
                $x = $m->union_a->number;
            });
        }        
    }

    public function testHandleErrorUnionInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame(3456, $m->union_a->number);
        $tag = $m->TagType($m->union_a);
        $this->assertSame($m->TagType->number, $tag);
        $this->assertSame(null, $m->union_a->state);

        $b = new $m->UnionA(number: $m->Error->GoldfishDied);
        $c = new $m->UnionA(state: false);
        $this->assertExceptionMessage('goldfish died', function() use($b) {
            $x = $b->number;
        });
        $this->assertSame(false, $c->state);
        $this->assertSame(null, $c->number);

        $m->union_a = $b;
        $this->assertExceptionMessage('goldfish died', function() use($m) {
            $x = $m->union_a->number;
        });

        $m->union_a = $c;
        $this->assertSame(null, $m->union_a->number);
    }

    public function testHandleErrorUnionInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
    }

    public function testHandleErrorUnionInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
    }

    public function testFailWithErrorUnionInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }
}

