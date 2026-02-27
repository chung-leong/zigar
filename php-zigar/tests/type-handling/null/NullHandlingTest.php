<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class NullHandlingTest extends TestCase
{   
    public function testImportNullAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(null, $m->weird);
    }

    public function testIgnoreFunctionAcceptingNull(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectExceptionMessage("Call to undefined method");
        $m->print(null);
    }

    public function testIgnoreFunctionReturningNull(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->expectExceptionMessage("Call to undefined method");
        $m->getNull();
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

        $this->expectExceptionMessage("write protection");
        $x = new $m->StructA(empty1: null);

        $b = new $m->StructA(hello: 234);
        $this->assertSame([ 'empty1' => null, 'empty2' => null, 'hello' => 234 ], (array) $b);

        $this->expectOutputString(<<<OUTPUT
        .{ .empty1 = null, .empty2 = null, .hello = 1234 }

        OUTPUT);
        $m->print();
    }

    public function testHandleNullInPackedStruct(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
    }

    public function testHandleNullAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame(null, $m->struct_a->empty);
        $b = new $m->StructA(number: 500);
        $this->assertSame(null, $b->empty);
    }

    public function testHandleNullInBareUnion(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
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

        $this->expectExceptionMessage("write protection");
        $x = new $m->UnionA(empty: null);
    }

    public function testHandleNullInOptional(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
    }

    public function testHandleNullInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame(null, $m->error_union1);
        
        $this->expectOutputString(<<<OUTPUT
        null

        OUTPUT);
        $m->print();

        $this->expectExceptionMessage("goldfish died");
        $m->error_union2;
    }

    public function testHandleNullInVector(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
    }

    public function testConstructNull(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $this->assertSame(false, isset($m->Null));
    }
}

