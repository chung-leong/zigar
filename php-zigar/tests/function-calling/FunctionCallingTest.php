<?php declare(strict_types=1);

final class FunctionCallingTest extends ZigarTestCase
{   
    public function testThrowWhenFunctionReturnsAnError(): void
    {
        $m = ZigImporter::load(__DIR__ . '/throw-error.zig');
        $result = $m->returnNumber(1234);
        $this->assertSame(1234, $result);
        $this->assertExceptionMessage("system is on fire", function() use($m) {
            $m->returnNumber(0);
        });
    }

    public function testThrowWhenArgumentIsInvalid(): void
    {
        $m = ZigImporter::load(__DIR__ . '/accept-u8.zig');
        $this->assertExceptionMessage("incorrect argument count", function() use($m) {
            $m->accept1(1, 123);
        });
        // TODO: range check
    }

    public function testReturnBooleanVector(): void
    {
        $m = ZigImporter::load(__DIR__ . '/return-bool-vector.zig');
        $a = [ true, true, true, true ];
        $b = [ true, true, false, true ];
        $c = [ false, false, false, false ];
        $this->assertSame(true, $m->all($a));
        $this->assertSame(false, $m->all($b));
        $this->assertSame(true, $m->any($a));
        $this->assertSame(true, $m->any($b));
        $this->assertSame(false, $m->any($c));
    }

    public function testCallMethods(): void
    {
        $m = ZigImporter::load(__DIR__ . '/allow-method-calls.zig');
        $a = new $m->Struct(number: 123);
        $b = new $m->Struct(number: 456);
        $this->expectOutputString(<<<OUTPUT
        .{ .number = 123 }
        .{ .number = 456 }
        .{ .number = 123 }
        .{ .number = 456 }

        OUTPUT);
        $a->print1();
        $b->print1();
        $a->print2();
        $b->print2();

        $a->add(7);
        $this->assertSame(130, $a->number);
        $b->add(4);
        $this->assertSame(460, $b->number);
    }

    public function testCallInlineFunction(): void {
        $m = ZigImporter::load(__DIR__ . '/call-inline-function.zig');
        $this->expectOutputString(<<<OUTPUT
        Hello world!

        OUTPUT);
        $m->print();
    }
}
