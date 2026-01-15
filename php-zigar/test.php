<?php

$module = zigar_load_module(__DIR__ . "/test/hello/lib/hello.zigar/linux.x64.so");
for ($i = 0; $i < 3; $i++) {
    echo $module->world, "\n";
}
$module->hello();
debug_zval_dump($module);

$obj = new $module;
for ($i = 0; $i < 3; $i++) {
    echo $module->foo, "\n";
}
debug_zval_dump($obj);
