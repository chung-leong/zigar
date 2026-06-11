<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

// $m->call(function() {
//     return 'Hello world';
// });
$m->call(function($callback) {
    $callback('Hello world');
});
// $m->call(function($allocator, $callback) {
//     $callback($allocator->dupe('Hello world'));
// });
