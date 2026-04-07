<?php

require __DIR__ . '/../vendor/autoload.php';

use Revolt\EventLoop;

zigar_compile_module(__DIR__ . "/scratch.zig", "/tmp/scratch.zigar");
$m = zigar_load_module("/tmp/scratch.zigar");

echo "Iterator:\n";
foreach($m->get() as $key => $value) {
    echo "$key = $value\n";
}

echo "Array:\n";
foreach($m->array as $key => $value) {
    echo "$key = $value\n";
}

echo "Vector:\n";
foreach($m->vector as $key => $value) {
    echo "$key = $value\n";
}

echo "Slice:\n";
foreach($m->slice as $key => $value) {
    echo "$key = $value\n";
}

echo "Struct:\n";
foreach($m->struct_instance as $key => $value) {
    echo "$key = $value\n";
}
echo $m->struct_instance->average, "\n";
$m->struct_instance->average = 100;
print_r($m->struct_instance);

echo "Union:\n";
foreach($m->union_instance as $key => $value) {
    echo "$key = $value\n";
}

echo "Bare union:\n";
foreach($m->bare_union_instance as $key => $value) {
    echo "$key = $value\n";
}

echo "Union pointer:\n";
$ptr = new $m->UnionPtr($m->union_instance);
foreach($ptr as $key => $value) {
    echo "$key = $value\n";
}

echo "Namespace:\n";
foreach($m->namespace as $key => $value) {
    echo "$key = $value\n";
}
echo "world = {$m->namespace->hello}\n";
$m->namespace->hello += 25;
echo "world = {$m->namespace->hello}\n";

echo "value = {$m->opaque_ptr->number}\n";
$m->opaque_ptr->number += 11;
echo "value = {$m->opaque_ptr->number}\n";

echo "value = {$m->Enum->cow->number}\n";
$m->Enum->pig->number += 11;
echo "value = {$m->Enum->pig->number}\n";
