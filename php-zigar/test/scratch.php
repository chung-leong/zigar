<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

$hello = new $m->Hello(number1: 1000, number2: 2000);
$base64 = $hello->__base64;
$hello_copy = new $m->Hello(__base64: $base64);
print_r($hello);
print_r($hello_copy);
