<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

// zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
// $m = zigar_load_module("/tmp/scratch.zigar");

// $buf = new ArrayBuffer(16);
// print_r($buf);
// echo $buf, "\n";
// $buf = null;
$ta = new Float16Array(4);
$ta[2] = 1234;
$ta[3] = 4567;
// print_r((array) $ta);
// print_r($ta);
// echo $ta[2], "\n";
// print_r((array) $ta);

gc_collect_cycles();
echo "gc completed\n";
