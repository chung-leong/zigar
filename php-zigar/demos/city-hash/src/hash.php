<?php

$m = zigar_use(__DIR__ . '/../zig/hash.zig');

$hash = $m->hash("Hello world");
echo $hash;