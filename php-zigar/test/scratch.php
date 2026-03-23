<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

$m->startup();
try {
    $retval = $m->get(1234);
    echo "retval = $retval\n";
    $retval = $m->get(12345);
    echo "retval = $retval\n";
    $retval = $m->get(0);
    echo "retval = $retval\n";
} finally {
    $m->shutdown();
}

// EventLoop::run();
