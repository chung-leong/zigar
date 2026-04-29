<?php declare(strict_types=1);

final class FunctionCallingTest extends ZigarTestCase
{   
    public function testThrowWhenFunctionReturnsAnError(): void
    {
        $m = ZigImporter::load(__DIR__ . '/throw-error.zig');
        $result = $m->returnNumber(1234);
        $this->assertSame(1234, $result);
        $this->assertExceptionMessage("system is on fire", function() use($m) {
            $m->returnNumber(0);
        });
    }

    public function testThrowWhenArgumentIsInvalid(): void
    {
        $m = ZigImporter::load(__DIR__ . '/accept-u8.zig');
        $this->assertExceptionMessage("incorrect argument count", function() use($m) {
            $m->accept1(1, 123);
        });
        // TODO: range check
    }

    public function testReturnSlice(): void
    {
        $m = ZigImporter::load(__DIR__ . '/return-slice.zig');
        $text = "This is a test and this is only a test!";
        $array = [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ];
        $result = $m->getSlice($array, 3, 8);
        $this->assertSame([4, 5, 6, 7, 8], (array) $result);
    }

    public function testReturnSliceOfSlices(): void
    {
        $m = ZigImporter::load(__DIR__ . '/return-slice-of-slices.zig');
        $text = "This is a test and this is only a test!";
        $array = [
            "Hello",
            "World",
            "Dingo",
        ];
        $result = $m->bounce($array);
        $this->assertSame("Hello", $result[0]->__string);
        $this->assertSame("World", $result[1]->__string);
        $this->assertSame("Dingo", $result[2]->__string);
    }

    public function testPrintSliceOfSlices(): void
    {
        $m = ZigImporter::load(__DIR__ . '/print-slice-of-slices.zig');
        $this->expectOutputString(<<<OUTPUT
        Hello
        World
        Dingo

        OUTPUT);

        $array = [
            "Hello",
            "World",
            "Dingo",
        ];
        $result = $m->print($array);
    }

    public function testReturnBooleanVector(): void
    {
        $m = ZigImporter::load(__DIR__ . '/return-bool-vector.zig');
        $a = [ true, true, true, true ];
        $b = [ true, true, false, true ];
        $c = [ false, false, false, false ];
        $this->assertSame(true, $m->all($a));
        $this->assertSame(false, $m->all($b));
        $this->assertSame(true, $m->any($a));
        $this->assertSame(true, $m->any($b));
        $this->assertSame(false, $m->any($c));
    }

    public function testAllocateSliceOfSlices(): void
    {
        $m = ZigImporter::load(__DIR__ . '/allocate-slice-of-structs.zig');
        $expected = [
            (object) [
                'vector1' => [ 0.7853981852531433, 1.5707963705062866, 2.356194496154785, 3.1415927410125732 ],
                'vector2' => [ 0.7853981633974483, 1.5707963267948966, 2.356194490192345, 3.141592653589793 ],
            ],
            (object) [
                'vector1' => [ 1.5707963705062866, 3.1415927410125732, 4.71238899230957, 6.2831854820251465 ],
                'vector2' => [ 0.39269908169872414, 0.7853981633974483, 1.1780972450961724, 1.5707963267948966 ],
            ],
            (object) [
                'vector1' => [ 2.356194496154785, 4.71238899230957, 7.0685834884643555, 9.42477798461914 ],
                'vector2' => [ 0.2617993877991494, 0.5235987755982988, 0.7853981633974483, 1.0471975511965976 ],
            ],
            (object) [
                'vector1' => [ 3.1415927410125732, 6.2831854820251465, 9.42477798461914, 12.566370964050293 ],
                'vector2' => [ 0.19634954084936207, 0.39269908169872414, 0.5890486225480862, 0.7853981633974483 ],
            ],
        ];
        $result1 = $m->allocate(4);
        $this->assertEquals($expected, $result1->__plain);
        $result2 = $m->allocateNoError(4);
        $this->assertEquals($expected, $result2->__plain);
        $result3 = $m->allocateOptional(4);
        $this->assertEquals($expected, $result3->__plain);
    }

    public function testGettersSetters(): void
    {
        $m = ZigImporter::load(__DIR__ . '/attach-getters-setters.zig');
        $this->assertSame(123, $m->cow);
        $m->cow = 456;
        $this->assertSame(456, $m->cow);
        $this->assertSame(100, $m->Hello->something);
        $m->Hello->something = 200;
        $this->assertSame(200, $m->Hello->something);

        $object = new $m->Hello(dog: 3, cat: 7);
        $this->assertSame(10, $object->both);

        $this->expectOutputString(<<<OUTPUT
        something = 200
        stdClass Object
        (
            [cat] => 7
            [dog] => 3
            [both] => 10
        )

        OUTPUT);
        $m->Hello->printSomething();      
        print_r($object->__plain);
    }

