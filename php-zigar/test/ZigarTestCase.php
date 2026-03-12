<?php declare(strict_types=1);
use PHPUnit\Framework\TestCase;

abstract class ZigarTestCase extends TestCase
{
	protected function assertExceptionMessage(string $expectedMessage, callable $callback)
	{
		try {
			$callback();
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
}