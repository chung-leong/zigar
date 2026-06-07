<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

$m->call(function($allocator) {
    return $allocator->dupe('Hello world');
});
