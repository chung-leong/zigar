<?php

// require __DIR__ . '/../vendor/autoload.php';

// use Revolt\EventLoop;

// zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
// $m = zigar_load_module("/tmp/scratch.zigar");

$str = str_repeat("Hello world", 2);
$b = new ArrayBuffer($str, true);
debug_zval_dump($str);

gc_collect_cycles();
echo "gc completed\n";
