<?php declare(strict_types=1);

final class TypeHandlingTest extends ZigarTestCase
{   
    public function testImportTypeAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(true, is_callable($m->Int32));
        // $this->assertSame(true, is_callable([ $m, 'Int32' ]));
    }

    public function testIgnoreFunctionAcceptingType(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
    }

    public function testIgnoreFunctionReturningType(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
    }

    public function testHandleTypeInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
    }

    public function testHandleTypeInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
    }

    public function testHandleTypeInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandleTypeAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
    }

    public function testHandleTypeInBareUnion(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        });
    }

    public function testHandleTypeInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
    }

    public function testHandleTypeInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
    }

    public function testHandleTypeInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
    }

    public function testHandleTypeInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }

    public function testConstructType(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $this->assertSame(false, isset($m->Type));
    }
}

