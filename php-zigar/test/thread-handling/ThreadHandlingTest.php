<?php declare(strict_types=1);

final class ThreadHandlingTest extends ZigarTestCase
{   
    public function testSpawnThreadsAndInvokeCallback(): void
    {
        $this->inEventLoops([ 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/create-thread-call-function.zig');
            $m->startup();
            try {
                $count = 0;
                for ($i = 0; $i < 10; $i++) {                
                    $m->spawn(function() use (&$count) {
                        $count++;
                    });
                }
                delay(200);
                $this->assertSame(10, $count);
                $this->expectOutputString(<<<OUTPUT
                Error: Unexpected

                OUTPUT);
                $m->spawn(function() {
                    throw new Exception('Doh!');
                });
                delay(100);
            } finally {
                $m->shutdown();
            }
        });
    }   

    public function testSpawnThreadPoolAndInvokeCallback(): void
    {
        $this->inEventLoops([ 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/create-thread-pool.zig');
            $m->startup(4);
            try {
                $count = 0;
                for ($i = 0; $i < 10; $i++) {                
                    $m->spawn(function() use (&$count) {
                        $count++;
                    });
                }
                for ($i = 0; $i < 20; $i++) {
                    if ($m->getCount() == 10) break;
                    delay(25);
                }
                $this->assertSame(10, $count);
            } finally {
                $m->shutdown();
            }
        });
    }   

