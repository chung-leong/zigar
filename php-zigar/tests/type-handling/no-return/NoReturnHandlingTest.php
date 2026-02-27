<?php declare(strict_types=1);

final class NoReturnHandlingTest extends ZigarTestCase
{   
    public function testImportNoReturnAsStaticVariables(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        });
    }

    public function testPrintNoReturnArguments(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        });
    }

    public function testReturnNoReturn(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame("object", gettype($m->exit));
        $this->assertSame(true, isset($m->exit));
    }

    public function testHandleNoReturnInArray(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        });
    }

    public function testHandleNoReturnInStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        });
    }

    public function testHandleNoReturnInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandleNoReturnAsComptimeField(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        });
    }

    public function testHandleNoReturnInBareUnion(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        });
    }

    public function testHandleNoReturnInTaggedUnion(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        });
    }

    public function testHandleNoReturnInOptional(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        });
    }

    public function testHandleNoReturnInErrorUnion(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        });
    }

    public function testHandleNoReturnInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }
}

