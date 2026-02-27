<?php declare(strict_types=1);

final class ArrayHandlingTest extends ZigarTestCase
{   
    public function testImportArrayAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame([ ...$m->int32_array4 ], [ 1, 2, 3, 4 ]);
        // invalid operation error
        // $this->assertSame([ ...$m->float64_array4x4[3] ], [ 4.1, 4.2, 4.3, 4.4 ]);
        for ($i = 0; $i < count($m->int32_array4); $i++) {
            $m->int32_array4[$i] *= 4;
        }

        $this->expectOutputString(<<<OUTPUT
        { 4, 8, 12, 16 }

        OUTPUT);
        $m->print();
    }

    public function testPrintArrayArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
    }

    public function testReturnArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
    }

    public function testHandleArrayInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
    }

    public function testHandleArrayInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
    }

    public function testHandleArrayInPackedStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
    }

    public function testHandleArrayAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
    }

    public function testHandleArrayInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
    }

    public function testHandleArrayInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
    }

    public function testHandleArrayInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
    }

    public function testHandleArrayInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
    }

    public function testHandleArrayInVector(): void
    {
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
    }
}

