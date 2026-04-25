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
        $object1 = $m->getStruct();
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
}
