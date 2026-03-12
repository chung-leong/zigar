<?php declare(strict_types=1);

final class NoReturnHandlingTest extends ZigarTestCase
{   
    public function testFailWithNoReturnAsStaticVariables(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        });
    }

    public function testFailWithNoReturnArguments(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        });
    }

    public function testReturnNoReturn(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame("object", gettype($m->exit));
        $this->assertSame(true, is_callable([ $m, 'exit' ]));
        $this->assertSame(true, isset($m->exit));
        $this->assertSame(true, (bool) $m->exit);
    }

    public function testFailWithNoReturnInArray(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        });
    }

    public function testFailWithNoReturnInStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        });
    }

    public function testFailWithNoReturnInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testFailWithNoReturnAsComptimeField(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        });
    }

    public function testFailWithNoReturnInBareUnion(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        });
    }

    public function testFailWithNoReturnInTaggedUnion(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        });
    }

    public function testFailWithNoReturnInOptional(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        });
    }

    public function testFailWithNoReturnInErrorUnion(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        });
    }

    public function testFailWithNoReturnInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }

    public function testFailToConstructNoReturn(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        });
    }
}
