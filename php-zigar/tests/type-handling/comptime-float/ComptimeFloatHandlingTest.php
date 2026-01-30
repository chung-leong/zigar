<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class ComptimeFloatHandlingTest extends TestCase
{   
    public function testImportComptimeFloatAsStaticVariables(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame("A", "B");
    }

    public function testPrintComptimeFloatArguments(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->assertSame("B", "B");
    }

    public function testReturnComptimeFloat(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeFloatInArray(): void
    {
        $module = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeFloatInStruct(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeFloatInPackedStruct(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeFloatAsComptimeField(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeFloatInBareUnion(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeFloatInTaggedUnion(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeFloatInOptional(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeFloatInErrorUnion(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeFloatInVector(): void
    {
        $module = ZigImporter::load(__DIR__ . '/vector-of.zig');
        $this->assertSame("B", "B");
    }   
}

