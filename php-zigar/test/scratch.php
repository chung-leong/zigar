<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

$m->optional = false;
$m->print();
$m->optional = true;
$m->print();
$m->optional = null;
$m->print();

$m = null;

gc_collect_cycles();
echo "gc completed\n";