    public function testReturnSelfReferencingStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/return-self-referencing-struct.zig');
        $ptr = $m->getStruct();
        $object1 = $ptr->{'*'};
        $object2 = $object1->self->{'*'};
        $this->assertSame($object1, $object2);
    }

    public function testReturnSameStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/return-same-struct.zig');
        $object1 = new $m->Struct(number1: 5, number2: 55);
        $ptr = $m->echo($object1);
        $object2 = $ptr->{'*'};
        $this->assertSame($object1, $object2);
    }

    public function testChangePointerTarget(): void
    {
        $m = ZigImporter::load(__DIR__ . '/change-pointer-target.zig');
        $this->assertSame(123, $m->number_ptr->{'*'});
        $this->expectOutputString(<<<OUTPUT
        odd = 123, even = 456
        odd = 777, even = 456
        odd = 777, even = 888

        OUTPUT);
        $m->print();
        $m->number_ptr->{'*'} = 777;
        $m->print();
        $m->change(true);
        $this->assertSame(456, $m->number_ptr->{'*'});
        $m->number_ptr->{'*'} = 888;
        $m->print();
    }

    public function testCallMethods(): void
    {
        $m = ZigImporter::load(__DIR__ . '/allow-method-calls.zig');
        $a = new $m->Struct(number: 123);
        $b = new $m->Struct(number: 456);
        $this->expectOutputString(<<<OUTPUT
        .{ .number = 123 }
        .{ .number = 456 }
        .{ .number = 123 }
        .{ .number = 456 }

        OUTPUT);
        $a->print1();
        $b->print1();
        $a->print2();
        $b->print2();

        $a->add(7);
        $this->assertSame(130, $a->number);
        $b->add(4);
        $this->assertSame(460, $b->number);
    }

    public function testCallInlineFunction(): void {
        $m = ZigImporter::load(__DIR__ . '/call-inline-function.zig');
        $this->expectOutputString(<<<OUTPUT
        Hello world!

        OUTPUT);
        $m->print();
    }

    public function testHandlePointerInStruct(): void {
        $m = ZigImporter::load(__DIR__ . '/handle-pointer-in-struct.zig');
        $user = new $m->User(name: 'Alice');
        $this->expectOutputString(<<<OUTPUT
        Alice
        Alice
        Alice
        Bob
        Bob
        Bob

        OUTPUT);
        $user->print1();
        $user->print2();
        $user->print3();
        $user->name = 'Bob';
        $user->print1();
        $user->print2();
        $user->print3();
    }

    public function testHandleRecursiveStructure(): void {
        $m = ZigImporter::load(__DIR__ . '/handle-recursive-structure.zig');
        $root = $m->getRoot();
        $parent = $root->__plain;
        list($child1, $child2) = $parent->children;
        $this->assertSame($parent, $child1->parent);
        $this->assertSame($parent, $child2->parent);
    }

    public function testReturnConstPointer(): void {
        $m = ZigImporter::load(__DIR__ . '/return-const-pointer.zig');
        $user = $m->getUser();
        $this->assertExceptionMessage("write protected", function() use($user) {
            $user->age = 18;
        });
        $this->assertExceptionMessage("write protected", function() use($user) {
            $user->name = 'Jesus Christ';
        });
        $this->assertExceptionMessage("write protected", function() use($user) {
            $user->address->street = 'Nowhere';
        });
        $this->assertExceptionMessage("write protected", function() use($user) {
            $user->address->zip = 33333;
        });
    }

    public function testAcceptMultiplePointers(): void {
        $m = ZigImporter::load(__DIR__ . '/accept-multi-pointer.zig');
        $list = [
            [ 'a' => 1, 'b' => 2 ],
            [ 'a' => 3, 'b' => 4 ],
            [ 'a' => 5, 'b' => 6 ],
            [ 'a' => 7, 'b' => 8 ],
        ];
        $this->expectOutputString(<<<OUTPUT
        .{ .a = 1, .b = 2 }
        .{ .a = 3, .b = 4 }
        .{ .a = 5, .b = 6 }
        .{ .a = 7, .b = 8 }

        OUTPUT);
        $m->print($list, count($list));
    }

    public function testAcceptCPointers(): void {
        $m = ZigImporter::load(__DIR__ . '/accept-c-pointer.zig');
        $list = [
            [ 'a' => 1, 'b' => 2 ],
            [ 'a' => 3, 'b' => 4 ],
            [ 'a' => 5, 'b' => 6 ],
            [ 'a' => 7, 'b' => 8 ],
        ];
        $this->expectOutputString(<<<OUTPUT
        .{ .a = 1, .b = 2 }
        .{ .a = 3, .b = 4 }
        .{ .a = 5, .b = 6 }
        .{ .a = 7, .b = 8 }
        .{ .a = 5, .b = 6 }
        .{ .a = 9, .b = 10 }

        OUTPUT);
        $m->print($list, count($list));
        $m->print($list[2], 1);
        $object = new $m->Object(a: 9, b: 10);
        $m->print([ $object ], 1);
    }

    public function testReturnMultiplePointers(): void {
        $m = ZigImporter::load(__DIR__ . '/return-multi-pointer.zig');
        $pointer = $m->getPointer();
        $this->assertSame(1, $pointer->__len);
        $this->assertEquals([
            (object) [ 'a' => 0, 'b' => 1 ]
        ], $pointer->__plain);
        $pointer->__len = 5;
        $this->assertEquals([
            (object) [ 'a' => 0, 'b' => 1 ],
            (object) [ 'a' => 2, 'b' => 3 ],
            (object) [ 'a' => 4, 'b' => 5 ],
            (object) [ 'a' => 6, 'b' => 7 ],
            (object) [ 'a' => 8, 'b' => 9 ],
        ], $pointer->__plain);
        $this->assertExceptionMessage("out of bound", function() use ($pointer) {
            $pointer->__len = 6;
        });
        $pointer->__len = 3;
        $this->assertEquals([
            (object) [ 'a' => 0, 'b' => 1 ],
            (object) [ 'a' => 2, 'b' => 3 ],
            (object) [ 'a' => 4, 'b' => 5 ],
        ], $pointer->__plain);
    }

    public function testReturnCPointers(): void {
        $m = ZigImporter::load(__DIR__ . '/return-c-pointer.zig');
        $pointer = $m->getPointer();
        $this->assertSame(1, $pointer->__len);
        $this->assertEquals([
            (object) [ 'a' => 0, 'b' => 1 ]
        ], $pointer->__plain);
        $pointer->__len = 5;
        $this->assertEquals([
            (object) [ 'a' => 0, 'b' => 1 ],
            (object) [ 'a' => 2, 'b' => 3 ],
            (object) [ 'a' => 4, 'b' => 5 ],
            (object) [ 'a' => 6, 'b' => 7 ],
            (object) [ 'a' => 8, 'b' => 9 ],
        ], $pointer->__plain);
        $this->assertExceptionMessage("out of bound", function() use ($pointer) {
            $pointer->__len = 6;
        });
        $pointer->__len = 3;
        $this->assertEquals([
            (object) [ 'a' => 0, 'b' => 1 ],
            (object) [ 'a' => 2, 'b' => 3 ],
            (object) [ 'a' => 4, 'b' => 5 ],
        ], $pointer->__plain);
        $str = $m->getString();
        $this->assertSame('Hello world', $str->__string);
    }

    public function testModifyPointerTarget(): void {
        $m = ZigImporter::load(__DIR__ . '/modify-pointer-target.zig');
        $actor = new $m->Actor(name: 'Arnold Schwarzenegger', age: 77);
        $this->assertSame(77, $actor->age);
        $m->deage($actor, 40);
        $this->assertSame(37, $actor->age);
    }

    public function testCallCFunctions(): void {
        $m = ZigImporter::load(__DIR__ . '/call-c-functions.zig');
        $this->expectOutputString(<<<OUTPUT
        Hello world
        Hello world!
        Hello?
        Hello world

        OUTPUT);
        $str1 = "Hello world";
        $m->puts($str1);
        $stderr = $m->stream(2);
        $str2 = "Hello world!\n";
        $m->fwrite($str2, 1, strlen($str2), $stderr);
        $stdout = $m->stream(1);
        $str3 = "Hello?";
        $m->fwrite($str3, 1, strlen($str3), $stdout);
        $m->fflush($stdout);
        $m->fwrite("\n", 1, 1, $stdout);
        $str4 = "Hello world";
        $m->puts($str4);
    }
}
