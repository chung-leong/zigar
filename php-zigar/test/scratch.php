<?php

// require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . '/scratch.zig');

// $number = $m->getNumber();
// echo "$number\n";

$numbers = $m->getNumbers();
print_r($numbers);

// $list = $m->getList();
// echo "Got list\n";
// print_r($list);

$m->shutdown();
