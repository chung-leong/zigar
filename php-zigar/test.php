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

echo "ci = $module->ci\n";
echo "cf = $module->cf\n";

