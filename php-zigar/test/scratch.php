<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

$m->calla(function($n, $allocator) {
    echo "n = $n\n";
    return $allocator->dupe("This is a test");
});

$m->callp(function($n, $callback) {
    echo "n = $n\n";
    $callback('Hello world?');
});

$m->callg(function($n, $callback) {
    echo "n = $n\n";
    echo $result = $callback('Hello world!');
    echo "result = $result\n";
});
