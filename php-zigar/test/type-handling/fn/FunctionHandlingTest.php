<?php declare(strict_types=1);

final class FunctionHandlingTest extends ZigarTestCase
{   
    public function testImportFunctionAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
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
        $this->assertSame(false, isset($m->Function));
    }
}

