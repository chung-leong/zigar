<?php

declare(strict_types = 1);

$module = zigar_load_module(__DIR__ . "/test/static-variables/lib/static.zigar");

$module->printX();
$module->printY();

$x = $module->x;
echo "x = ", $x->{'$'}, "\n";
$x->{'$'} = 4567;
echo $module->printX();
echo $module->y[2], "\n";
$module->y[3] = 1234;
$module->printY();
$y = $module->y;
$y[3] = 4567;
echo "len: ", count($y), "\n";
echo "0: ", isset($y[0]), "\n";
echo "12345: ", isset($y[12345]), "\n";
echo "cow: ", isset($y['cow']), "\n";
echo "3: ", isset($y[3]), "\n";
$module->printY();

$boolean = $module->boolean;
echo "boolean = ", $boolean->{'$'}, "\n";

echo "z = ", $module->z->{'$'}, "\n";
$z = $module->z;
$z->{'$'} = .1234;
$module->printZ();

$point = $module->point;
echo "x = ", $point->x, "\n";
echo "y = ", $point->y, "\n";
echo "z = ", $point->z, "\n";
