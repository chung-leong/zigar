<?php declare(strict_types=1);

final class StructHandlingTest extends ZigarTestCase
{   
    public function testImportStructAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame([ 'number1' => 123, 'number2' => 456 ], (array) $m->constant);
        $this->assertExceptionMessage('write protected', function() use($m) {
            $m->constant->number1 = 1;
        });

        $this->expectOutputString(<<<OUTPUT
        .{ .number1 = 1, .number2 = 2 }
        .{ .number1 = 777, .number2 = 2 }
        .{ .number1 = 888, .number2 = 999 }

        OUTPUT);
        $m->print();
        $m->variable->number1 = 777;
        $m->print();
        $m->variable = [ 'number1' => 888, 'number2' => 999 ];
        $m->print();

        // TODO: comptime struct
    }

    public function testPrintStructArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        .{ .number1 = 11, .number2 = 44 }

        OUTPUT);
        $m->print(number1: 11, number2: 44);

        $this->assertExceptionMessage('not array or object', function() use($m) {
            $m->print(null);
        });
    }

    public function testReturnStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame([ 'number1' => 1, 'number2' => 2 ], (array) $m->getStruct());
    }

    public function testHandleStructInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame([ 'number1' => 1, 'number2' => 2 ], (array) $m->array_a[0]);
        $this->assertSame([ 'number1' => 3, 'number2' => 4 ], (array) $m->array_a[1]);
        $this->assertSame([ 'number1' => 5, 'number2' => 6 ], (array) $m->array_a[2]);
        $this->assertSame([ 'number1' => 7, 'number2' => 8 ], (array) $m->array_a[3]);

        // TODO: test to plain

        $this->expectOutputString(<<<OUTPUT
        { .{ .number1 = 1, .number2 = 2 }, .{ .number1 = 3, .number2 = 4 } }
        { .{ .number1 = 1, .number2 = 2 }, .{ .number1 = 123, .number2 = 456 } }

        OUTPUT);
        $m->print();
        $m->array_c[1]->number1 = 123;
        $m->array_c[1]->number2 = 456;
        $m->print();
    }

    public function testHandleStructInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame([ 'number1' => 1, 'number2' => 2 ], (array) $m->struct_a->struct1);
        $this->assertSame([ 'number1' => 3, 'number2' => 4 ], (array) $m->struct_a->struct2);
        $b = new $m->StructA();
        $this->assertSame([ 'number1' => 10, 'number2' => 20 ], (array) $b->struct1);
        $this->assertSame([ 'number1' => 11, 'number2' => 21 ], (array) $b->struct2);

        $this->expectOutputString(<<<OUTPUT
        .{ .struct1 = .{ .number1 = 1, .number2 = 2 }, .struct2 = .{ .number1 = 3, .number2 = 4 } }
        .{ .struct1 = .{ .number1 = 10, .number2 = 20 }, .struct2 = .{ .number1 = 11, .number2 = 21 } }

        OUTPUT);
        $m->print();
        $m->struct_a = $b;
        $m->print();
    }

    public function testHandleStructInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandleStructAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame([ 'number1' => 100, 'number2' => 200 ], (array) $m->struct_a->structure);
        $b = new $m->StructA(number: 500);
        $this->assertSame([ 'number1' => 100, 'number2' => 200 ], (array) $b->structure);
        $this->assertSame(500, $b->number);

        $this->expectOutputString(<<<OUTPUT
        .{ .number = 500, .structure = .{ .number1 = 100, .number2 = 200 } }

        OUTPUT);
        $m->print($b);
    }

    public function testHandleStructInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame([ 'number1' => 100, 'number2' => 200 ], (array) $m->union_a->structure);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'structure' is active", function() use($m) {
                $x = $m->union_a->number;
            });
        }

        $b = new $m->UnionA(structure: [ 'number1' => 1, 'number2' => 2 ]);
        $c = new $m->UnionA(number: 123);
        $this->assertSame([ 'number1' => 1, 'number2' => 2 ], (array) $b->structure);
        $this->assertSame(123, $c->number);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m, $c) {
                $x = $c->structure;
            });
        }

        $m->union_a = $b;
        $this->assertSame([ 'number1' => 1, 'number2' => 2 ], (array) $m->union_a->structure);
        $m->union_a = $c;
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m) {
                $x = $m->union_a->structure;
            });
        }        
    }

    public function testHandleStructInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame([ 'number1' => 100, 'number2' => 200 ], (array) $m->union_a->structure);
        $tag = $m->TagType($m->union_a);
        $this->assertSame($m->TagType->structure, $tag);
        $this->assertSame(null, $m->union_a->number);

        $b = new $m->UnionA(structure: [ 'number1' => 1, 'number2' => 2 ]);
        $c = new $m->UnionA(number: 123);
        $this->assertSame([ 'number1' => 1, 'number2' => 2 ], (array) $b->structure);
        $this->assertSame(123, $c->number);
        $this->assertSame(null, $c->structure);

        $m->union_a = $b;
        $this->assertSame([ 'number1' => 1, 'number2' => 2 ], (array) $m->union_a->structure);
        $m->union_a = $c;
        $this->assertSame(null, $m->union_a->structure);
    }

    public function testHandleStructInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame([ 'number1' => 100, 'number2' => 200 ], (array) $m->optional);

        $this->expectOutputString(<<<OUTPUT
        .{ .number1 = 100, .number2 = 200 }
        null
        .{ .number1 = 1, .number2 = 2 }

        OUTPUT);
        $m->print();
        $m->optional = null;
        $m->print();
        $m->optional = [ 'number1' => 1, 'number2' => 2 ];
        $m->print();
    }

    public function testHandleStructInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame([ 'number1' => 100, 'number2' => 200 ], (array) $m->error_union);
        $this->expectOutputString(<<<OUTPUT
        .{ .number1 = 100, .number2 = 200 }
        error.GoldfishDied
        .{ .number1 = 1, .number2 = 2 }

        OUTPUT);
        $m->print();
        $m->error_union = new Exception('goldfish died');
        $m->print();
        $this->assertExceptionMessage('goldfish died', function() use($m) {
            $x = $m->error_union;
        });
        $m->error_union = [ 'number1' => 1, 'number2' => 2 ];
        $m->print();
    }

    public function testHandleStructInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }
}

