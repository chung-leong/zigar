<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class NoReturnHandlingTest extends TestCase
{   
    public function testImportNoReturnAsStaticVariables(): void
    {
        $this->expectExceptionMessage("unable to create module 'as-static-variables'");
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
    }

    public function testPrintNoReturnArguments(): void
    {
        $this->expectExceptionMessage("unable to create module 'as-function-parameters'");
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
    }

    public function testReturnNoReturn(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame("object", gettype($m->exit));
        $this->assertSame(true, isset($m->exit));
    }

    public function testHandleNoReturnInArray(): void
    {
        $this->expectExceptionMessage("unable to create module 'array-of'");
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
    }

    public function testHandleNoReturnInStruct(): void
    {
        $this->expectExceptionMessage("unable to create module 'in-struct'");
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
    }

    public function testHandleNoReturnInPackedStruct(): void
    {
        $this->expectExceptionMessage("unable to create module 'in-packed-struct'");
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
    }

    public function testHandleNoReturnAsComptimeField(): void
    {
        $this->expectExceptionMessage("unable to create module 'as-comptime-field'");
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
    }

    public function testHandleNoReturnInBareUnion(): void
    {
        $this->expectExceptionMessage("unable to create module 'in-bare-union'");
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
    }

    public function testHandleNoReturnInTaggedUnion(): void
    {
        $this->expectExceptionMessage("unable to create module 'in-tagged-union'");
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
    }

    public function testHandleNoReturnInOptional(): void
    {
        $this->expectExceptionMessage("unable to create module 'in-optional'");
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
    }

    public function testHandleNoReturnInErrorUnion(): void
    {
        $this->expectExceptionMessage("unable to create module 'in-error-union'");
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
    }

    public function testHandleNoReturnInVector(): void
    {
        $this->expectExceptionMessage("unable to create module 'vector-of'");
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
    }
}

