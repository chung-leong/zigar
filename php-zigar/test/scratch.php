<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

$a = $m->allocator->dupe("Hello world!");
print_r($a);
$m->allocator->free($a);

$ab = $m->allocator->alloc(60, 4);
$ta = new Uint8Array($ab);
$ta[3] = 3;
print_r($ab);
$m->allocator->free($ab);
