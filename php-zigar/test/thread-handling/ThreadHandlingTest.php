<?php declare(strict_types=1);

final class ThreadHandlingTest extends ZigarTestCase
{   
    public function testSpawnThreadsAndInvokeCallback(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-thread-call-function.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
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
                $this->expectOutput(<<<OUTPUT
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
        $m = ZigImporter::load(__DIR__ . '/create-thread-pool.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
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
        $m = ZigImporter::load(__DIR__ . '/create-thread-with-promise.zig');
        $this->inEventLoops([ 'temporary', 'revolt' ], function() use($m) {
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
        $m = ZigImporter::load(__DIR__ . '/create-thread-with-string-promise.zig');
        $this->inEventLoops([ 'temporary', 'revolt' ], function() use($m) {
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
        $m = ZigImporter::load(__DIR__ . '/create-thread-with-plain-object-promise.zig');
        $this->inEventLoops([ 'temporary', 'revolt' ], function() use($m) {            
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
        $m = ZigImporter::load(__DIR__ . '/create-thread-with-string-generator.zig');
        $this->inEventLoops([ 'temporary', 'revolt' ], function() use($m) {
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
        $m = ZigImporter::load(__DIR__ . '/create-thread-with-allocating-generator.zig');
        $this->inEventLoops([ 'temporary', 'revolt' ], function() use($m) {
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
        $m = ZigImporter::load(__DIR__ . '/create-thread-with-plain-object-generator.zig');
        $this->inEventLoops([ 'temporary', 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $generator = $m->spawn();
                $list = [];
                foreach ($generator as $obj) {
                    $list[] = $obj;
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
        $m = ZigImporter::load(__DIR__ . '/create-thread-optionally.zig');
        $this->inEventLoops([ 'temporary', 'revolt' ], function() use($m) {
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
        $m = ZigImporter::load(__DIR__ . '/create-thread-promise-failure.zig');
        $this->inEventLoops([ 'temporary', 'revolt' ], function() use($m) {
            $this->assertExceptionMessage('thread creation failure', function() use($m) {
                $x = $m->spawn();
            });
        });
    }

    public function testCreateThreadThatAcceptsAnAbortSignal(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-thread-with-abort-signal.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $signal = new AbortSignal();
                timeout(function() use($signal) {
                    $signal->abort();
                }, 100);
                $exception = null;
                try {
                    $result = $m->spawn(true, signal: $signal); 
                } catch (Exception $e) {
                    $exception = $e;
                }
                $this->assertTrue($exception instanceof Exception);
                $this->assertSame('aborted', $exception->getMessage());
            } finally {
                $m->shutdown();
            }
        });        
    }

    public function testCreateThreadThatAcceptsAnAbortSignalThatWorksAtomically(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-thread-with-abort-signal-atomic.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
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
                $this->assertSame('aborted', $exception->getMessage());
            } finally {
                $m->shutdown();
            }
        });        
    }

    public function testCreateThreadThatAllocateMemory(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-thread-allocate-memory.zig');
        $this->inEventLoops([ 'temporary', 'revolt' ], function() use($m) {
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
        $m = ZigImporter::load(__DIR__ . '/create-thread-pool-return-promise.zig');
        $this->inEventLoops([ 'temporary', 'revolt' ], function() use($m) {
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
        $m = ZigImporter::load(__DIR__ . '/use-work-queue.zig');
        $this->inEventLoops([ 'temporary', 'revolt' ], function() use($m) {
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
        $m = ZigImporter::load(__DIR__ . '/use-work-queue-single-thread.zig');
        $this->inEventLoops([ 'temporary', 'revolt' ], function() use($m) {
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
        $m = ZigImporter::load(__DIR__ . '/use-work-queue-with-thread-start-fn.zig');
        $this->inEventLoops([ 'temporary', 'revolt' ], function() use($m) {
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
        $m = ZigImporter::load(__DIR__ . '/use-work-queue-auto-init.zig');
        $this->inEventLoops([ 'temporary', 'revolt' ], function() use($m) {
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
        $m = ZigImporter::load(__DIR__ . '/create-detached-thread-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $this->expectOutput(<<<OUTPUT
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
        $m = ZigImporter::load(__DIR__ . '/create-thread-in-thread-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $this->expectOutput(<<<OUTPUT
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

    public function testExitThreadCreatedUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/exit-thread-created-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $this->expectOutput(<<<OUTPUT
                Hello world! 0
                Hello world! 1
                Hello world! 2
                Hello world! 3

                OUTPUT);
                $m->spawn();
                delay(250);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testExitThreadCreatedInAThreadUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/exit-thread-created-in-thread-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $this->expectOutput(<<<OUTPUT
                Hello world! 0
                Hello world! 1
                Hello world! 2
                Hello world! 3
                retval = 1234

                OUTPUT);
                $m->spawn();
                delay(250);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testPrintIdsOfThreadsCreatedUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/print-ids-of-threads-created-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $this->expectOutputRegex("/(thread_id = \\d+\\n){5}/s");
                $m->spawn(5);
                delay(250);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testCreateMutexUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-mutex-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $this->expectOutput(<<<OUTPUT
                Thread 1 acquired mutex
                Thread 2 acquired mutex

                OUTPUT);
                $m->spawn();
                delay(250);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testCreateErrorCheckingMutexUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-error-checking-mutex-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $this->expectOutput(<<<OUTPUT
                retval == EDEADLK: true

                OUTPUT);
                $m->spawn();
                delay(250);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testCreateRecursiveMutexUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-recursive-mutex-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $this->expectOutput(<<<OUTPUT
                Thread 1 acquired mutex
                Thread 2 acquired mutex

                OUTPUT);
                $m->spawn();
                delay(250);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testWaitMomentarilyForMutexCreatedUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/wait-momentarily-for-mutex-created-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $this->expectOutput(<<<OUTPUT
                Thread 1 acquired mutex
                Thread 3 timed out: true
                Thread 2 acquired mutex

                OUTPUT);
                $m->spawn();
                delay(250);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testCreateSpinlockUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-spinlock-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $this->expectOutput(<<<OUTPUT
            Main thread acquired spinlock
            Thread 2 found busy lock: true
            Main thread released spinlock
            Thread 1 acquired spinlock

            OUTPUT);
            $m->startup();
            try {
                $m->spawn();
                delay(250);
                $m->unlock();
                delay(500);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testCreateReadWriteLockUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-rwlock-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            try {
                $this->expectOutputRegex("/Main thread acquired write lock");
                $this->expectOutputRegex("/Main thread released write lock/");
                $this->expectOutputRegex("/Thread 1 timed out: true/");
                $this->expectOutputRegex("/Thread 1 acquired read lock/");
                $this->expectOutputRegex("/Thread 2 acquired write lock/");
                $m->spawn(false);
                delay(250);
                $m->unlock();
                delay(500);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testWaitMomentarilyForReadLockUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/wait-momentarily-for-read-lock-created-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $this->expectOutputRegex("/Thread 1 timed out: true/");
                $this->expectOutputRegex("/Main thread releasing write lock/");
                $this->expectOutputRegex("/Thread 2 acquired read lock/");
                $m->spawn();
                delay(250);
                $m->unlock();
                delay(500);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testWaitMomentarilyForWriteLockUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/wait-momentarily-for-write-lock-created-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $this->expectOutputRegex("/Thread 1 timed out: true/");
                $this->expectOutputRegex("/Main thread releasing write lock/");
                $this->expectOutputRegex("/Thread 2 acquired write lock/");
                $m->spawn();
                delay(250);
                $m->unlock();
                delay(500);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testCreateSemaphoreUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-semaphore-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $this->expectOutputRegex("/acquired semaphore: 0/");
                $this->expectOutputRegex("/acquired semaphore: 1/");
                $m->spawn();
                delay(500);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testCreateNamedSemaphoreUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-semaphore-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $this->expectOutputRegex("/(acquired semaphore: 0)/");
                $this->expectOutputRegex("/(acquired semaphore: 1)/");
                $m->spawn();
                delay(500);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testWaitMomentarilyForSemaphoreCreatedUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/wait-momentarily-for-semaphore-created-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $this->expectOutputRegex("/(acquired semaphore: 0)/");
                $this->expectOutputRegex("/(acquired semaphore: 1)/");
                $m->spawn();
                delay(500);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testGetSemaphoreCreatedWithPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/get-semaphore-created-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $this->expectOutputRegex("/(acquired semaphore: 0)/");
                $this->expectOutputRegex("/(acquired semaphore: 1)/");
                $this->expectOutputRegex("/failed/");
                $m->spawn();
                delay(500);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testCreateKeyForThreadSpecificValuesUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-key-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $this->expectOutputRegex("/Destructor 1 called: anyopaque@12345/");
            $this->expectOutputRegex("/Destructor 2 called: anyopaque@67/");
            $this->expectOutputRegex("/Destructor 1 called: anyopaque@22222/");
            $m->startup();
            try {
                $m->spawn();
                delay(500);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testExitThreadNotCreatedUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/exit-thread-not-created-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            try {
                $m->spawn();
                delay(500);
            } finally {
                $m->shutdown();
            }
            $count = $m->getDestruction();
            $this->assertSame(1, $count);
        });
    }

    public function testCallFunctionOnceUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/call-function-once-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            $this->expectOutput(<<<OUTPUT
            Once upon a time...

            OUTPUT);
            try {
                $m->spawn();
                delay(500);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testCreateConditionUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-condition-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            $this->expectOutput(<<<OUTPUT
            Thread waiting for condition
            Thread waiting for condition
            Thread waiting for condition
            Thread saw condition
            Thread saw condition
            Thread saw condition

            OUTPUT);
            try {
                $m->spawn();
                delay(300);
                $m->signal();
                delay(200);
                $m->broadcast();
                delay(200);
            } finally {
                $m->shutdown();
            }
        });
    }

    public function testWaitMomentarilyForConditionCreatedUsingPthread(): void
    {
        $m = ZigImporter::load(__DIR__ . '/wait-momentarily-for-condition-created-with-pthread.zig');
        $this->inEventLoops([ 'revolt' ], function() use($m) {
            $m->startup();
            $this->expectOutputRegex("/saw/");
            $this->expectOutputRegex("/timed out/");
            try {
                $m->spawn();
                delay(250);
                $m->signal();
                delay(400);
            } finally {
                $m->shutdown();
            }
        });
    }
}
