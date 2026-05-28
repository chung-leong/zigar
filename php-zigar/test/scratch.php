<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

$buffer = new $m->PtrVoid('Hello world!');
echo count($buffer), "\n";
echo $buffer[0], "\n";
print_r($buffer->__typed_array);
