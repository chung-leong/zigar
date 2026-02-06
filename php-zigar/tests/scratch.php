<?php

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

echo $m->int, "\n";
echo $m->int_ptr, "\n";

$m->int_ptr = 12345;

echo $m->int, "\n";
