<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

$img = imagecreatetruecolor(640, 480);
$color = imagecolorallocatealpha($img, 0, 0xAA, 0xAA, 0x44);
imagefilledrectangle($img, 0, 0, 600, 400, $color);

$m->printInfo($img);
