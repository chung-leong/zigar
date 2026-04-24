<?php declare(strict_types=1);

final class StructHandlingTest extends ZigarTestCase
{   
    public function testImportStructAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame([ 'number1' => 123, 'number2' => 456 ], (array) $m->constant);
        $this->assertEquals((object) [ 
            'number1' => 123, 
            'number2' => 456
        ], $m->constant->__plain);
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

        $this->assertEquals((object) [
            'input' => (object) [
                'src' => (object) [ 'channels' => 4 ],
                'params' => [ 0, 1, 2, 3 ],
            ]
        ], $m->comptime_struct->__plain);
        $this->assertEquals([
            123,
            3.14,
            'evil',
        ], $m->tuple->__plain);
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
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        $this->assertEquals((object) [
            'struct1' => (object) [ 'number1' => 1, 'number2' => 2 ],
            'struct2' => (object) [ 'number1' => 3, 'number2' => 4 ],
            'number' => 200,
            'struct3' => (object) [ 'number1' => 5, 'number2' => 6 ],
        ], $m->struct_a->__plain);

        $this->expectOutputString(<<<OUTPUT
        .{ .struct1 = .{ .number1 = 1, .number2 = 2 }, .struct2 = .{ .number1 = 3, .number2 = 4 }, .number = 200, .struct3 = .{ .number1 = 5, .number2 = 6 } }
        .{ .struct1 = .{ .number1 = 1, .number2 = 2 }, .struct2 = .{ .number1 = 3, .number2 = 4 }, .number = -3, .struct3 = .{ .number1 = 5, .number2 = -8 } }

        OUTPUT);
        $m->print();
        $m->struct_a->number = -3;
        $m->struct_a->struct3->number2 = -8;
        $m->print();
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
        // TODO:
        // $this->assertExceptionMessage('goldfish died', function() use($m) {
        //     $x = $m->error_union;
        // });
        $m->error_union = [ 'number1' => 1, 'number2' => 2 ];
        $m->print();
    }

    public function testFailWithStructInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }

    public function testConstructStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $b = new $m->Struct(number1: 1111, number2: 2222);
        $this->assertEquals((object) [ 'number1' => 1111, 'number2' => 2222, 'number3' => 3333 ], $b->__plain);
        $this->assertExceptionMessage("struct constructor expects an array as argument or named arguments", function() use($m) {
            $x = new $m->Struct();
        });
        $this->assertExceptionMessage("missing initializer", function() use($m) {
            $x = new $m->Struct(number1: 1234);
        });

        $c = new $m->ExternStruct(number1: 1111, number2: 2222);
        $this->assertEquals((object) [ 'number1' => 1111, 'number2' => 2222 ], $c->__plain);
        $d = $m->ExternStruct(pack('ll', 1234, 4567));
        $this->assertEquals((object) [ 'number1' => 1234, 'number2' => 4567 ], $d->__plain);

        $e = new $m->PackedStruct(
            state1: true,
            state2: false,
            state3: true,
            state4: false,
            state5: true,
            state6: false,
            state7: true,
            state8: false,
        );
        $this->assertEquals((object) [ 
            'state1' => true, 
            'state2' => false, 
            'state3' => true, 
            'state4' => false, 
            'state5' => true, 
            'state6' => false, 
            'state7' => true, 
            'state8' => false,
        ], $e->__plain);
        $f = $m->PackedStruct("\xFE");
        $this->assertEquals((object) [ 
            'state1' => false, 
            'state2' => true, 
            'state3' => true, 
            'state4' => true, 
            'state5' => true, 
            'state6' => true, 
            'state7' => true, 
            'state8' => true,
        ], $f->__plain);
        $this->assertEquals(0xfe, $f->__int);
        $this->assertEquals(0xfe, (int) $f);
        $g = new $m->PackedStruct();
        $this->assertEquals(0, $g->__int);
        $this->assertEquals(true, (bool) $g);
    }
}

