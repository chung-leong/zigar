<?php

$m = zigar_use(__DIR__ . '/scratch.zig');

$m->hello();
$m->__zigar->redirect('stderr', STDERR);
$m->hello();
$m->__zigar->redirect('stderr', fopen("php://output", 'w'));
$m->hello();
