<?php

// require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . '/scratch.zig');

// $number = $m->getNumber();
// echo "$number\n";

// $numbers = $m->getNumbers();
// print_r($numbers);

$list = $m->getList();
debug_zval_dump($list);

$m->shutdown();

print_r($m->names);
print_r($m->getNames());
