<?php declare(strict_types=1);

final class FunctionHandlingTest extends ZigarTestCase
{   
    public function testImportFunctionAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertTrue(is_callable($m->func));

        $this->expectOutputString(<<<OUTPUT
        hello
        world
        Hello world

        OUTPUT);

        $m->func();
        $m->func = $m->world;
        $m->func();

        $this->assertTrue(is_callable($m->hello));
        $this->assertTrue(is_callable($m->hello2));
        $this->assertTrue(is_callable($m->hello3));
        $this->assertTrue(is_callable($m->{" \nthis is a totally weird function name!! :-)"}));
        $m->{" \nthis is a totally weird function name!! :-)"}();
    }

    public function testIgnoreFunctionAcceptingFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
    }

    public function testIgnoreFunctionReturningFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
    }

    public function testHandleFunctionInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
    }

    public function testHandleFunctionInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
    }

    public function testFailWithFunctionInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandleFunctionAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
    }

    public function testFailWithFunctionInBareUnion(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        });
    }

    public function testHandleFunctionInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
    }

    public function testHandleFunctionInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
    }

    public function testHandleFunctionInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
    }

    public function testFailWithFunctionInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }

    public function testConstructFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $this->assertFalse(isset($m->Function));
    }
}

