<?php declare(strict_types=1);

final class OpaqueHandlingTest extends ZigarTestCase
{   
    public function testImportOpaqueAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
    }

    public function testIgnoreFunctionAcceptingOpaque(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
    }

    public function testIgnoreFunctionReturningOpaque(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
    }

    public function testHandleOpaqueInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
    }

    public function testHandleOpaqueInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
    }

    public function testHandleOpaqueInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandleOpaqueAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
    }

    public function testHandleOpaqueInBareUnion(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        });
    }

    public function testHandleOpaqueInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
    }

    public function testHandleOpaqueInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
    }

    public function testHandleOpaqueInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
    }

    public function testHandleOpaqueInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }

    public function testConstructOpaque(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $this->assertSame(false, isset($m->Opaque));
    }
}

