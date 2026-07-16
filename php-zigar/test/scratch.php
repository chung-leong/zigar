<?php

$m = zigar_use(__DIR__ . '/scratch.zig');

$text = "My hovercraft is full of eels";
echo $m->sha($text), "\n";
echo $m->sha($text, version: 2), "\n";
echo $m->sha($text, version: 1), "\n";
echo $m->sha($text, version: 3, uppercase: true), "\n";
