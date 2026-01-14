<?php

$module = zigar_load_module(__DIR__ . "/test/hello/lib/hello.zigar/linux.x64.so");
echo $module->world, "\n";
$module->hello();
// debug_zval_dump($module);

$obj = new $module;
debug_zval_dump($obj);
