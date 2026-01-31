<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class BoolHandlingTest extends TestCase
{   
    public function testImportBoolAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(true, $m->bool1);
        $this->assertSame(false, $m->bool2);
        $this->assertSame(true, $m->bool3);
        $this->assertSame(false, $m->bool4);

        $m->bool1 = false;
        $this->assertSame(false, $m->bool1);

        $this->expectExceptionMessage("write protected (zig)");
        $m->bool4 = false;

        $this->expectOutputString('no');
        $m->print();
    }

    public function testPrintBoolArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString("no\nyes\n");
        $m->print(false);
        $m->print(true);
    }

    public function testReturnBool(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame(false, $m->getFalse());
        $this->assertSame(true, $m->getTrue());
    }

    public function testHandleBoolInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleBoolInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleBoolInPackedStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleBoolAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleBoolInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleBoolInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleBoolInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleBoolInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleBoolInVector(): void
    {
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        $this->assertSame("B", "B");
    }   
}

