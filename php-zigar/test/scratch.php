<?php

require __DIR__ . '/../vendor/autoload.php';
// use Revolt\EventLoop;

$m = zigar_use(__DIR__ . "/scratch.zig");

echo $m->ErrorSet->DingoAteBaby, "\n";
echo $m->ErrorSet('dingo ate baby'), "\n";
echo $m->Enum('alpha'), "\n";
