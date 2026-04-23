<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

echo $m->optional, "\n";
$m->optional = $m->alt_text;
$m->print();
echo $m->optional, "\n";

$m = null;
gc_collect_cycles();
echo "gc completed\n";

