<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class IntHandlingTest extends TestCase
{   
    public function testImportIntAsStaticVariables(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame("A", "B");
    }

    public function testPrintIntArguments(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->assertSame("B", "B");
    }

    public function testReturnInt(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleIntInArray(): void
    {
        $module = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleIntInStruct(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleIntInPackedStruct(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleIntAsComptimeField(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleIntInBareUnion(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleIntInTaggedUnion(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleIntInOptional(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleIntInErrorUnion(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleIntInVector(): void
    {
        $module = ZigImporter::load(__DIR__ . '/vector-of.zig');
        $this->assertSame("B", "B");
    }   
}

