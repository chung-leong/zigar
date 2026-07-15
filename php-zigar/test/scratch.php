<?php

$m = zigar_use(__DIR__ . '/scratch.zig');

$m->hello();
$m->__zigar->redirect(2, STDERR);
$m->hello();
$m->__zigar->redirect(2, fopen("php://output"));
$m->hello();
