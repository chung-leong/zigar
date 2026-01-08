<?php

debug_zval_dump(zigar_load_module(__DIR__ . "/test/hello.zigar/linux.x64.so"));

$name = 'zigar_class_1';
$obj = new $name;