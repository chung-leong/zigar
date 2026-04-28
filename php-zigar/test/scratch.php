<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

$m->printIntegers(32, 3, 
    new $m->Int32(123),
    new $m->Int32(456),
    new $m->Int32(789),
);

gc_collect_cycles();
echo "gc completed\n";
