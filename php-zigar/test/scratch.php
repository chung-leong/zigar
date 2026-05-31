<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

$pixels = new $m->Pixels([ [ 255, 255, 255, 255 ], [ 0, 0, 0, 0 ] ]);
print_r($pixels->__typed_array);
// print_r($pixels->__clamped_array);
