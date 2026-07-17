<?php

$m = zigar_use(__DIR__ . '/scratch.zig');

$strm = fopen("php://memory", 'w');
$m->read($strm);
print_r($strm);
fclose($strm);
