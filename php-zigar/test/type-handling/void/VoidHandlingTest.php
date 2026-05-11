<?php declare(strict_types=1);

final class VoidHandlingTest extends ZigarTestCase
{   
    public function testImportVoidAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(null, $m->empty);
        $this->assertSame(null, $m->empty_writable);

        $m->empty_writable = null;

        $this->assertExceptionMessage("write protected (zig)", function() use($m) {
            $m->empty = null;
        });
    }

    public function testPrintVoidArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $m->print(null);
        $this->expectOutputString(<<<OUTPUT
        void

        OUTPUT);

        $this->assertExceptionMessage("not null (zig)", function() use($m) {
            $m->print(123);
        });
    }

    public function testReturnVoid(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame(null, $m->getVoid());
    }

    public function testHandleVoidInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame(null, $m->array[1]);
        $this->assertSame([ null, null, null, null ], (array) $m->array);
        $this->assertSame(null, $m->array_writable[3]);
        $m->array_writable[3] = null;

        $this->expectOutputString(<<<OUTPUT
        { void, void, void, void }

        OUTPUT);
        $m->print();

        $this->assertExceptionMessage("write protected (zig)", function() use($m) {
            $m->array[2] = null;
        });

        $this->assertExceptionMessage("out of bound (zig)", function() use($m) {
            $m->array_writable[4] = null;
        });
    }

    public function testHandleVoidInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame([ 'empty1' => null, 'empty2' => null ], (array) $m->struct_a);
        $b = new $m->StructA();
        $this->assertSame([ 'empty1' => null, 'empty2' => null ], (array) $b);

        $this->expectOutputString(<<<OUTPUT
        .{ .empty1 = void, .empty2 = void }
        .{ .empty1 = void, .empty2 = void }

        OUTPUT);
        $m->print();
        $m->struct_a = $b;
        $m->print();
    }

    public function testHandleVoidInPackedStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        $this->assertSame([
            'empty1' => null,
            'empty2' => null, 
            'number' => 200,
            'empty3' => null, 
        ], (array) $m->struct_a);
        $b = new $m->StructA();
        $this->assertSame([
            'empty1' => null,
            'empty2' => null, 
            'number' => 100,
            'empty3' => null, 
        ], (array) $b);

        $this->expectOutputString(<<<OUTPUT
        .{ .empty1 = void, .empty2 = void, .number = 200, .empty3 = void }
        .{ .empty1 = void, .empty2 = void, .number = 100, .empty3 = void }

        OUTPUT);
        $m->print();
        $m->struct_a = $b;
        $m->print();
    }

    public function testHandleVoidAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame(null, $m->struct_a->empty);
        $b = new $m->StructA(number: 500);
        $this->assertSame(null, $b->empty);

        $this->expectOutputString(<<<OUTPUT
        .{ .number = 500, .empty = void }

        OUTPUT);
        $m->print($b);
    }

    public function testHandleVoidInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame(null, $m->union_a->empty);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'empty' is active", function() use($m) {
                $x = $m->union_a->number;
            });
        }

        $b = new $m->UnionA(empty: null);
        $c = new $m->UnionA(number: 123);
        $this->assertSame(null, $b->empty);
        $this->assertSame(123, $c->number);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($c) {
                $x = $c->empty;
            });
        }

        $m->union_a = $b;
        $this->assertSame(null, $m->union_a->empty);
        $m->union_a = $c;
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m) {
                $x = $m->union_a->empty;
            });
        }
    }

    public function testHandleVoidInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame(null, $m->union_a->empty);
        $tag = $m->TagType($m->union_a);
        $this->assertSame($m->TagType->empty, $tag);
        $this->assertSame(null, $m->union_a->number);
        $b = new $m->UnionA(empty: null);
        $c = new $m->UnionA(number: 123);
        $this->assertSame(null, $b->empty);
        $this->assertSame(123, $c->number);
        $m->union_a = $b;
        $this->assertSame(null, $m->union_a->empty);
        $m->union_a = $c;
        $this->assertSame(null, $m->union_a->empty);
        $this->assertSame(123, $m->union_a->number);
    }

    public function testHandleVoidInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame(null, $m->optional);

        $this->expectOutputString(<<<OUTPUT
        void
        null

        OUTPUT);
        $m->print();
        $m->optional = null;
        $m->print();

        $this->assertExceptionMessage("not null (zig)", function() use($m) {
            $m->optional = 123;
        });
    }

    public function testHandleVoidInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame(null, $m->error_union);

        $this->expectOutputString(<<<OUTPUT
        void
        error.GoldfishDied
        error.NoMoney
        void

        OUTPUT);
        $m->print();
        $m->error_union = $m->Error->GoldfishDied;
        $m->print();
        $m->error_union = new Exception('no money');
        $m->print();
        $m->error_union = null;  
        $m->print();

        $this->assertExceptionMessage("'pig is flying'", function() use($m) {
            $m->error_union = new Exception('pig is flying');
        });
    }

    public function testFailWithVoidInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }

    public function testConstructVoid(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $a = new $m->Void(null);
        $this->assertSame(false, (boolean) $a);
        $b = $m->Void(new ArrayBuffer(0));
        $this->assertEquals($a, $b);
    }
}

