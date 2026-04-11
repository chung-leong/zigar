<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

echo $m->utf16, "\n";
echo $m->utf16_slice, "\n";

$m->utf16 = "hello";
echo $m->utf16_slice, "\n";

$m->utf16 = "część!";

echo $m->utf16_slice, "\n";

$m = null;
gc_collect_cycles();
echo "gc finished\n";