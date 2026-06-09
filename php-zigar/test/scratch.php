<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

zigar_compile(__DIR__ . "/scratch.zig", __DIR__ . "/../lib2/scratch.zigar");
// $m = zigar_use(__DIR__ . "/scratch.zig");
zigar_import(__DIR__ . "/../lib2/scratch.zigar");

callp(function($n) {
    echo "n = $n\n";
    return 'Hello world?';
});

callg(function($n) {
    echo "n = $n\n";
    yield 'Hello world!';
    yield 'This is a test!';
});
