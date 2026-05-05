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

    public function testCallInlineFunction(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/call-inline-function.zig');
        $this->expectOutputString(<<<OUTPUT
        Hello world!

        OUTPUT);
        $m->print();
    }

    public function testHandlePointerInStruct(): void 
    {
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

    public function testHandleRecursiveStructure(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/handle-recursive-structure.zig');
        $root = $m->getRoot();
        $parent = $root->__plain;
        list($child1, $child2) = $parent->children;
        $this->assertSame($parent, $child1->parent);
        $this->assertSame($parent, $child2->parent);
    }

    public function testReturnConstPointer(): void 
    {
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

    public function testAcceptMultiplePointers(): void 
    {
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

    public function testAcceptCPointers(): void 
    {
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

    public function testReturnMultiplePointers(): void 
    {
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

    public function testReturnCPointers(): void 
    {
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

    public function testModifyPointerTarget(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/modify-pointer-target.zig');
        $actor = new $m->Actor(name: 'Arnold Schwarzenegger', age: 77);
        $this->assertSame(77, $actor->age);
        $m->deage($actor, 40);
        $this->assertSame(37, $actor->age);
    }

    public function testCallCFunctions(): void 
    {
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

    public function testCallVariadicFunctions(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/call-variadic-functions.zig');
        $this->expectOutputString(<<<OUTPUT
        i8: -10
        i8: -20
        i8: -30
        i16: -10
        i16: -200
        i16: -3000
        i32: -10
        i32: -200
        i32: -3000
        i64: -10
        i64: -200
        i64: -3000
        f16: -10
        f16: -200
        f16: -3000
        f32: -10.25
        f32: -200.25
        f32: -3000.25
        f64: -10.25
        f64: -200.25
        f64: -3000.25
        f80: -10.25
        f80: -200.25
        f80: -3000.25
        Angieszka
        Basia
        Czesia

        OUTPUT);
        $m->printIntegers(8, 3, 
            new $m->Int8(-10),
            new $m->Int8(-20),
            new $m->Int8(-30),
        );
        $m->printIntegers(16, 3, 
            new $m->Int16(-10),
            new $m->Int16(-200),
            new $m->Int16(-3000),
        );
        $m->printIntegers(32, 3, 
            new $m->Int32(-10),
            new $m->Int32(-200),
            new $m->Int32(-3000),
        );
        $m->printIntegers(64, 3, 
            new $m->Int64(-10),
            new $m->Int64(-200),
            new $m->Int64(-3000),
        );
        $m->printFloats(16, 3, 
            new $m->Float16(-10),
            new $m->Float16(-200),
            new $m->Float16(-3000),
        );
        $m->printFloats(32, 3, 
            new $m->Float32(-10.25),
            new $m->Float32(-200.25),
            new $m->Float32(-3000.25),
        );
        $m->printFloats(64, 3, 
            new $m->Float64(-10.25),
            new $m->Float64(-200.25),
            new $m->Float64(-3000.25),
        );
        $m->printFloats(80, 3, 
            new $m->Float80(-10.25),
            new $m->Float80(-200.25),
            new $m->Float80(-3000.25),
        );
        // $m->printFloats(128, 3, 
        //     new $m->Float128(-10.25),
        //     new $m->Float128(-200.25),
        //     new $m->Float128(-3000.25),
        // );
        $m->printStrings(3,
            new $m->StrPtr('Angieszka'),
            new $m->StrPtr('Basia'),
            new $m->StrPtr('Czesia'),
        );
    }

    public function testCorrectlyPassUnsignedIntToVariadicFunction(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/call-variadic-functions-with-unsigned-int.zig');
        $this->expectOutputString(<<<OUTPUT
        u8: 255
        u8: 254
        u8: 253
        u16: 65535
        u16: 65534
        u16: 65533
        u32: 4294967295
        u32: 4294967294
        u32: 4294967293
        u64: 9223372036854775807
        u64: 9223372036854775806
        u64: 9223372036854775805

        OUTPUT);
        $m->printUnsigned(8, 3,
            new $m->Uint8(255),
            new $m->Uint8(254),
            new $m->Uint8(253),
        );
        $m->printUnsigned(16, 3,
            new $m->Uint16(65535),
            new $m->Uint16(65534),
            new $m->Uint16(65533),
        );
        $m->printUnsigned(32, 3,
            new $m->Uint32(4294967295),
            new $m->Uint32(4294967294),
            new $m->Uint32(4294967293),
        );
        $m->printUnsigned(64, 3,
            new $m->Uint64(0x7fff_ffff_ffff_ffff),
            new $m->Uint64(0x7fff_ffff_ffff_fffe),
            new $m->Uint64(0x7fff_ffff_ffff_fffd),
        );
    }

    public function testWriteToFileUsingFwrite(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/call-fwrite.zig');
        $path = __DIR__ . '/test-data/hello.txt';
        $text = "Hello world!\n";
        $f = $m->fopen($path, 'w');
        $count1 = $m->fwrite($text, 1, strlen($text), $f);
        $count2 = $m->fwrite($text, 1, strlen($text), $f);
        $m->fclose($f);
        $this->assertSame(strlen($text), $count1);
        $this->assertSame(strlen($text), $count2);
    }

    public function testReadFromFileUsingFread(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/call-fread.zig');
        $path = __DIR__ . '/test-data/donuts.txt';
        $buffer1 = new Uint8Array(3);
        $buffer2 = new Uint8Array(3);
        $f = $m->fopen($path, "r");
        $count1 = $m->fread($buffer1, 1, $buffer1->byteLength, $f);
        $count2 = $m->fread($buffer2, 1, $buffer2->byteLength, $f);
        $m->fclose($f);
        $this->assertSame($count1, $buffer1->byteLength);
        $this->assertSame($count2, $buffer2->byteLength);
        $this->assertSame("Was", (string) $buffer1);
        $this->assertSame("abi", (string) $buffer2);
    }

    public function testCallPrintf(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/call-printf.zig');
        $this->expectOutputString(<<<OUTPUT
        Hello world 123!
        Hello world, 123 234 345 456 567!!
        Hello world, 1.23 2.34 3.45 4.56 5.67!!
        Hello world, Dingo Bingo!!
        Hello world, 1 2.000000 3 4.000000 5 6.000000 7 8.000000 9 10.000000 11 12.000000 13 14.000000 15 16.000000 17 18.000000 19 20.000000 End!!
        Hello world, 1 2.000000 3 4.000000 5 6.000000 7 8.000000 9 10.000000 11 12.000000 13 14.000000 15 16.000000 17 18.000000 19 20.000000 21 22.000000 23 24.000000 25 26.000000 27 28.000000 29 30.000000 31 32.000000 33 34.000000 35 36.000000 37 38.000000 39 40.000000!!

        OUTPUT);
        $result = $m->printf("Hello world %d!\n", new $m->Int(123));
        $this->assertSame(17, $result);
        $m->printf("Hello world, %d %d %d %d %d!!\n", 
            new $m->Int(123),
            new $m->Int(234),
            new $m->Int(345),
            new $m->Int(456),
            new $m->Int(567),
        );
        $m->printf("Hello world, %.2f %.2f %.2f %.2f %.2f!!\n",
            new $m->Double(1.23),
            new $m->Double(2.34),
            new $m->Double(3.45),
            new $m->Double(4.56),
            new $m->Double(5.67),
        );
        $m->printf("Hello world, %s %s!!\n",
            new $m->StrPtr('Dingo'),
            new $m->StrPtr('Bingo'),
        );
        $m->printf("Hello world, %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %s!!\n",
            new $m->Int(1),
            new $m->Double(2),
            new $m->Int(3),
            new $m->Double(4),
            new $m->Int(5),
            new $m->Double(6),
            new $m->Int(7),
            new $m->Double(8),
            new $m->Int(9),
            new $m->Double(10),
            new $m->Int(11),
            new $m->Double(12),
            new $m->Int(13),
            new $m->Double(14),
            new $m->Int(15),
            new $m->Double(16),
            new $m->Int(17),
            new $m->Double(18),
            new $m->Int(19),
            new $m->Double(20),
            new $m->StrPtr('End')
        );
        $m->printf("Hello world, %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f!!\n",
            new $m->Int(1),
            new $m->Double(2),
            new $m->Int(3),
            new $m->Double(4),
            new $m->Int(5),
            new $m->Double(6),
            new $m->Int(7),
            new $m->Double(8),
            new $m->Int(9),
            new $m->Double(10),
            new $m->Int(11),
            new $m->Double(12),
            new $m->Int(13),
            new $m->Double(14),
            new $m->Int(15),
            new $m->Double(16),
            new $m->Int(17),
            new $m->Double(18),
            new $m->Int(19),
            new $m->Double(20),
            new $m->Int(21),
            new $m->Double(22),
            new $m->Int(23),
            new $m->Double(24),
            new $m->Int(25),
            new $m->Double(26),
            new $m->Int(27),
            new $m->Double(28),
            new $m->Int(29),
            new $m->Double(30),
            new $m->Int(31),
            new $m->Double(32),
            new $m->Int(33),
            new $m->Double(34),
            new $m->Int(35),
            new $m->Double(36),
            new $m->Int(37),
            new $m->Double(38),
            new $m->Int(39),
            new $m->Double(40),
        );
    }

    public function testWriteToFileUsingFprintf(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/call-fprintf.zig');
        $path = __DIR__ . '/test-data/world.txt';
        $f = $m->fopen($path, 'w');
        if (!$f) throw new Exception("Could not open file: $path");
        $count1 = $m->fprintf($f, "Hello world %d!\n", new $m->Int(12345));
        $count2 = $m->fprintf($f, "Hello world %s!\n", new $m->StrPtr('dingo'));
        $m->fclose($f);
        $this->assertSame(19, $count1);
        $this->assertSame(19, $count2);
    }

    public function testCallSprintf() 
    {
        $m = ZigImporter::load(__DIR__ . '/call-sprintf.zig');
        $buffer = new ArrayBuffer(1024);
        $result1 = $m->sprintf($buffer, "Hello world %d!\n", new $m->Int(123));
        $this->assertSame(17, $result1);
        $ta = new Uint8Array($buffer);
        $this->assertSame(ord('H'), $ta[0]);
        $this->assertSame(ord('e'), $ta[1]);
        $result2 = $m->sprintf($buffer, "Hello world %d!\n", new $m->Int(12345));
        $this->assertSame(19, $result2);
        $result3 = $m->sprintf($buffer, "Hello world, %.2f!\n", new $m->Double(1.23));
        $this->assertSame(19, $result3);
        $this->assertSame("Hello world, 1.23!\n", substr((string) $buffer, 0, $result3));
    }

    public function testCallSnprintf() 
    {
        $m = ZigImporter::load(__DIR__ . '/call-snprintf.zig');
        $buffer = new ArrayBuffer(1024);
        $result1 = $m->snprintf($buffer, $buffer->byteLength, "Hello world %d!\n", new $m->Int(123));
        $this->assertSame(17, $result1);
        $ta = new Uint8Array($buffer);
        $this->assertSame(ord('H'), $ta[0]);
        $this->assertSame(ord('e'), $ta[1]);
        $result2 = $m->snprintf($buffer, 0, "Hello world %d!\n", new $m->Int(12345));
        $this->assertSame(19, $result2);
        $result3 = $m->snprintf($buffer, $buffer->byteLength, "Hello world, %.2f!!\n", new $m->Double(1.23));
        $this->assertSame(20, $result3);
        $this->assertSame("Hello world, 1.23!!\n", substr((string) $buffer, 0, $result3));
    }

    public function testHandleImmediateFulfillmentOfPromise(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/handle-immediate-promise-fulfillment.zig');
        $result1 = $m->fulfillInt();
        $this->assertSame(1234, $result1);
    }

    public function testApplyTransformToReturnValues(): void 
    {
        $m = ZigImporter::load(__DIR__ . '/return-transformed.zig');
        $result1 = $m->returnString();
        $this->assertSame('Hello world', $result1);
        $result2 = $m->returnPlain();
        $this->assertSame([ 72, 101, 108, 108, 111,  32, 119, 111, 114, 108, 100 ], $result2);
        $result4 = $m->returnStruct();
        $this->assertEquals((object) [
            'string' => 'Hello world',
            'plain' => [ 72, 101, 108, 108, 111,  32, 119, 111, 114, 108, 100 ],
            'typed_array' => [ 72, 101, 108, 108, 111,  32, 119, 111, 114, 108, 100 ],
        ], $result4);
    }   
}
