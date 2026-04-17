<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

$obj = $m->create();
echo $obj->number, "\n";
echo $obj->__target->number, "\n";
echo $obj->{'*'}->number, "\n";
$obj->number = 4567;
echo $obj->number, "\n";
$obj = null;
$m = null;

gc_collect_cycles();
echo "gc completed\n";
