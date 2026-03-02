<?php declare(strict_types=1);

final class ArrayHandlingTest extends ZigarTestCase
{   
    public function testImportArrayAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame([ 1, 2, 3, 4 ], (array) $m->int32_array4);
        $this->assertSame([ 1.1, 1.2, 1.3, 1.4 ], (array) $m->float64_array4x4[0]);
        $this->assertSame([ 2.1, 2.2, 2.3, 2.4 ], (array) $m->float64_array4x4[1]);
        $this->assertSame([ 3.1, 3.2, 3.3, 3.4 ], (array) $m->float64_array4x4[2]);
        $this->assertSame([ 4.1, 4.2, 4.3, 4.4 ], (array) $m->float64_array4x4[3]);
        for ($i = 0; $i < count($m->int32_array4); $i++) {
            $m->int32_array4[$i] *= 4;
        }

        $this->expectOutputString(<<<OUTPUT
        { 4, 8, 12, 16 }

        OUTPUT);
        $m->print();

        $this->assertSame('Hello', $m->string);
        // TODO: plain array, complex array, and typed array
    }

    public function testPrintArrayArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        { 1.1, 2.2, 3.3, 4.4 }

        OUTPUT);
        $m->print([ 1.1, 2.2, 3.3, 4.4 ]);
    }

    public function testReturnArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $result = $m->getArray();
        $this->assertSame([ 1, 2, 3, 4 ], (array) $result);

        // TODO: missing stringify
        $string = $m->getString();
        $this->assertSame('Hello', $string);
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

