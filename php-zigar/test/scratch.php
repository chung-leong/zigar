<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

// $m = zigar_use(__DIR__ . '/scratch.zig', [ 'Hello' => 5 ]);
// print_r($m->struct_a);
// $m->print();

// $a = new ArrayBuffer(5);
// print_r($a);
// echo $a->byteLength, "\n";
// // $ta = new TypedArray();
// // print_r($ta);
// $ta = new Int32Array([ 1, 2, 3, 4, 5]);
// echo $ta[3], "\n";
// print_r($ta);

zigar_test([ 'number1' => 123, 'number2' => [ 1, 3, 9, 23 ] ]);