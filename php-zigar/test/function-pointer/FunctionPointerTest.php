<?php declare(strict_types=1);

final class FunctionPointerTest extends ZigarTestCase
{   
    public function testReleaseFunctionPointer(): void
    {
        $m = ZigImporter::load(__DIR__ . '/release-function-pointer.zig');
        $this->expectOutput(<<<OUTPUT
        Hello world!
        Hello world!
        foo
        foo

        OUTPUT);
        $f = function() {
            echo "Hello world!\n";
        };
        $m->set($f);
        $m->call();
        $m->release();
        $f();
        $m->set($m->foo);
        $m->call();
        $m->release();
        $m->foo();
    }

    public function testReleaseFunctionPointerAutomatically(): void
    {
        $m = ZigImporter::load(__DIR__ . '/release-function-pointer-automatically.zig');
        $this->expectOutput(<<<OUTPUT
        Hello world!

        OUTPUT);
        $m->call(function() {
            echo "Hello world!\n";
        });
    }

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
        $this->assertEquals($saved->object, (object) [
            'a' => (object) [ 'number1' => 123, 'number2' => 456 ],
            'b' => 3.141592653589793,
        ]);
        $this->assertEquals($result->__plain, (object) [
            'number1' => 123, 'number2' => 456
        ]);
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
            echo "Callback 1 invoked!\n";
            return $allocator->dupe('Hello world!');
        };
        $f2 = function($allocator) {
            echo "Callback 2 invoked!\n";
            $ab = $allocator->alloc(8 * 4, 8);
            $ta = new Float64Array($ab);
            for ($i = 0; $i < count($ta); $i++) $ta[$i] = $i * 100;
            return $ta;
        };

        $this->expectOutput(<<<OUTPUT
        Callback 1 invoked!
        Hello world!
        Callback 2 invoked!
        { 0, 100, 200, 300 }

        OUTPUT);
        $m->printString($f1);
        $m->printArray($f2);
    }

    public function testPassAbortSignalAsArgument(): void
    {
        $m = ZigImporter::load(__DIR__ . '/abort-signal.zig');
        $saved = (object) [];
        $f = function($signal) use ($saved) {
            $saved->signal = $signal;
        };
        $m->call($f);
        $this->assertTrue($saved->signal->off());
        $this->assertFalse($saved->signal->on());
        while ($saved->signal->off()) {
            usleep(1000);
        }
        $this->assertFalse($saved->signal->off());
    }

    public function testPassPromiseAsArgument(): void
    {
        $m = ZigImporter::load(__DIR__ . '/promise.zig');
        $saved = (object) [];
        $this->expectOutput(<<<OUTPUT
        number = 1234, value = 55
        number = 1234, error = Unexpected
        number = 1234, value = 123
        number = 1234, error = Unexpected
        number = 1234, error = Unexpected
        number = 1234, error = Unexpected

        OUTPUT);

        $m->call(function($callback) {
            $callback(55);
        });
        $m->call(function($callback) use($m) {
            $callback($m->JSError->Unexpected);
        });
        $m->call(function() {
            return 123;
        });
        $m->call(function() use($m) {
            throw $m->JSError->Unexpected;
        });
        $m->call(function() {
            throw new Exception('Unexpected');
        });
        $m->call(function() {
            throw new Exception('Doh!');
        });
        usleep(10 * 1000);
    }

    public function testPassAllocatorAndPromiseAsArgument(): void
    {
        $m = ZigImporter::load(__DIR__ . '/promise-with-allocator.zig');
        $this->expectOutput(<<<OUTPUT
        value = Hello world
        value = Hello world
        value = Hello world

        OUTPUT);

        $m->call(function() {
            return 'Hello world';
        });
        $m->call(function($callback) {
            $callback('Hello world');
        });
        $m->call(function($allocator, $callback) {
            $callback($allocator->dupe('Hello world'));
        });
    }

    public function testPassGeneratorAsArgument(): void
    {
        $m = ZigImporter::load(__DIR__ . '/generator.zig');
        $this->expectOutput(<<<OUTPUT
        number = 1234, value = 0
        number = 1234, value = 1
        number = 1234, value = 2
        number = 1234, value = 3
        number = 1234, value = 4
        number = 1234, value = null
        number = 1234, value = 6
        number = 1234, value = 7
        number = 1234, value = 8
        number = 1234, value = 9
        number = 1234, value = 10
        number = 1234, value = 6
        number = 1234, value = 7
        number = 1234, value = 8
        number = 1234, value = 9
        number = 1234, value = 10

        OUTPUT);
        $m->call(function() {
            for ($i = 0; $i < 5; $i++) yield $i;
        });
        $m->call(function() {
            for ($i = 6; $i < 20; $i++) yield $i;
        });
        $m->call(function($callback) {
            for ($i = 6; $i < 20; $i++) {
                if (!$callback($i)) {
                    break;
                }
            }
        });
    }

    public function testPassGeneratorWithAllocatorAsArgument(): void
    {
        $m = ZigImporter::load(__DIR__ . '/generator-with-allocator.zig');
        $this->expectOutput(<<<OUTPUT
        real_name = Tony Stark, superhero_name = Ironman, age = 53
        real_name = Peter Parker, superhero_name = Spiderman, age = 17
        real_name = Natasha Romanoff, superhero_name = Black Widow, age = 39
        real_name = Tony Stark, superhero_name = Ironman, age = 53
        error = Unexpected

        OUTPUT);
        $m->call(function() {
            $avengers = [
                [ 'real_name' => 'Tony Stark', 'superhero_name' => 'Ironman', 'age' => 53 ],
                [ 'real_name' => 'Peter Parker', 'superhero_name' => 'Spiderman', 'age' => 17 ],
                [ 'real_name' => 'Natasha Romanoff', 'superhero_name' => 'Black Widow', 'age' => 39 ],
            ];
            foreach ($avengers as $avenger) yield $avenger;
        });
        $m->call(function() {
            yield [ 'real_name' => 'Tony Stark', 'superhero_name' => 'Ironman', 'age' => 53 ];
            throw new Exception('Unexpected');
        });
    }

    /**
     * @requires OS Linux|Darwin
     */
    public function testThrowWhenPhpFunctionIsUsedAsTargetOfPointerToVariadicFunction(): void
    {
        $m = ZigImporter::load(__DIR__ . '/variadic-function.zig');
        $this->expectOutput(<<<OUTPUT
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
        $m->freeCallback();
        $this->assertSame(123, $result);
        $this->assertSame([ 72, 101, 108, 108, 111,  32, 119, 111, 114, 108, 100 ], $saved->received[1]);
        $this->assertEquals(new Uint8Array([ 72, 101, 108, 108, 111,  32, 119, 111, 114, 108, 100 ]), $saved->received[2]);
        $this->assertEquals((object) [
            'string' => 'Hello world',
            'plain' => [ 72, 101, 108, 108, 111,  32, 119, 111, 114, 108, 100 ],
            'typed_array' => new Uint8Array([ 72, 101, 108, 108, 111,  32, 119, 111, 114, 108, 100 ]),
        ], $saved->received[3]);
    }
}
