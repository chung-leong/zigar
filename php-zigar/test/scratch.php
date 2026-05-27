<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

echo $m->ErrorSet->DingoAteBaby, "\n";

try {
    $m->hello();
} catch (Exception $e) {
    echo "$e\n"; 
    echo $e == "pants on fire\n";
}
