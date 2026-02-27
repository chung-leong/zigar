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
        $m->accept1(1, 123);
    }
}
