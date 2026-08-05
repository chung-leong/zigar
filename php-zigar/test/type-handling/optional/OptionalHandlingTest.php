<?php declare(strict_types=1);

final class OptionalHandlingTest extends ZigarTestCase
{   
    public function testImportOptionalAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(null, $m->i32_empty);
        $this->assertSame(1234, $m->i32_value);
        $this->assertSame(null, $m->bool_empty);
        $this->assertTrue($m->bool_value);
        $this->assertSame(null, $m->f64_empty);
        $this->assertSame(3.14, $m->f64_value);
        $this->assertSame(null, $m->struct_empty);
        $this->assertEquals((object) [ 
            'integer' => 1234, 
            'boolean' => true, 
            'decimal' => 3.5,
        ], $m->struct_value);

        $this->expectOutput(<<<OUTPUT
        1234
        null
        4567

        OUTPUT);
        $m->print();
        $m->i32_value = null;
        $m->print();
        $m->i32_value = 4567;
        $m->print();
    }

    public function testPrintOptionalArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutput(<<<OUTPUT
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

        $this->expectOutput(<<<OUTPUT
        { 1, 2, null, 4 }
        { 1, null, null, 4 }
        { 1, null, 777, 4 }

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
        $this->assertSame([ 'number1' => null,  'number2' => -444 ], (array) $m->struct_a);
        $b = new $m->StructA();
        $this->assertSame([ 'number1' => 123,  'number2' => null ], (array) $b);
        $this->expectOutput(<<<OUTPUT
        .{ .number1 = null, .number2 = -444 }
        .{ .number1 = 123, .number2 = null }

        OUTPUT);
        $m->print();
        $m->struct_a = $b;
        $m->print();
    }

    public function testFailWithOptionalInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandleOptionalAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame(5000, $m->struct_a->number1);
        $this->assertSame(null, $m->struct_a->number2);
        $this->assertSame([
            'state' => true,
            'number1' => 5000, 
            'number2' => null,
        ], (array) $m->struct_a);

        $b = new $m->StructA(state: true);
        $this->assertSame(5000, $b->number1);
        $this->assertSame(null, $b->number2);

        $this->expectOutput(<<<OUTPUT
        .{ .state = true, .number1 = 5000, .number2 = null }

        OUTPUT);
        $m->print($b);
    }

    public function testHandleOptionalInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame(1234, $m->union_a->number);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m) {
                $x = $m->union_a->state;
            });
        }

        $b = new $m->UnionA(number: null);
        $c = new $m->UnionA(state: false);
        $this->assertSame(null, $b->number);
        $this->assertFalse($c->state);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'state' is active", function() use($c) {
                $x = $c->number;
            });
        }

        $m->union_a = $b;
        $this->assertSame(null, $m->union_a->number);
        $m->union_a = $c;
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'state' is active", function() use($c) {
                $x = $c->number;
            });
        }
    }

    public function testHandleOptionalInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame(3456, $m->union_a->number);
        $tag = $m->TagType($m->union_a);
        $this->assertSame($m->TagType->number, $tag);
        $this->assertSame(null, $m->union_a->state);

        $b = new $m->UnionA(number: null);
        $c = new $m->UnionA(state: false);
        $this->assertSame(null, $b->number);
        $this->assertFalse($c->state);
        $this->assertSame(null, $c->number);

        $m->union_a = $b;
        $this->assertSame(null, $m->union_a->number);
        $m->union_a = $c;
        $this->assertFalse($m->union_a->state);
        $this->assertSame(null, $m->union_a->number);
    }

    public function testHandleOptionalInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame(3000, $m->optional);

        $this->expectOutput(<<<OUTPUT
        3000
        null
        -4000

        OUTPUT);
        $m->print();
        $m->optional = null;
        $m->print();
        $m->optional = -4000;
        $m->print();
    }

    public function testHandleOptionalInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame(3000, $m->error_union);

        $this->expectOutput(<<<OUTPUT
        3000
        error.GoldfishDied
        error.NoMoney
        -4000

        OUTPUT);
        $m->print();
        $m->error_union = $m->Error->GoldfishDied;
        $m->print();
        $m->error_union = new Exception('no money');
        $m->print();
        $m->error_union = -4000;
        $m->print();       
    }

    public function testFailWithOptionalInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }

    public function testConstructOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $a = new $m->Optional(1234);
        $b = new $m->Optional(null);
        $this->assertSame(1234, $a->__value);
        $this->assertSame(null, $b->__value);
        $c = $m->Optional(new ArrayBuffer(pack("Lcccc", 777, 1, 0, 0, 0)));
        $this->assertEquals(777, $c->__value);
        $this->assertSame(1, $a <=> $b);
        $clone = clone $b;
        $this->assertEquals($b, $clone);
    }
}

