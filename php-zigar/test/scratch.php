<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

print_r($m->Type->__payload);
print_r($m->Type->__error_set);

$m = null;

gc_collect_cycles();
echo "gc completed\n";
