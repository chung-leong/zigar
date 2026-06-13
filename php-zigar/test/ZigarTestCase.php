<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;
use Revolt\EventLoop;

abstract class ZigarTestCase extends TestCase
{
	protected function assertExceptionMessage(string $expectedMessage, callable $callback)
	{
		// make sure the callback gets gc'ed properly
		$cb = $callback;
		$callback = null;
		try {
			$cb();
		} catch (\Exception $e) {
			$class = get_class($e);
			$message = $e->getMessage();
			$code = $e->getCode();

			$errorMessage = 'Failed asserting the class of exception';
			if ($message && $code) {
				$errorMessage .= sprintf(' (message was %s, code was %d)', $message, $code);
			} elseif ($code) {
				$errorMessage .= sprintf(' (code was %d)', $code);
			}
			$errorMessage .= '.';

            $this->assertStringContainsString($expectedMessage, $message);
			return;
		}

		$errorMessage = 'Failed asserting that exception was thrown.';
		$this->fail($errorMessage);
	}

    protected function inEventLoops($event_loops, $cb) {
        foreach ($event_loops as $loop) {
            ini_set('zigar.event_loop', $loop);
            if ($loop == 'revolt') {
                EventLoop::defer($cb);
                EventLoop::setErrorHandler(function($e) use (&$exception) {
                    $exception = $e;
                });
                EventLoop::run();
                if ($exception) throw $exception;
            } else {
                $cb();
            }
        }
    }
}

function delay($ms) {
    $suspension = EventLoop::getSuspension();
    EventLoop::delay($ms / 1000, function() use($suspension) {
        $suspension->resume();
    });
    $suspension->suspend();
}

function timeout($cb, $ms) {
   EventLoop::delay($ms / 1000, function() use($cb) {
       $cb();
   });
}