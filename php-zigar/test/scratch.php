<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_compile(__DIR__ . "/scratch.zig");
$m = zigar_use(__DIR__ . "/scratch.zig");

$m->callp(function($n) {
    echo "n = $n\n";
    return 'Hello world?';
});

$m->callg(function($n) {
    echo "n = $n\n";
    yield 'Hello world!';
    yield 'This is a test!';
});
