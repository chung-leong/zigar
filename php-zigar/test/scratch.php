<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

$m->print();
$m->error_union = new Exception('goldfish died');
$m->print();
$m->error_union = new Exception('no money');
$m->print();
$m->error_union = false;
$m->print();

$m = null;

gc_collect_cycles();
echo "gc completed\n";
