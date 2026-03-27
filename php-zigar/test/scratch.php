<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

$m->startup();
try {
    foreach($m->get() as $item) {
        echo "item = $item\n";
    }
} catch (Throwable $e) {
    echo $e->getMessage(), "\n";
} finally {
    $m->shutdown();
}

// EventLoop::run();
