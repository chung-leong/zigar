<?php declare(strict_types=1);

final class NullHandlingTest extends ZigarTestCase
{   
    public function testImportNullAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(null, $m->weird);
    }

    public function testIgnoreFunctionAcceptingNull(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->assertFalse(isset($m->print));
        $this->assertFalse(is_callable([ $m, 'print' ]));
    }

    public function testIgnoreFunctionReturningNull(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertFalse(isset($m->getNull));
        $this->assertFalse(is_callable([ $m, 'getNull' ]));
    }

    public function testHandleNullInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame([ null, null, null, null ], (array) $m->array);
    }

    public function testHandleNullInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame([ 'empty1' => null, 'empty2' => null, 'hello' => 1234 ], (array) $m->struct_a);

        $this->assertExceptionMessage("not null", function() use($m) {
            $x = new $m->StructA(empty1: false);
        });

        $b = new $m->StructA(hello: 234);
        $this->assertSame([ 'empty1' => null, 'empty2' => null, 'hello' => 234 ], (array) $b);

        $this->expectOutputString(<<<OUTPUT
        .{ .empty1 = null, .empty2 = null, .hello = 1234 }

        OUTPUT);
        $m->print();
    }

    public function testFailWithNullInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandleNullAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame(null, $m->struct_a->empty);
        $b = new $m->StructA(number: 500);
        $this->assertSame(null, $b->empty);
    }

    public function testFailWithNullInBareUnion(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        });
    }

    public function testHandleNullInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame(null, $m->union_a->empty);
        $tag = $m->TagType($m->union_a);
        $this->assertSame($m->TagType->empty, $tag);
        $this->assertSame(null, $m->union_a->number);

        $b = new $m->UnionA(number: 777);
        $this->assertSame([ 'number' => 777 ], (array) $b);

        $this->assertExceptionMessage("not null", function() use($m) {
            $x = new $m->UnionA(empty: false);
        });
    }

    public function testFailWithNullInOptional(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        });
    }

    public function testHandleNullInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame(null, $m->error_union1);
        
        $this->expectOutputString(<<<OUTPUT
        null

        OUTPUT);
        $m->print();

        $this->assertExceptionMessage("goldfish died", function() use($m) {
            $x = $m->error_union2;
        });
    }

    public function testFailWithNullInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }

    public function testConstructNull(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $this->assertTrue(isset($m->Null));
        $this->assertExceptionMessage("cannot create comptime object", function() use($m) {
            $x = new $m->Null();
        });
    }
}

