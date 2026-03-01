<?php declare(strict_types=1);

final class FloatHandlingTest extends ZigarTestCase
{   
    public function testImportFloatAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(-44.4, round($m->float16_const, 1));
        $this->assertSame(0.44, round($m->float16, 2));
        $this->assertSame(0.1234, round($m->float32_const, 4));
        $this->assertSame(34567.56, round($m->float32, 2));
        $this->assertSame(M_PI, $m->float64);
        $this->assertSame(M_PI, $m->float80);
        $this->assertSame(M_PI, $m->float128);

        $this->expectOutputString(<<<OUTPUT
        3.141592653589793
        1.234

        OUTPUT);
        $m->print();
        $m->float64 = 1.234;
        $m->print();

        $this->assertExceptionMessage("write protected (zig)", function() use($m) {
            $m->float16_const = 1.23;
        });
    }

    public function testPrintFloatArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        3.14 3.1415927
        3.141592653589793 3.141592653589793116 3.141592653589793115997963468544185

        OUTPUT);
        $m->print1(M_PI, M_PI);
        $m->print2(M_PI, M_PI, M_PI);
    }

    public function testReturnFloat(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame(-44.40625, $m->getFloat16());
        $this->assertSame(0.1234000027179718, $m->getFloat32());
        $this->assertSame(M_PI, $m->getFloat64());
        $this->assertSame(M_PI, $m->getFloat80());
        $this->assertSame(M_PI, $m->getFloat128());
    }

    public function testHandleFloatInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame([ 1.25, 2.25, 3.25, 4.25 ], (array) $m->array1);
        $this->assertSame([ 1.1, 2.1, 3.1, 4.1 ], (array) $m->array2);
        $this->assertSame([ 1.1, 2.1, 3.1, 4.1 ], (array) $m->array3);

        $this->expectOutputString(<<<OUTPUT
        { 1.25, 2.25, 3.25, 4.25 }
        { 3.5, 3.5, 3.5, 3.5 }

        OUTPUT);
        $m->print1();
        $m->array1 = [ 3.5, 3.5, 3.5, 3.5 ];
        $m->print1();
    }

    public function testHandleFloatInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame([ 'number1' => -0.5, 'number2' => -4.44 ], (array) $m->struct_a);
        $b = new $m->StructA();
        $this->assertSame([ 'number1' => 123.0, 'number2' => 0.456 ], (array) $b);

        $this->expectOutputString(<<<OUTPUT
        .{ .number1 = -0.5, .number2 = -4.44 }
        .{ .number1 = 123, .number2 = 0.456 }

        OUTPUT);
        $m->print();
        $m->struct_a = $b;
        $m->print();
    }

    public function testHandleFloatInPackedStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        $this->assertSame([ 
            'state' => true, 
            'number1' => 1.5, 
            'number2' => 7.77, 
            'number3' => -4.25 
        ], (array) $m->struct_a);
        $b = new $m->StructA();
        $this->assertSame([ 
            'state' => false, 
            'number1' => 1.0, 
            'number2' => 2.0, 
            'number3' => 3.0, 
        ], (array) $b);

        $this->expectOutputString(<<<OUTPUT
        .{ .state = true, .number1 = 1.5, .number2 = 7.77, .number3 = -4.25 }
        .{ .state = false, .number1 = 1, .number2 = 2, .number3 = 3 }

        OUTPUT);
        $m->print();
        $m->struct_a = $b;
        $m->print();
    }

    public function testHandleFloatAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame(5.55, $m->struct_a->number);
        $b = new $m->StructA(state: true);
        $this->assertSame(5.55, $b->number);

        $this->expectOutputString(<<<OUTPUT
        .{ .state = true, .number = 5.55 }

        OUTPUT);
        $m->print($b);
    }

    public function testHandleFloatInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame(1.234, $m->union_a->number);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m) {
                $x = $m->union_a->state;
            });
        }

        $b = new $m->UnionA(number: 4.567);
        $c = new $m->UnionA(state: false);
        $this->assertSame(4.567, $b->number);
        $this->assertSame(false, $b->state);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'state' is active", function() use($c) {
                $x = $c->number;
            });
        }
        $m->union_a = $b;
        $this->assertSame(4.567, $m->union_a->number);
        $m->union_a = $c;
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'state' is active", function() use($m) {
                $x = $m->union_a->number;
            });
        }
    }

    public function testHandleFloatInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame(3.456, $m->union_a->number);
        $tag = $m->TagType($m->union_a);
        $this->assertSame($m->TagType->number, $tag);
        $this->assertSame(null, $m->union_a->state);

        $b = new $m->UnionA(number: 1.23);
        $c = new $m->UnionA(state: false);
        $this->assertSame(1.23, $b->number);
        $this->assertSame(false, $c->state);
        $this->assertSame(null, $c->number);

        $m->union_a = $b;
        $this->assertSame(1.23, $m->union_a->number);
        $m->union_a = $c;
        $this->assertSame(false, $m->union_a->state);
        $this->assertSame(null, $m->union_a->number);
    }

    public function testHandleFloatInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame(3.14, $m->optional);

        $this->expectOutputString(<<<OUTPUT
        3.14
        null
        8.12

        OUTPUT);
        $m->print();
        $m->optional = null;
        $m->print();
        $m->optional = 8.12;
        $m->print();
    }

    public function testHandleFloatInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame(3.14, $m->error_union);

        $this->expectOutputString(<<<OUTPUT
        3.14
        error.GoldfishDied
        error.NoMoney
        8.12

        OUTPUT);
        $m->print();
        $m->error_union = $m->Error->GoldfishDied;
        $m->print();
        $m->error_union = new Exception('no money');
        $m->print();
        $m->error_union = 8.12;  
        $m->print();

        $this->assertExceptionMessage("'pig is flying'", function() use($m) {
            $m->error_union = new Exception('pig is flying');
        });
    }

    public function testHandleFloatInVector(): void
    {
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        $this->assertSame([ 1.5, 2.5, 3.5, 4.5 ], (array) $m->vector1);
        $this->assertSame([ 1.5, 2.5, 3.5, 4.5 ], (array) $m->vector2);
        $this->assertSame([ 1.5, 2.5, 3.5, 4.5 ], (array) $m->vector3);

        $this->expectOutputString(<<<OUTPUT
        { 1.5, 2.5, 3.5, 4.5 }
        { 3.5, 4.5, 5.5, 6.5 }

        OUTPUT);
        $m->print1();
        $m->vector1 = [ 3.5, 4.5, 5.5, 6.5 ];
        $m->print1();        
    }

    public function testConstructFloat(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $a = new $m->Double(3.14);
        $this->assertSame(3.14, (double) $a);
        $b = $m->Double(pack('d', 0.1234));
        $this->assertSame(0.1234, (double) $b);
    }
}

