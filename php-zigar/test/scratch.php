<?php

// require __DIR__ . '/../vendor/autoload.php';

// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . '/scratch.zig');

$m->startup();
try {
    $generator = $m->spawn();
    $list = [];
    foreach ($generator as $s) {
        echo $s, "\n";
        // $list[] = $s;
        // break;
    }
    $generator = null;
} finally {
    $m->shutdown();
}

$m = null;
gc_collect_cycles();
echo "[GC COMPLETE]\n";