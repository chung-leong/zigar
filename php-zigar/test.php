<?php

$module = zigar_load_module(__DIR__ . "/test/hello.zigar/linux.x64.so");
echo $module->world, "\n";
debug_zval_dump($module);

$obj = new $module;
echo $obj->hello, "\n";
debug_zval_dump($obj);
