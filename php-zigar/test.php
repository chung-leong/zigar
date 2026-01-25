<?php

declare(strict_types = 1);

$module = zigar_load_module(__DIR__ . "/test/static-variables/lib/static.zigar");

// echo $module->array[2], "\n";
// foreach ($module->array as $a) {
//     echo "a = $a\n";
// }
// $module->array[2] = 1234;
// $module->printArray();
// $array = $module->array;
// $array[2] = 1234;
// $module->printArray();

// echo "optional = $module->optional\n";
// $module->optional = null;
// echo "optional = $module->optional\n";
// $module->optional = 4567;
// echo "optional = $module->optional\n";

// $module->printX();
// echo "x = ", $module->x, "\n";
// $module->x = 4567;
// $module->printX();

// $module->printY();
// echo $module->y[2], "\n";
// $module->y[3] = 1234;
// $module->printY();

// $y = $module->y;
// $y[3] = 4567;
// $module->printY();

// echo "len: ", count($y), "\n";
// echo "0: ", isset($y[0]), "\n";
// echo "12345: ", isset($y[12345]), "\n";
// echo "cow: ", isset($y['cow']), "\n";
// echo "3: ", isset($y[3]), "\n";

// echo "boolean = ", $module->boolean, "\n";

// $module->printZ();
// echo "z = ", $module->z, "\n";
// $module->z = .1234;
// $module->printZ();

// $point = $module->point;
// echo "x = ", $point->x, "\n";
// echo "y = ", $point->y, "\n";
// echo "z = ", $point->z, "\n";

// echo "ci = $module->ci\n";
// echo "cf = $module->cf\n";
// echo "module_enum = $module->enum_literal\n";
// echo "enum_literal = $module->enum_literal\n";

// echo "null_value = $module->null_value\n";
// echo "undefined_value = $module->undefined_value\n";

// echo "{$module->number->float}\n";
// debug_zval_dump($module->color);
// $Color = $module->Color;
// echo "red? ", $Color->red === $module->color, "\n";
// $module->color = 'blue';
// echo "blue? ", $Color->blue === $module->color, "\n";
// $module->color = 2;
// echo "green? ", $Color->green === $module->color, "\n";
// $module->color = $Color->red;
// echo "red? ", $Color->red === $module->color, "\n";

// $ErrorSet = $module->ErrorSet;
// echo $ErrorSet->PantsOnFire->getMessage(), "\n";
// echo $ErrorSet->PantsOnFire->getCode(), "\n";

// echo "pants on fire? ", $module->error_value === $ErrorSet->PantsOnFire, "\n";
// echo "hello world? ", $module->error_value === $ErrorSet->HelloWorld, "\n";
// $ex = new Exception("hello world");
// $module->error_value = $ex;
// echo $module->error_value->getMessage(), "\n";
// echo "hello world? ", $module->error_value === $ErrorSet->HelloWorld, "\n";

// try {
//     echo $module->problematic1, "\n";
// } catch (ZigError $e) {
//     switch ($e) {
//         case $module->ErrorSet->PantsOnFire: 
//             echo "Pants on fire!\n";
//     }
//     echo $e, "\n";
// }

// $module->fail();

// echo $module->problematic2, "\n";
// $module->problematic2 = $module->ErrorSet->HelloWorld;
// echo $module->problematic2, "\n";

echo $module->extern_union->integer, "\n";