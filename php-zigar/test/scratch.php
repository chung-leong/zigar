<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

$m = zigar_use(__DIR__ . '/scratch.zig');

ini_set('zigar.event_loop', 'revolt');

EventLoop::defer(function() use($m) {
    $m->startup();
    $m->spawn(function() {
        echo "Hello world!\n";
    });
    print_r($file);
});

EventLoop::repeat(0.1, function($callbackId) use($m) {
    static $i = 0;

    if ($i++ < 10) {
        echo "tick\n";
    } else {
        $m->shutdown();
        EventLoop::cancel($callbackId);
    }
});

EventLoop::run();