<?php declare(strict_types=1);

final class FunctionPointerTest extends ZigarTestCase
{   
    public function testPassFloatingPointArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/floating-point-arguments.zig');
        $f = function($a1, $a2, $a3, $a4, $a5, $a6, $a7, $a8, $a9, $a10, $a11, $a12) {
            return $a1 + $a2 + $a3 + $a4 + $a5 + $a6 + $a7 + $a8 + $a9 + $a10 + $a11 + $a12;
        };
        $result = $m->call($f);
        $correct = 0.1 + 0.2 + 0.3 + 0.4 + 0.5 + 0.6 + 0.7 + 0.8 + 0.9 + 1.0 + 1.1 + 1.2;
        $this->assertSame($correct, round($result, 1));
    }

    public function testCorrectlyPassStructArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/struct-arguments.zig');
        $saved = (object) [];
        $f = function($b) use ($saved) {
            $saved->object = $b->__plain;
            return $b->a;
        };
        $result = $m->call($f);
        print_r($saved->object);
        print_r($result);
    }

    public function testCorrectlyPassArrayArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-arguments.zig');
        $saved = (object) [];
        $f = function($a, $b) use ($saved) {
            $saved->array1 = (array) $a;
            $saved->array2 = (array) $b;
        };
        $m->call($f);
        $this->assertSame([ 123, 456, 789 ], $saved->array1);
        $this->assertSame([ 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8 ], $saved->array2);
    }

    public function testCorrectlyPassSliceArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/slice-arguments.zig');
        $saved = (object) [];
        $f = function($a) use ($saved) {
            $saved->array = (array) $a;
        };
        $m->call($f);
        $this->assertSame([ 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2 ], $saved->array);
    }

    public function testCorrectlyPassStringArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/string-arguments.zig');
        $saved = (object) [];
        $f = function($s) use($saved) {
            $saved->string = $s;
        };
        $m->call($f);
        $this->assertSame('Hello world', $saved->string);
    }

    public function testCorrectlyPassAllocatorAsArgumentAndReturnNewSlice(): void
    {
        $m = ZigImporter::load(__DIR__ . '/returning-slice.zig');
        $f1 = function($allocator) {
            print_r($allocator);
            return $allocator->dupe('Hello world!');
        };
        $m->printString($f1);
    }

    public function testThrowWhenJavascriptFunctionIsUsedAsTargetOfPointerToVariadicFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/variadic-function.zig');
        $this->expectOutputString(<<<OUTPUT
        123
        456
        789

        OUTPUT);
        $m->call($m->printI32);
        $this->assertExceptionMessage('variadic function pointer cannot point to a PHP function', function() use($m) {
            $m->call(function() {});
        });
    }

    public function testReceiveTransformedArgumentsThroughCallback(): void
    {
        $m = ZigImporter::load(__DIR__ . '/receive-transformed.zig');
        $saved = (object) [];
        $f = function(...$args) use($saved) {
            $saved->received = $args;
            return 123;
        };
        $m->setCallback($f);
        $result = $m->triggerCallback();
        $this->assertSame(123, $result);
    }
    
}
