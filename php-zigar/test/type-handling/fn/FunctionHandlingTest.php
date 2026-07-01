<?php declare(strict_types=1);

final class FunctionHandlingTest extends ZigarTestCase
{   
    public function testImportFunctionAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertTrue(is_callable($m->func));

        $this->expectOutputString(<<<OUTPUT
        hello
        world
        Hello world

        OUTPUT);

        $m->func();
        $m->func = $m->world;
        $m->func();

        $this->assertTrue(is_callable($m->hello));
        $this->assertTrue(is_callable($m->hello2));
        $this->assertTrue(is_callable($m->hello3));
        $this->assertTrue(is_callable($m->{" \nthis is a totally weird function name!! :-)"}));
        $m->{" \nthis is a totally weird function name!! :-)"}();
    }

    public function testCallFunctionsPassedAsArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $m->call1($m->hello);
        $m->call1($m->world);
        $m->call1(function() {
            echo "hello\n";
            echo "world\n";
        });
        $this->expectOutputString(<<<OUTPUT
        hello
        world
        hello
        world

        OUTPUT);
        $dingo = false;
        $f1 = new $m->Callback1(function() use(&$dingo) {
            $dingo = true;
        });
        $m->call1($f1);
        $this->assertTrue($dingo);
        // $f1 is freed by call1()
        $this->assertExceptionMessage('accessing deallocated memory', function() use($m, $f1) {
            $m->call1($f1);
        });
    }

    public function testIgnoreFunctionReturningFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $ptr = $m->getFunction();
        $this->assertTrue(is_callable($ptr));
        $f = $ptr->{'*'};
        $this->assertTrue(is_callable($f));
        $ptr();
        $f();
        $m->getFunction()();
        $this->expectOutputString(<<<OUTPUT
        hello
        hello
        hello

        OUTPUT);
    }

    public function testHandleFunctionInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
    }

    public function testHandleFunctionInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
    }

    public function testFailWithFunctionInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandleFunctionAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
    }

    public function testFailWithFunctionInBareUnion(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        });
    }

    public function testHandleFunctionInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
    }

    public function testHandleFunctionInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
    }

    public function testHandleFunctionInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
    }

    public function testFailWithFunctionInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }

    public function testConstructFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $this->assertFalse(isset($m->Function));
    }
}

