<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

ini_set('zigar.event_loop', 'revolt');
EventLoop::defer(function() {
    $m = zigar_use(__DIR__ . '/scratch.zig');
    $m->startup(4);
    try {
        $m->print(getcwd(), callback: function($number) {
            echo "callback => $number\n";
        });
    } finally {
        $m->shutdown();
    }
    flush();
});
EventLoop::run();

