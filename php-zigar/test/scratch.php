<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

try {
    $m->returnInt(callback: function($arg) {
        echo "arg = $arg\n";
    });
    $m->returnInts(callback: function($arg) {
        echo "arg = $arg\n";
    });
} catch (Exception $e) {
    $m->shutdown();
}