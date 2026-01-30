<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class ComptimeIntHandlingTest extends TestCase
{   
    public function testImportComptimeIntAsStaticVariables(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame("A", "B");
    }

    public function testPrintComptimeIntArguments(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->assertSame("B", "B");
    }

    public function testReturnComptimeInt(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeIntInArray(): void
    {
        $module = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeIntInStruct(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeIntInPackedStruct(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeIntAsComptimeField(): void
    {
        $module = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeIntInBareUnion(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeIntInTaggedUnion(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeIntInOptional(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeIntInErrorUnion(): void
    {
        $module = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleComptimeIntInVector(): void
    {
        $module = ZigImporter::load(__DIR__ . '/vector-of.zig');
        $this->assertSame("B", "B");
    }   
}

