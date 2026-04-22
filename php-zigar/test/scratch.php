<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

echo $m->error_union1, "\n";

$hello = function() use($m) {
    try {
        $x = $m->error_union2;
    } catch (Exception $e) {
        echo "$e\n";
    }
};
$hello();

// $m = null;
gc_collect_cycles();
echo "gc completed\n";

