<?php

require __DIR__ . '/../vendor/autoload.php';

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

debug_zval_dump($m->ptr_a === $m->ptr_b);
debug_zval_dump($m->ptr_a === $m->ptr_c);
debug_zval_dump($m->ptr_b === $m->ptr_d);
echo "a = $m->ptr_a\n";
echo "b = $m->ptr_b\n";
