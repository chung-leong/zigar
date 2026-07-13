<?php

require __DIR__ . '/../vendor/autoload.php';
use Revolt\EventLoop;

$m = zigar_use(__DIR__ . '/scratch.zig');

ini_set('zigar.event_loop', 'revolt');
EventLoop::defer(function() use($m) {
    $m->startup();
    try {
        $count = 0;
        $m->spawn(function() use (&$count) {
            echo "Hello\n";
            $count++;
        });
        delay(200);
        echo "count = $count\n";
    } finally {
        $m->shutdown();
    }
});
EventLoop::run();

function delay($ms) {
    $suspension = EventLoop::getSuspension();
    EventLoop::delay($ms / 1000, function() use($suspension) {
        $suspension->resume();
    });
    $suspension->suspend();
}
