<?php

// require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . '/scratch.zig');

$a = $m->getAllocator();
$slice = $m->allocate(64, allocator: $a);
print_r($slice);

$buf = $a->alloc(128);
print_r($buf);
$a->free($buf);

