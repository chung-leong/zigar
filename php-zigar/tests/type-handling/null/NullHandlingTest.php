<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

final class NullHandlingTest extends TestCase
{   
    public function testImportNullAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(null, $m->weird);
    }

    public function testIgnoreFunctionAcceptingNull(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectExceptionMessage("Call to undefined method");
        $m->print(null);
    }

    public function testIgnoreFunctionReturningNull(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->expectExceptionMessage("Call to undefined method");
        $m->getNull();
    }

    public function testHandleNullInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        for ($i = 0; $i < 4; $i++) {
            $this->assertSame(null, $m->array[$i]);
        }
    }

    public function testHandleNullInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
    }

    public function testHandleNullInPackedStruct(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
    }

    public function testHandleNullAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
    }

    public function testHandleNullInBareUnion(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
    }

    public function testHandleNullInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
    }

    public function testHandleNullInOptional(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
    }

    public function testHandleNullInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame(null, $m->error_union1);
        
        $this->expectOutputString(<<<OUTPUT
        null

        OUTPUT);
        $m->print();

        $this->expectExceptionMessage("goldfish died");
        $m->error_union2;
    }

    public function testHandleNullInVector(): void
    {
        $this->expectExceptionMessage("unable to create module");
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
    }
}

