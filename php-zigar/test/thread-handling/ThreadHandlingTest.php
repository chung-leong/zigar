<?php declare(strict_types=1);

use Revolt\EventLoop;

final class ThreadHandlingTest extends ZigarTestCase
{   
    public function testSpawnThreadsAndInvokeCallback(): void
    {
        ini_set('zigar.event_loop', 'revolt');
        $m = ZigImporter::load(__DIR__ . '/create-thread-call-function.zig');
        $this->expectOutputString(<<<OUTPUT
        callback
        ok

        OUTPUT);
        EventLoop::defer(function() use ($m) {
            $m->startup();            
            $m->spawn(function() {
                echo "callback\n";
            });
            EventLoop::delay(0.1, function() use($m) {
                echo "ok\n";
                $m->shutdown();
            });
        });
        EventLoop::run();
    }   

    public function testCreateThreadThatResolvesAPromise(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-thread-with-promise.zig');
        $m->startup();
        $result1 = $m->spawn();
        $this->assertSame(1234, $result1);
        $result2 = $m->spawn();
        $this->assertSame(1234, $result2);
    }

    public function testReceiveStringFromPromise(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-thread-with-string-promise.zig');
        $m->startup();
        $result = $m->spawn();
        $this->assertSame('Hello world', $result);
    }

    public function testReceivePlainObjectFromPromise(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-thread-with-plain-object-promise.zig');
        $m->startup();
        $result = $m->spawn();
        $this->assertEquals((object) [ 'x' => 123, 'y' => 456 ], $result);
    }

    public function testCreateThreadOrImmediatelyProvideValue(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-thread-optionally.zig');
        $m->startup();
        $result1 = $m->spawn(true);
        $this->assertSame(1234, $result1);
        $result2 = $m->spawn(false);
        $this->assertSame(777, $result2);
    }

    public function testRejectPromiseSynchronously(): void
    {
        $m = ZigImporter::load(__DIR__ . '/create-thread-promise-failure.zig');
        $this->assertExceptionMessage('thread creation failure', function() use($m) {
            $x = $m->spawn();
        });
    }   
}
