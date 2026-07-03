<?php

// require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . '/scratch.zig');

$s = new $m->Struct(number1: 1234, number2: 4567);
$m->print($s);