    public function testCreateThreadThatResolvesAPromise(): void
    {
        $this->inEventLoops([ 'temporary', 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/create-thread-with-promise.zig');
            $m->startup();
            try {
                $result1 = $m->spawn();
                $this->assertSame(1234, $result1);
                $result2 = $m->spawn();
                $this->assertSame(1234, $result2);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testReceiveStringFromPromise(): void
    {
        $this->inEventLoops([ 'temporary', 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/create-thread-with-string-promise.zig');
            $m->startup();
            try {
                $result = $m->spawn();
                $this->assertSame('Hello world', $result);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testReceivePlainObjectFromPromise(): void
    {
        $this->inEventLoops([ 'temporary', 'revolt' ], function() {            
            $m = ZigImporter::load(__DIR__ . '/create-thread-with-plain-object-promise.zig');
            $m->startup();
            try {                
                $result = $m->spawn();
                $this->assertEquals((object) [ 'x' => 123, 'y' => 456 ], $result);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testReceiveStringsFromGenerator(): void
    {
        $this->inEventLoops([ 'temporary', 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/create-thread-with-string-generator.zig');
            $m->startup();
            try {
                $generator = $m->spawn();
                $list = [];
                foreach ($generator as $s) {
                    $list[] = $s;
                    $this->assertSame('Hello world', $s);
                }
                $this->assertSame(5, count($list));                
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testReceiveStringsFromAllocatingGenerator(): void
    {
        $this->inEventLoops([ 'temporary', 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/create-thread-with-allocating-generator.zig');
            $m->startup();
            try {
                $generator = $m->spawn();
                $list = [];
                foreach ($generator as $s) {
                    $list[] = $s;
                    $this->assertSame('Hello world', $s);
                }
                $this->assertSame(5, count($list));                
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testReceivePlainObjectsFromGenerator(): void
    {
        $this->inEventLoops([ 'temporary', 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/create-thread-with-plain-object-generator.zig');
            $m->startup();
            try {
                $generator = $m->spawn();
                $list = [];
                foreach ($generator as $s) {
                    $list[] = $s;
                }
                $this->assertSame(5, count($list));
                $this->assertEquals([
                    (object) [ 'x' => 0, 'y' => 0 ],
                    (object) [ 'x' => 10, 'y' => 100 ],
                    (object) [ 'x' => 20, 'y' => 200 ],
                    (object) [ 'x' => 30, 'y' => 300 ],
                    (object) [ 'x' => 40, 'y' => 400 ],
                ], $list);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testCreateThreadOrImmediatelyProvideValue(): void
    {
        $this->inEventLoops([ 'temporary', 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/create-thread-optionally.zig');
            $m->startup();
            try {
                $result1 = $m->spawn(true);
                $this->assertSame(1234, $result1);
                $result2 = $m->spawn(false);
                $this->assertSame(777, $result2);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testRejectPromiseSynchronously(): void
    {
        $this->inEventLoops([ 'temporary', 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/create-thread-promise-failure.zig');
            $this->assertExceptionMessage('thread creation failure', function() use($m) {
                $x = $m->spawn();
            });
        });
    }

    public function testCreateThreadThatAcceptsAnAbortSignal(): void
    {
        $this->inEventLoops([ 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/create-thread-with-abort-signal.zig');
            $m->startup();
            try {
                $signal = new AbortSignal();
                timeout(function() use($signal) {
                    $signal->abort();
                }, 100);
                $exception = null;
                try {
                    $m->spawn(true, signal: $signal); 
                } catch (Exception $e) {
                    $exception = $e;
                }
                $this->assertTrue($exception instanceof Exception);
            } finally {
                $m->shutdown();
            }
        });        
    }

    public function testCreateThreadThatAcceptsAnAbortSignalThatWorksAtomically(): void
    {
        $this->inEventLoops([ 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/create-thread-with-abort-signal-atomic.zig');
            $m->startup();
            try {
                $signal = new AbortSignal();
                timeout(function() use($signal) {
                    $signal->abort();
                }, 100);
                $exception = null;
                try {
                    $m->spawn(true, signal: $signal); 
                } catch (Exception $e) {
                    $exception = $e;
                }
                $this->assertTrue($exception instanceof Exception);
            } finally {
                $m->shutdown();
            }
        });        
    }

    public function testCreateThreadThatAllocateMemory(): void
    {
        $this->inEventLoops([ 'temporary', 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/create-thread-allocate-memory.zig');
            $m->startup();
            try {
                $result = $m->spawn();
                $this->assertSame('Hello world', $result->__string);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testCreateThreadPoolForFunctionReturningPromise(): void
    {
        $this->inEventLoops([ 'temporary', 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/create-thread-pool-return-promise.zig');
            $m->startup(4);
            try {
                $result = $m->spawn();
                $this->assertSame(1234, $result);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testCallFunctionsThroughWorkQueue(): void
    {
        $this->inEventLoops([ 'temporary', 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/use-work-queue.zig');
            $m->startup(2);
            try {
                $str = $m->returnString();
                $this->assertSame('Hello world!', $str);
                $int = $m->returnInt();
                $this->assertSame(1234, $int);
                $point = $m->returnPoint();
                $this->assertEquals((object) [ 'x' => 0.1234, 'y' => 0.4567 ], $point);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testCallFunctionsThroughSingleThreadWorkQueue(): void
    {
        $this->inEventLoops([ 'temporary', 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/use-work-queue-single-thread.zig');
            $m->startup();
            try {
                $str = $m->returnString();
                $this->assertSame('Hello world!', $str);
                $int = $m->returnInt();
                $this->assertSame(1234, $int);
                $point = $m->returnPoint();
                $this->assertEquals((object) [ 'x' => 0.1234, 'y' => 0.4567 ], $point);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testInvokeThreadStartFunction(): void
    {
        $this->inEventLoops([ 'temporary', 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/use-work-queue-with-thread-start-fn.zig');
            $m->startup();
            try {
                $str = $m->returnString();
                $this->assertSame('Hello world!', $str);
                $int = $m->returnInt();
                $this->assertSame(1234, $int);
                $point = $m->returnPoint();
                $this->assertEquals((object) [ 'x' => 0.1234, 'y' => 0.4567 ], $point);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testInitializeWorkQueueAutomatically(): void
    {
        $this->inEventLoops([ 'temporary', 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/use-work-queue-auto-init.zig');
            try {
                $str = $m->returnString();
                $this->assertSame('Hello world!', $str);
                $int = $m->returnInt();
                $this->assertSame(1234, $int);
                $point = $m->returnPoint();
                $this->assertEquals((object) [ 'x' => 0.1234, 'y' => 0.4567 ], $point);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testNotCompileWhenAFunctionAcceptsAnAbortSignalWithoutPromise(): void 
    {
        $this->assertExceptionMessage('unable to create module', function() {
            $m = ZigImporter::load(__DIR__ . '/abort-signal-without-promise.zig');
        });
    }

    public function testCreateADetachedThreadUsingPthread(): void
    {
        $this->inEventLoops([ 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/create-detached-thread-with-pthread.zig');
            $m->startup();
            try {
                $this->expectOutputString(<<<OUTPUT
                Hello world!

                OUTPUT);
                $m->spawn();
                delay(250);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testCreateAThreadInAThreadUsingPthread(): void
    {
        $this->inEventLoops([ 'revolt' ], function() {
            $m = ZigImporter::load(__DIR__ . '/create-thread-in-thread-with-pthread.zig');
            $m->startup();
            try {
                $this->expectOutputString(<<<OUTPUT
                Hello world!
                retval = 1234

                OUTPUT);
                $m->spawn();
                delay(250);
            } finally {
                $m->shutdown();
            }
        });
    }
}
