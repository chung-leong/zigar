<?php

$module = zigar_load_module(__DIR__ . "/test/static-variables/lib/static.zigar");
echo $module->printX();
echo $module->printY();

$x = $module->x;
echo $x->{'$'}, "\n";
$x->{'$'} = 4567;
echo $module->printX();
