<?php declare(strict_types=1);

final class EnumLiteralHandlingTest extends ZigarTestCase
{   
    public function testImportEnumLiteralAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame('hello', $m->hello);
        $this->assertSame([
            'Asgard',
            'Midgard',
            'Jotunheim',
            'Svartalfheim',
            'Vanaheim',
            'Muspelheim',
            'Niflheim',
            'Alfheim',
            'Nidavellir',
        ], (array) $m->world);
    }

    public function testIgnoreFunctionAcceptingEnumLiteral(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->assertExceptionMessage('Call to undefined method', function() use($m) {
            $m->print();
        });
    }

    public function testReturnEnumLiteral(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertExceptionMessage('Call to undefined method', function() use($m) {
            $m->getLiteral();
        });
    }

    public function testHandleEnumLiteralInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame([ 'hello', 'world', 'dog', 'cat' ], (array) $m->array);
    }

    public function testHandleEnumLiteralInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame([ 'literal1' => 'hello', 'literal2' => 'world' ], (array) $m->struct_a);

        $this->expectOutputString(<<<OUTPUT
        .{ .literal1 = .hello, .literal2 = .world }

        OUTPUT);
        $m->print();
    }

    public function testFailToCompileCodeWithEnumLiteralInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandleEnumLiteralAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame('hello', $m->struct_a->literal);
        
        $this->expectOutputString(<<<OUTPUT
        .{ .number = 123, .literal = .hello }
        .{ .number = 55, .literal = .hello }

        OUTPUT);
        $m->print();
        $m->struct_a->number = 55;
        $m->print();
    }

    public function testHandleEnumLiteralInBareUnion(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        });
    }

    public function testHandleEnumLiteralInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame('hello', $m->union_a->literal);
        $tag = $m->TagType($m->union_a);
        $this->assertSame($m->TagType->literal, $tag);
        $this->assertSame(null, $m->union_a->number);
    }

    public function testHandleEnumLiteralInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame('hello', $m->optional);

        $this->expectOutputString(<<<OUTPUT
        .hello

        OUTPUT);
        $m->print();
    }

    public function testHandleEnumLiteralInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame('hello', $m->error_union);

        $this->expectOutputString(<<<OUTPUT
        .hello

        OUTPUT);
        $m->print();
    }

    public function testFailToCompileCodeContaingEnumLiteralInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }
}

