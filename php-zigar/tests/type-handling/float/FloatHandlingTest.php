<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class FloatHandlingTest extends TestCase
{   
    public function testImportFloatAsStaticVariables(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame("A", "B");
    }

    public function testPrintFloatArguments(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->assertSame("B", "B");
    }

    public function testReturnFloat(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleFloatInArray(): void
    {
        $module = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleFloatInStruct(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleFloatInPackedStruct(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleFloatAsComptimeField(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleFloatInBareUnion(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleFloatInTaggedUnion(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleFloatInOptional(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleFloatInErrorUnion(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleFloatInVector(): void
    {
        $module = ZigImporter::load(__DIR__ . '/vector-of.zig');
        $this->assertSame("B", "B");
    }   
}

