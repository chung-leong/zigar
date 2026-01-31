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
        $this->expectOutputString(<<<OUTPUT
        no
        yes

        OUTPUT);
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
        $this->assertSame(false, $m->array[1]);
        $this->assertSame(true, $m->array[3]);

        $this->expectOutputString(<<<OUTPUT
        { true, false, false, true }
        { false, false, false, true }
        { false, false, true, true }

        OUTPUT);
        $m->print();
        $m->array[0] = false;
        $m->print();
        $m->array[2] = true;
        $m->print();

        $this->expectExceptionMessage("write protected (zig)");
        $m->array_const[2] = false;
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
        echo 
        $this->assertSame("B", "B");
    }

    public function testHandleBoolInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->expectOutputString("true\nnull\nfalse\n");
        $m->print();
        $m->optional = null;
        $m->print();
        $m->optional = false;
        $m->print();
    }

    public function testHandleBoolInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame("B", "B");
    }

    public function testHandleBoolInVector(): void
    {
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        $this->assertSame(false, $m->vector[1]);
        $this->assertSame(true, $m->vector[3]);

        $this->expectOutputString(<<<OUTPUT
        { true, false, false, true }
        { false, false, false, true }
        { false, false, true, true }

        OUTPUT);
        $m->print();
        $m->vector[0] = false;
        $m->print();
        $m->vector[2] = true;
        $m->print();

        $this->expectExceptionMessage("write protected (zig)");
        $m->vector_const[2] = false;
    }   
}

