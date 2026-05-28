<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

$buffer = new $m->PtrVoid('Hello world!');
print_r($buffer->__typed_array);