<?php declare(strict_types=1);

final class UndefinedHandlingTest extends ZigarTestCase
{   
    public function testImportUndefinedAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(null, $m->weird);
        $this->assertSame(true, isset($m->weird));
    }

    public function testIgnoreFunctionWithUndefinedArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->assertSame(false, isset($m->print));
        $this->assertSame(false, is_callable([ $m, 'print' ]));
    }

    public function testIgnoreFunctionReturningUndefined(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame(false, isset($m->getUndefined));
        $this->assertSame(false, is_callable([ $m, 'getUndefined' ]));
    }

    public function testHandleUndefinedInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        // $this->assertSame(4, count($m->array));
        $this->assertSame([ null, null, null, null ], (array) $m->array);
    }

    public function testHandleUndefinedInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');        
        $this->assertExceptionMessage("not null", function() use ($m) {
            $x = new $m->StructA(empty1: false);
        });
        $b = new $m->StructA();
        $this->assertSame([ 'empty1' => null, 'empty2' => null ], (array) $b);
    }

    public function testFailWithUndefinedInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandleUndefinedAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame(null, $m->struct_a->empty);

        $b = new $m->StructA(number: 500);
        $this->assertSame(500, $b->number);
        $this->assertSame(null, $b->empty);
    }

    public function testFailWithUndefinedInBareUnion(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        });
    }

    public function testHandleUndefinedInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame(null, $m->union_a->empty);
        $tag = $m->TagType($m->union_a);
        $this->assertSame($m->TagType->empty, $tag);
        $this->assertSame(null, $m->union_a->number);
        $this->assertExceptionMessage('not null', function() use($m) {
            $x = new $m->UnionA(empty: false);
        });
        $b = new $m->UnionA(number: 123);
        $this->assertSame([ 'number' => 123 ], (array) $b);
    }

    public function testFailWithUndefinedInOptional(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        });
    }

    public function testFailWithUndefinedInErrorUnion(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        });
    }

    public function testFailWithUndefinedInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }
}

