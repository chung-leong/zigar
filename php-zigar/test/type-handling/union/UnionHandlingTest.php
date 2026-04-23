<?php declare(strict_types=1);

final class UnionHandlingTest extends ZigarTestCase
{   
    public function testImportUnionAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame('apple', (string) $m->variant_a->string);
        $this->assertSame(null, $m->variant_a->integer);
        $this->assertSame(null, $m->variant_a->float);
        $this->assertSame(123, $m->variant_b->integer);
        $this->assertSame(3.14, $m->variant_c->float);

        $this->expectOutputString(<<<OUTPUT
        apple
        123
        3.14
        apple
        123
        3.14

        OUTPUT);
        $m->printVariant($m->variant_a);
        $m->printVariant($m->variant_b);
        $m->printVariant($m->variant_c);
        $m->printVariantPtr($m->variant_a);
        $m->printVariantPtr($m->variant_b);
        $m->printVariantPtr($m->variant_c);

        $this->assertSame(100, $m->extern_union->cat);
        $this->assertSame(100, $m->extern_union->dog);

        $this->assertSame(123, $m->bare_union->dog);
        $m->useCat();
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'cat' is active", function() use($m) {
                $x = $m->bare_union->dog;
            });
        } else {
            $this->assertSame(777, $m->bare_union->dog);
        }

        $m->useMonkey();
        $this->assertSame(777, $m->bare_union->monkey);
        $this->assertSame([ 'float' => 3.14 ], (array) $m->variant_c);
    }

    public function testPrintUnionArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        .{ .integer = 200 }
        .{ .float = 3.14 }
        .{ .string = { 72, 101, 108, 108, 111 } }

        OUTPUT);

        $m->print(integer: 200);
        $m->print(float: 3.14);
        $m->print(string: "Hello");
    }

    public function testReturnUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame(300, $m->getInteger()->integer);
        $this->assertSame(3.14, $m->getFloat()->float);
        $this->assertSame(null, $m->getFloat()->integer);
        $this->assertSame('Hello', (string) $m->getString()->string);
    }

    public function testHandleUnionInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame(4, count($m->array));
        $this->assertSame([ 'integer' => 123 ], (array) $m->array[0]);
        $this->assertSame([ 'float' => 1.23 ], (array) $m->array[1]);
        $this->assertSame('world', (string) $m->array[2]->string);
        $this->assertSame([ 'integer' => 777 ], (array) $m->array[3]);

        $this->expectOutputString(<<<OUTPUT
        { .{ .integer = 123 }, .{ .float = 1.23 }, .{ .string = { 119, 111, 114, 108, 100 } }, .{ .integer = 777 } }
        { .{ .float = 4.567 }, .{ .float = 1.23 }, .{ .string = { 119, 111, 114, 108, 100 } }, .{ .integer = 777 } }

        OUTPUT);
        $m->print();
        $m->array[0] = [ 'float' => 4.567 ];
        $m->print();
    }

    public function testHandleUnionInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame([ 'float' => 7.777 ], (array) $m->struct_a->variant1);
        $this->assertSame('Hello', (string) $m->struct_a->variant2->string);

        $b = new $m->StructA();
        $this->assertSame('world', (string) $b->variant1->string);
        $this->assertSame([ 'float' => 3.14 ], (array) $b->variant2);

        $this->expectOutputString(<<<OUTPUT
        .{ .variant1 = .{ .float = 7.777 }, .variant2 = .{ .string = { 72, 101, 108, 108, 111 } } }
        .{ .variant1 = .{ .string = { 119, 111, 114, 108, 100 } }, .variant2 = .{ .float = 3.14 } }

        OUTPUT);
        $m->print();
        $m->struct_a = $b;
        $m->print();
    }

    public function testFailWithUnionInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandleUnionAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame(123, $m->struct_a->number);
        $this->assertSame('world', (string) $m->struct_a->variant->string);

        $b = new $m->StructA(number: 500);
        $this->assertSame('world', (string) $b->variant->string);

        $this->expectOutputString(<<<OUTPUT
        .{ .number = 500, .variant = .{ .string = { 119, 111, 114, 108, 100 } } }

        OUTPUT);
        $m->print($b);
    }

    public function testHandleUnionInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'variant' is active", function() use($m) {
                $x = $m->union_a->number;
            });
        }
        $b = new $m->UnionA(variant: [ 'float' => 3.14 ]);
        $c = new $m->UnionA(number: 123);
        $this->assertSame([ 'float' => 3.14 ], (array) $b->variant);
        $this->assertSame(123, $c->number);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($c) {
                $x = $c->variant;
            });
        }

        $m->union_a = $b;
        $this->assertSame([ 'float' => 3.14 ], (array) $m->union_a->variant);
        $m->union_a = $c;
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($c) {
                $x = $c->variant;
            });
        }
    }

    public function testHandleUnionInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame('Hello', (string) $m->union_a->variant->string);
        $tag = $m->TagType($m->union_a);
        $this->assertSame($m->TagType->variant, $tag);
        $this->assertSame(null, $m->union_a->number);

        $b = new $m->UnionA(variant: [ 'float' => 3.14 ]);
        $c = new $m->UnionA(number: 123);
        $this->assertSame(null, $b->number);
        $this->assertSame(null, $c->variant);

        $m->union_a = $b;
        $this->assertSame([ 'float' => 3.14 ], (array) $m->union_a->variant);
        $m->union_a = $c;
        $this->assertSame(null, $m->union_a->variant);
    }

    public function testHandleUnionInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame(100, $m->optional->integer);

        $this->expectOutputString(<<<OUTPUT
        .{ .integer = 100 }
        null
        .{ .float = 3.14 }

        OUTPUT);
        $m->print();
        $m->optional = null;
        $m->print();
        $m->optional = [ 'float' => 3.14 ];
        $m->print();
        $this->assertSame(3.14, $m->optional->float);
        $this->assertSame(null, $m->optional->integer);
    }

    public function testHandleUnionInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame(100, $m->error_union->integer);

        $this->expectOutputString(<<<OUTPUT
        .{ .integer = 100 }
        error.GoldfishDied
        .{ .float = 3.14 }

        OUTPUT);
        $m->print();
        $m->error_union = new Exception('goldfish died');
        $m->print();
        $m->error_union = [ 'float' => 3.14 ];
        $m->print();
        $this->assertSame(3.14, $m->error_union->float);
        $this->assertSame(null, $m->error_union->integer);
    }

    public function testFailWithUnionInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }

    public function testConstructUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $b = new $m->TaggedUnion(number1: 123);
        $this->assertEquals((object) [ 'number1' => 123 ], $b->__plain);
        
        $c = new $m->ExternUnion(number1: -1234);
        $this->assertEquals((object) [ 'number1' => -1234, 'number2' => -1234 ], $c->__plain);
        $d = $m->ExternUnion(pack('l', 12345));
        $this->assertEquals((object) [ 'number1' => 12345, 'number2' => 12345 ], $d->__plain);
        $this->assertExceptionMessage("union can only have 1 active field", function() use($m) {
            $x = new $m->ExternUnion([ 'number1' => 123, 'number2' => 456 ]);
        });
        $this->assertExceptionMessage("no field named 'number3'", function() use($m) {
            $x = new $m->ExternUnion([ 'number3' => 123 ]);
        });
    }
}

