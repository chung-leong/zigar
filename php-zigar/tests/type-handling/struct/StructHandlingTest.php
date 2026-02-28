<?php declare(strict_types=1);

final class StructHandlingTest extends ZigarTestCase
{   
    public function testImportStructAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame([ 'number1' => 123, 'number2' => 456 ], (array) $m->constant);
        $this->assertExceptionMessage('write protected', function() use($m) {
            $m->constant->number1 = 1;
        });

        $this->expectOutputString(<<<OUTPUT
        .{ .number1 = 1, .number2 = 2 }
        .{ .number1 = 777, .number2 = 2 }
        .{ .number1 = 888, .number2 = 999 }

        OUTPUT);
        $m->print();
        $m->variable->number1 = 777;
        $m->print();
        $m->variable = [ 'number1' => 888, 'number2' => 999 ];
        $m->print();

        // TODO: comptime struct
    }

    public function testPrintStructArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        .{ .number1 = 11, .number2 = 44 }

        OUTPUT);
        $m->print(number1: 11, number2: 44);

        $this->assertExceptionMessage('not array or object', function() use($m) {
            $m->print(null);
        });
    }

    public function testReturnStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame([ 'number1' => 1, 'number2' => 2 ], (array) $m->getStruct());
    }

    public function testHandleStructInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
    }

    public function testHandleStructInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
    }

    public function testHandleStructInPackedStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
    }

    public function testHandleStructAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
    }

    public function testHandleStructInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
    }

    public function testHandleStructInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
    }

    public function testHandleStructInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
    }

    public function testHandleStructInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
    }

    public function testHandleStructInVector(): void
    {
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
    }
}

