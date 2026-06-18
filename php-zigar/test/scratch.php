<?php

require __DIR__ . '/../vendor/autoload.php';
use Revolt\EventLoop;

$m = zigar_use(__DIR__ . '/scratch.zig');

$test = function() use($m) {
    $m->startup();

    $result1 = $m->spawn1(function() use($m) {
        $result2 = $m->spawn2();
        echo "result2 = $result2\n";
    });
    echo "result1 = $result1\n";

    $m->shutdown();
};

ini_set('zigar.event_loop', 'revolt');
EventLoop::defer($test);
EventLoop::run();

ini_set('zigar.event_loop', 'temporary');
$test();
