<?php declare(strict_types=1);

final class ErrorUnionHandlingTest extends ZigarTestCase
{   
    public function testImportErrorUnionAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(123, $m->positive_outcome);
        $this->assertExceptionMessage('condom broke you pregnant', function() use($m) {
            $x = $m->negative_outcome;
        });

        $m->positive_outcome = 456;
        $this->assertSame(456, $m->positive_outcome);
        $m->negative_outcome = $m->Error->DogAteAllMemory;
        $this->assertExceptionMessage('dog ate all memory', function() use($m) {
            $x = $m->negative_outcome;
        });

        $this->assertExceptionMessage('dog ate all memory', function() use($m) {
            $m->encounterBadLuck(true);
        });
        $this->assertSame(456, $m->encounterBadLuck(false));

        $this->assertExceptionMessage('alien invasion', function() use($m) {
            $x = $m->bool_error;
        });
        $this->assertExceptionMessage('system is on fire', function() use($m) {
            $x = $m->i8_error;
        });
        $this->assertExceptionMessage('no more beer', function() use($m) {
            $x = $m->u16_error;
        });
        $this->assertExceptionMessage('dog ate all memory', function() use($m) {
            $x = $m->void_error;
        });

        $m->void_error = null;
        $this->assertSame(null, $m->void_error);
    }

    public function testPrintErrorUnionArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        221
        error.NoMoney

        OUTPUT);
        $m->print(221);
        $m->print(new Exception('no money'));
    }

    public function testReturnErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame(1234, $m->getSomething());

        $this->assertExceptionMessage('goldfish died', function() use($m) {
            $m->getFailure();
        });
    }

    public function testHandleErrorUnionInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
    }

    public function testHandleErrorUnionInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
    }

    public function testHandleErrorUnionInPackedStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
    }

    public function testHandleErrorUnionAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
    }

    public function testHandleErrorUnionInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
    }

    public function testHandleErrorUnionInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
    }

    public function testHandleErrorUnionInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
    }

    public function testHandleErrorUnionInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
    }

    public function testHandleErrorUnionInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }
}

