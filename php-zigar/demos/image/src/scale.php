<?php

$m = zigar_use(__DIR__ . '/../zig/scale.zig');

header('Content-Type: image/png');

$width = $_GET['w'] ?? 400;
$height = $_GET['h'] ?? 300;
$im_out = imagecreatetruecolor($width, $height);
$im_in = imagecreatefrompng(__DIR__ . '/sample.png');
$m->scale($im_in, $im_out);
imagepng($im_out);
