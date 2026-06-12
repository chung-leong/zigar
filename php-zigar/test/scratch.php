<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

// $m = zigar_use(__DIR__ . "/scratch.zig");
$m = zigar_use(__DIR__ . '/function-pointer/release-function-pointer.zig');

$f = function() {
    echo "Hello world!\n";
};
$m->set($f);
$m->call();
// $m->release();
$f();
