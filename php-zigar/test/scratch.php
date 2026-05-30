<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

echo "Before: ";
print_r($m->ptr->{'*'});
$m->ptr->__length = 5;
echo "After: ";
print_r($m->ptr->{'*'});
$m->ptr->__length = 10;
echo "Restored: ";
print_r($m->ptr->{'*'});
