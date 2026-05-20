<?php declare(strict_types=1);

final class OpaqueHandlingTest extends ZigarTestCase
{   
    public function testImportOpaqueAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(4, strlen($m->int_ptr->__bytes));
        $this->assertSame(0, strlen($m->orange_ptr->__bytes));
        $result = $m->compare($m->int_ptr, $m->orange_ptr);
        $this->assertTrue($result);
    }

    public function testPrintOpaqueArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        Value = 1234

        OUTPUT);
        $m->print($m->orange_ptr);
    }

    public function testReturnOpaquePointer(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $s = $m->create(123, 456);
        $this->expectOutputString(<<<OUTPUT
        .{ .number1 = 123, .number2 = 456 }

        OUTPUT);
        $m->print($s);
    }

    public function testHandleOpaqueInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame(4, count($m->array));
        for ($i = 0; $i < 4; $i++) {
            $this->assertTrue($m->array[$i] instanceof $m->Opaque);
        }

        $this->expectOutputString(<<<OUTPUT
        { 123, 345, 567, 789 }
        { 123, 345, 5555, 789 }

        OUTPUT);
        $m->print();
        $m->array[2] = $m->alt_ptr;
        $m->print();
    }

    public function testHandleOpaqueInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertTrue($m->struct_a->ptr1 instanceof $m->Opaque);
        $this->assertTrue($m->struct_a->ptr2 instanceof $m->Opaque);

        $b = new $m->StructA();
        $this->assertTrue($b->ptr1 instanceof $m->Opaque);
        $this->assertTrue($b->ptr2 instanceof $m->Opaque);

        $this->expectOutputString(<<<OUTPUT
        8888 9999
        1234 4567

        OUTPUT);
        $m->print();
        $m->struct_a = $b;
        $m->print();
    }

    public function testFailWithOpaqueInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandleOpaqueAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertTrue($m->struct_a->ptr instanceof $m->Opaque);

        $b = new $m->StructA(number: 500);
        $this->assertTrue($b->ptr instanceof $m->Opaque);

        $this->expectOutputString(<<<OUTPUT
        .{ .number = 500, .ptr = as-comptime-field.Opaque@

        OUTPUT);
        $m->print();
    }

    public function testHandleOpaqueInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        // $this->assertExceptionMessage('untagged union', function() use ($m) {
        //     $x = $m->union_a->ptr;
        // });
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'ptr' is active", function() use($m) {
                $x = $m->union_a->number;
            });
        }

        $b = new $m->UnionA(number: 123);
        $this->assertSame(123, $b->number);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m) {
                $x = $b->ptr;
            });
        } else {
            $this->assertExceptionMessage("untagged union", function() use($m) {
                $x = $b->ptr;
            });
        }

        $m->union_a = $b;
        $this->assertSame(123, $m->union_a->number);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m) {
                $x = $m->union_a->ptr;
            });
        } else {
            $this->assertExceptionMessage("untagged union", function() use($m) {
                $x = $m->union_a->ptr;
            });
        }
    }

    public function testHandleOpaqueInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertTrue($m->union_a->ptr instanceof $m->Opaque);
        $tag = $m->TagType($m->union_a);
        $this->assertSame('ptr', (string) $tag);
        $this->assertSame(null, $m->union_a->number);

        $b = new $m->UnionA(ptr: $m->alt_ptr);
        $c = new $m->UnionA(number: 123);
        $this->assertTrue($b->ptr instanceof $m->Opaque);
        $this->assertSame(123, $c->number);
        $this->assertSame(null, $c->ptr);

        $m->union_a = $b;
        $this->assertTrue($m->union_a->ptr instanceof $m->Opaque);
        $this->assertExceptionMessage("access of union field 'number' while field 'ptr' is active", function() use($m) {
            $m->union_a->number = 456;
        });
        $m->union_a = $c;
        $this->assertSame(null, $m->union_a->ptr);
    }

    public function testHandleOpaqueInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertTrue($m->optional instanceof $m->Opaque);

        $this->expectOutputString(<<<OUTPUT
        1234
        null
        4567

        OUTPUT);
        $m->print();
        $m->optional = null;
        $m->print();
        $m->optional = $m->alt_ptr;
        $m->print();

        $this->assertTrue($m->optional instanceof $m->Opaque);
    }

    public function testHandleOpaqueInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertTrue($m->error_union instanceof $m->Opaque);

        $this->expectOutputString(<<<OUTPUT
        1234
        error.GoldfishDied
        4567

        OUTPUT);
        $m->print();
        $m->error_union = $m->Error->GoldfishDied;
        $m->print();
        $m->error_union = $m->alt_ptr;
        $m->print();

        $this->assertTrue($m->error_union instanceof $m->Opaque);
    }

    public function testHandleOpaqueInVector(): void
    {
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        $this->expectOutputString(<<<OUTPUT
        { 1234, 1234, 1234, 1234 }
        { 1234, 1234, 1234, 1234 }
        { 2456, 2456, 2456, 2456 }

        OUTPUT);
        $m->print($m->vector_const);
        $m->print($m->vector);
        $m->change(2);
        $m->print($m->vector);
    }

    public function testConstructOpaque(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $this->assertTrue(is_callable($m->Opaque));
        $this->assertExceptionMessage("something", function() {
            $x = new $m->Opaque(null);
        });
    }
}

