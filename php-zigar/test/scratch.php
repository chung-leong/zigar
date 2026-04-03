<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

// echo "Iterator:\n";
// foreach($m->get() as $key => $value) {
//     echo "$key = $value\n";
// }

// echo "Array:\n";
// foreach($m->array as $key => $value) {
//     echo "$key = $value\n";
// }

// echo "Struct:\n";
// foreach($m->struct_instance as $key => $value) {
//     echo "$key = $value\n";
// }

for ($i = 0; $i < 16; $i++) {
    echo $m->union_instance->number2, "\n";
}
