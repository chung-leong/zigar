<?php

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

echo $m->string, "\n";
echo "{$m->plain_array}\n";

print_r($m->string);
print_r($m->plain_array);
