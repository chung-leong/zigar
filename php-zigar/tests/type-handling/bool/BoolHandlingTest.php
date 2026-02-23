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
        $this->assertSame([ false, false, false, false ], (array) $m->array_const);
        $this->assertSame([ true, false, false, true ], (array) $m->array);

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
        $this->assertSame([ 'state1' => false, 'state2' => true ], (array) $m->struct_a);
        $b = new $m->StructA();
        $this->assertSame(true, $b->state1);
        $this->assertSame(false, $b->state2);

        $this->expectOutputString(<<<OUTPUT
        .{ .state1 = false, .state2 = true }

        OUTPUT);       
        $m->print();
        // $m->struct_a = $b;
        // $m->print();
    }

    public function testHandleBoolInPackedStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        $this->assertSame(false, $m->struct_a->state1);
        $this->assertSame(true, $m->struct_a->state2);
        $this->assertSame(200, $m->struct_a->number);
        $this->assertSame(true, $m->struct_a->state3);
    }

    public function testHandleBoolAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame(false, $m->struct_a->state);
    }

    public function testHandleBoolInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame(true, $m->union_a->state);
        // TODO: runtime safe check
        echo $m->union_a->snumber, "\n";
    }

    public function testHandleBoolInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame(true, $m->union_a->state);
        $this->assertSame(null, $m->union_a->number);
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
        $this->assertSame(true, $m->error_union);
        $this->expectOutputString(<<<OUTPUT
        true
        error.GoldfishDied

        OUTPUT);       
        $m->print();
        $m->error_union = new Exception('goldfish died');
        $m->print();
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

