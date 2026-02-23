<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

$b = new $m->Struct([ 'number1' => 1234 ]);
print_r($b);

$m->print();
$m->struct_var = $b;
$m->print();
