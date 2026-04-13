<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

echo $m->print1(), "\n";
print_r($m->array2);
$m->array2 = [ 12, 34, 56, 78 ];
echo $m->print2(), "\n";
$m->array3 = [ 1234, 5678, 12345, 67890 ];
for ($i = 0; $i < 4; $i++) {
    echo $m->array3[$i], "\n";
}
echo $m->print3(), "\n";

$m = null;
gc_collect_cycles();
echo "gc finished\n";