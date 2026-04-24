<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

debug_zval_dump($m->struct_b);
$b = $m->struct_b->__plain;
debug_zval_dump($b);
print_r($b);
debug_zval_dump($m->struct_b);
$b = null;
$m = null;

gc_collect_cycles();
echo "gc completed\n";

