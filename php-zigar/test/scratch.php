<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

$struct = new $m->Struct([
    'elements' => [
        [ 'number1' => 10, 'number2' => 20 ],
        [ 'number1' => 100, 'number2' => 200 ],
        [ 'number1' => 1000, 'number2' => 2000 ],
    ],
    'text' => "Hello world",
], allocator: $m->allocator);
print_r($struct);
$m->free($struct);
