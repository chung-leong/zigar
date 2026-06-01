<?php

$m = zigar_use(__DIR__ . '/../zig/sepia.zig');

header('Content-Type: image/png');

$intensity = $_GET['i'] ?? 0.3;
$im_in = imagecreatefrompng(__DIR__ . '/sample.png');
$im_out = imagecreatetruecolor(imagesx($im_in), imagesy($im_in));
$m->apply($im_in, $im_out, $intensity);
imagepng($im_out);
