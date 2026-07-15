<?php

$m = zigar_use(__DIR__ . '/scratch.zig');

$m->redirect(2, STDERR);
$m->hello();

echo "Hello world\n";
