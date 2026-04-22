<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

print_r((array) $m->struct_a);
$b = new $m->StructA();
print_r((array) $b);

$m->print();
$m->struct_a = $b;
$m->print();

// $b = null;
$m = null;
gc_collect_cycles();
echo "gc completed\n";

