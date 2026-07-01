<?php declare(strict_types=1);

final class BoolHandlingTest extends ZigarTestCase
{   
    public function testImportBoolAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertTrue($m->bool1);
        $this->assertFalse($m->bool2);
        $this->assertTrue($m->bool3);
        $this->assertFalse($m->bool4);

        $m->bool1 = false;
        $this->assertFalse($m->bool1);

        $this->assertExceptionMessage("write protected (zig)", function() use($m) {
            $m->bool4 = false;
        });

        $this->expectOutputString('no');
        $m->print();
    }

    public function testPrintBoolArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        no
        yes

        OUTPUT);
        $m->print(false);
        $m->print(true);       
    }

    public function testReturnBool(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertFalse($m->getFalse());
        $this->assertTrue($m->getTrue());
    }

    public function testHandleBoolInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame([ false, false, false, false ], (array) $m->array_const);
        $this->assertSame([ true, false, false, true ], (array) $m->array);

        $this->expectOutputString(<<<OUTPUT
        { true, false, false, true }
        { false, false, false, true }
        { false, false, true, true }

        OUTPUT);
        $m->print();
        $m->array[0] = false;
        $m->print();
        $m->array[2] = true;
        $m->print();

        $this->assertExceptionMessage("write protected (zig)", function() use($m) {
            $m->array_const[2] = false;
        });
    }

    public function testHandleBoolInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame([ 'state1' => false, 'state2' => true ], (array) $m->struct_a);
        $b = new $m->StructA();
        $this->assertTrue($b->state1);
        $this->assertFalse($b->state2);

        $this->expectOutputString(<<<OUTPUT
        .{ .state1 = false, .state2 = true }
        .{ .state1 = true, .state2 = false }

        OUTPUT);       
        $m->print();
        $m->struct_a = $b;
        $m->print();
    }

    public function testHandleBoolInPackedStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');        
        $this->assertSame([ 
            'state1' => false, 
            'state2' => true,
            'number' => 200,
            'state3' => true,
        ], (array) $m->struct_a);
        $b = new $m->StructA();
        $this->assertSame([ 
            'state1' => true, 
            'state2' => false,
            'number' => 100,
            'state3' => false,
        ], (array) $b);

        $this->expectOutputString(<<<OUTPUT
        .{ .state1 = false, .state2 = true, .number = 200, .state3 = true }
        .{ .state1 = true, .state2 = false, .number = 100, .state3 = false }

        OUTPUT);       
        $m->print();
        $m->struct_a = $b;
        $m->print();
    }

    public function testHandleBoolAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertFalse($m->struct_a->state);
        $b = new $m->StructA([ 'number' => 500 ]);
        $this->assertFalse($b->state);

        $this->expectOutputString(<<<OUTPUT
        .{ .number = 500, .state = false }

        OUTPUT);       
        $m->print($b);
    }

    public function testHandleBoolInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertTrue($m->union_a->state);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'state' is active", function() use($m) {
                $x = $m->union_a->number;
            });
        }

        $b = new $m->UnionA(state: false);
        $this->assertFalse($b->state);
        $c = new $m->UnionA(number: 123);
        $this->assertSame(123, $c->number);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($c) {
                $x = $c->state;
            });
        }

        $m->union_a = $b;
        $this->assertFalse($m->union_a->state);
        $m->union_a = $c;
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m) {
                $x = $m->union_a->state;
            });
        }
    }

    public function testHandleBoolInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertTrue($m->union_a->state);
        $this->assertSame(null, $m->union_a->number);
    }

    public function testHandleBoolInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->expectOutputString("true\nnull\nfalse\ntrue\n");
        $m->print();
        $m->optional = null;
        $m->print();
        $m->optional = false;
        $m->print();
        $m->optional = true;
        $m->print();
    }

    public function testHandleBoolInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertTrue($m->error_union);

        $this->expectOutputString(<<<OUTPUT
        true
        error.GoldfishDied
        error.NoMoney
        false

        OUTPUT);       
        $m->print();
        $m->error_union = new Exception('goldfish died');
        $m->print();
        $m->error_union = new Exception('no money');
        $m->print();
        $m->error_union = false;
        $m->print();
    }

    public function testHandleBoolInVector(): void
    {
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        $this->assertSame([ true, false, false, true ], (array) $m->vector);
        $this->assertSame([ false, false, false, false ], (array) $m->vector_const);

        $this->expectOutputString(<<<OUTPUT
        { true, false, false, true }
        { false, false, false, true }
        { false, false, true, true }

        OUTPUT);
        $m->print();
        $m->vector[0] = false;
        $m->print();
        $m->vector[2] = true;
        $m->print();

        $this->assertExceptionMessage("write protected (zig)", function() use($m) {
            $m->vector_const[2] = false;
        });
    }   

    public function testConstructBool(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $a = new $m->Bool(true);
        $b = new $m->Bool(false);
        $this->assertTrue((bool) $a);
        $this->assertFalse((bool) $b);
        $c = $m->Bool(new ArrayBuffer("\x00"));
        $d = $m->Bool(new ArrayBuffer("\x01"));
        $this->assertFalse((bool) $c);
        $this->assertTrue((bool) $d);
        $clone = clone $b;
        $this->assertEquals($b, $clone);
    }
}

