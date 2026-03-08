<?php declare(strict_types=1);

final class ArrayHandlingTest extends ZigarTestCase
{   
    public function testImportArrayAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame([ 1, 2, 3, 4 ], (array) $m->int32_array4);
        $this->assertSame([ 1.1, 1.2, 1.3, 1.4 ], (array) $m->float64_array4x4[0]);
        $this->assertSame([ 2.1, 2.2, 2.3, 2.4 ], (array) $m->float64_array4x4[1]);
        $this->assertSame([ 3.1, 3.2, 3.3, 3.4 ], (array) $m->float64_array4x4[2]);
        $this->assertSame([ 4.1, 4.2, 4.3, 4.4 ], (array) $m->float64_array4x4[3]);
        for ($i = 0; $i < count($m->int32_array4); $i++) {
            $m->int32_array4[$i] *= 4;
        }

        $this->expectOutputString(<<<OUTPUT
        { 4, 8, 12, 16 }

        OUTPUT);
        $m->print();

        $this->assertSame('Hello', $m->string);
        // TODO: plain array, complex array, and typed array
    }

    public function testPrintArrayArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        { 1.1, 2.2, 3.3, 4.4 }

        OUTPUT);
        $m->print([ 1.1, 2.2, 3.3, 4.4 ]);
    }

    public function testReturnArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $result = $m->getArray();
        $this->assertSame([ 1, 2, 3, 4 ], (array) $result);

        // TODO: missing stringify
        $string = $m->getString();
        $this->assertSame('Hello', $string);
    }

    public function testHandleArrayInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame(2, count($m->array));
        $this->assertSame([ 1, 2, 3, 4 ], (array) $m->array[0]);
        $this->assertSame([ 2, 3, 4, 5 ], (array) $m->array[1]);

        $this->expectOutputString(<<<OUTPUT
        { { 1, 2, 3, 4 }, { 2, 3, 4, 5 } }

        OUTPUT);
        $m->print();
    }

    public function testHandleArrayInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame([ 10, 20, 30, 40 ], (array) $m->struct_a->array1);
        $this->assertSame([ 11, 21, 31, 41 ], (array) $m->struct_a->array2);
        $b = new $m->StructA();
        $this->assertSame([ 1, 2, 3, 4 ], (array) $b->array1);
        $this->assertSame([ 5, 6, 7, 8 ], (array) $b->array2);

        $this->expectOutputString(<<<OUTPUT
        .{ .array1 = { 10, 20, 30, 40 }, .array2 = { 11, 21, 31, 41 } }
        .{ .array1 = { 1, 2, 3, 4 }, .array2 = { 5, 6, 7, 8 } }

        OUTPUT);
        $m->print();
        $m->struct_a = $b;
        $m->print();

        $this->assertSame('Hello', $m->struct_b->foo);
        $this->assertSame([ 72, 101, 108, 108, 111 ], (array) $m->struct_b->bar);
    }

    public function testHandleArrayInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandleArrayAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame([ 1, 2, 3, 4 ], (array) $m->struct_a->array);
        $b = new $m->StructA(number: 500);
        $this->assertSame([ 1, 2, 3, 4 ], (array) $b->array);
        $this->assertSame(500, $b->number);

        $this->expectOutputString(<<<OUTPUT
        .{ .number = 500, .array = { 1, 2, 3, 4 } }

        OUTPUT);
        $m->print($b);
    }

    public function testHandleArrayInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame([ 1, 2, 3, 4 ], (array) $m->union_a->array);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'array' is active", function() use($m) {
                $x = $m->union_a->number;
            });
        }

        $b = new $m->UnionA(array: [ 5, 6, 7, 8 ]);
        $c = new $m->UnionA(number: 123);
        $this->assertSame([ 5, 6, 7, 8 ], (array) $b->array);
        $this->assertSame(123, $c->number);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m, $c) {
                $x = $c->array;
            });
        }

        $m->union_a = $b;
        $this->assertSame([ 5, 6, 7, 8 ], (array) $m->union_a->array);
        $m->union_a = $c;
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m) {
                $x = $m->union_a->array;
            });
        }        
    }

    public function testHandleArrayInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame([ 1, 2, 3, 4 ], (array) $m->union_a->array);
        $tag = $m->TagType($m->union_a);
        $this->assertSame($m->TagType->array, $tag);
        $this->assertSame(null, $m->union_a->number);

        $b = new $m->UnionA(array: [ 5, 6, 7, 8 ]);
        $c = new $m->UnionA(number: 123);
        $this->assertSame([ 5, 6, 7, 8 ], (array) $b->array);
        $this->assertSame(123, $c->number);
        $this->assertSame(null, $c->array);

        $m->union_a = $b;
        $this->assertSame([ 5, 6, 7, 8 ], (array) $m->union_a->array);
        $m->union_a = $c;
        $this->assertSame(null, $m->union_a->array);
    }

    public function testHandleArrayInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame([ 1, 2, 3, 4 ], (array) $m->optional);

        $this->expectOutputString(<<<OUTPUT
        { 1, 2, 3, 4 }
        null
        { 5, 6, 7, 8 }

        OUTPUT);
        $m->print();
        $m->optional = null;
        $m->print();
        $m->optional = [ 5, 6, 7, 8 ];
        $m->print();
    }

    public function testHandleArrayInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame([ 1, 2, 3, 4 ], (array) $m->error_union);
        $this->expectOutputString(<<<OUTPUT
        { 1, 2, 3, 4 }
        error.GoldfishDied
        { 5, 6, 7, 8 }

        OUTPUT);
        $m->print();
        $m->error_union = new Exception('goldfish died');
        $m->print();
        // TODO: the following is not quite working
        // $this->assertExceptionMessage('goldfish died', function() use($m) {
        //     $x = $m->error_union;
        // });
        $m->error_union = [ 5, 6, 7, 8 ];
        $m->print();
    }

    public function testHandleArrayInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }
}

