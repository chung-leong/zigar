<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

// print_r($m->union_a);

$a = new $m->Bool(true);
echo (boolean) $a, "\n";

$c = $m->Bool("\x00");

$a = null;
$c = null;
$m = null;

gc_collect_cycles();
echo "gc completed\n";
