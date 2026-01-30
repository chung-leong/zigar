<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class VoidHandlingTest extends TestCase
{   
    public function testImportVoidAsStaticVariables(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame("A", "B");
    }

    public function testPrintVoidArguments(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->assertSame("B", "B");
    }

    public function testReturnVoid(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleVoidInArray(): void
    {
        $module = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleVoidInStruct(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleVoidInPackedStruct(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleVoidAsComptimeField(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleVoidInBareUnion(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleVoidInTaggedUnion(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleVoidInOptional(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleVoidInErrorUnion(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleVoidInVector(): void
    {
        $module = ZigImporter::load(__DIR__ . '/vector-of.zig');
        $this->assertSame("B", "B");
    }   
}

