<?php declare(strict_types=1);

final class PointerHandlingTest extends ZigarTestCase
{   
    public function testImportPointerAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame([ 123, 456, 789 ], (array) $m->int32_array);
        $this->assertSame([ 123, 456, 789 ], (array) $m->int32_slice);
        $this->assertSame([ 123, 456, 789 ], $m->int32_slice->__plain);
        $this->assertSame([ 123, 456, 789 ], [ ...$m->int32_slice ]);
    }

    public function testPrintPointerArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        hello
        world

        OUTPUT);
        $m->print("hello");
        $m->print("world");
    }

    public function testReturnPointer(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $bytes = $m->getBytes();
        $this->assertSame('World', $bytes->__string);
        $text = $m->getText();
        $this->assertSame('Hello', $text);
    }

    public function testHandlePointerInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame(4, count($m->array));
        $this->assertSame('dog', $m->array[0]->__string);
        $this->assertSame('cat', $m->array[1]->__string);
        $this->assertSame('monkey', $m->array[2]->__string);
        $this->assertSame('cow', $m->array[3]->__string);

        $this->expectOutputString(<<<OUTPUT
        { { 100, 111, 103 }, { 99, 97, 116 }, { 109, 111, 110, 107, 101, 121 }, { 99, 111, 119 } }
        { { 100, 111, 103 }, { 99, 97, 116 }, { 98, 101, 97, 114 }, { 99, 111, 119 } }

        OUTPUT);
        $m->print();
        $m->array[2] = $m->alt_text;
        $m->print();
    }

    public function testHandlePointerInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame('dog', $m->struct_a->text1->__string);
        $this->assertSame('cat', $m->struct_a->text2->__string);

        $b = new $m->StructA();
        $this->assertSame('apple', $b->text1->__string);
        $this->assertSame('orange', $b->text2->__string);

        $this->expectOutputString(<<<OUTPUT
        .{ .text1 = { 100, 111, 103 }, .text2 = { 99, 97, 116 } }
        .{ .text1 = { 97, 112, 112, 108, 101 }, .text2 = { 111, 114, 97, 110, 103, 101 } }

        OUTPUT);
        $m->print();
        $m->struct_a = $b;
        $m->print();

        $this->assertSame('{"text1":"apple","text2":"orange"}', json_encode($m->struct_b));
        $this->assertEquals((object) [
            'text1' => 'apple',
            'text2' => 'orange',
        ], $m->StructC->__plain);
    }

    public function testFailWithPointerInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandlePointerAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame('Hello', $m->struct_a->text->__string);

        $b = new $m->StructA(number: 500);
        $this->assertSame('Hello', $b->text->__string);

        $this->expectOutputString(<<<OUTPUT
        .{ .number = 500, .text = { 72, 101, 108, 108, 111 } }

        OUTPUT);
        $m->print($b);
    }

    public function testHandlePointerInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertExceptionMessage('untagged union', function() use ($m) {
            $x = $m->union_a->text->__string;
        });
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'text' is active", function() use($m) {
                $x = $m->union_a->number;
            });
        }

        $b = new $m->UnionA(number: 123);
        $this->assertSame(123, $b->number);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($b) {
                $x = $b->text;
            });
        } else {
            $this->assertExceptionMessage("untagged union", function() use($b) {
                $x = $b->text;
            });
        }

        $m->union_a = $b;
        $this->assertSame(123, $m->union_a->number);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m) {
                $x = $m->union_a->text;
            });
        } else {
            $this->assertExceptionMessage("untagged union", function() use($m) {
                $x = $m->union_a->text;
            });
        }
    }

    public function testHandlePointerInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame('Hello', $m->union_a->text->__string);
        $tag = $m->TagType($m->union_a);
        $this->assertSame('text', (string) $tag);
        $this->assertSame(null, $m->union_a->number);

        $b = new $m->UnionA(text: $m->alt_text);
        $c = new $m->UnionA(number: 123);
        $this->assertSame('World', $b->text->__string);
        $this->assertSame(123, $c->number);
        $this->assertSame(null, $c->text);

        $m->union_a = $b;
        $this->assertSame('World', $m->union_a->text->__string);
        $this->assertExceptionMessage("access of union field 'number' while field 'text' is active", function() use($m) {
            $m->union_a->number = 456;
        });
        $m->union_a = $c;
        $this->assertSame(null, $m->union_a->text);
    }

    public function testHandlePointerInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame('Hello', $m->optional);

        $this->expectOutputString(<<<OUTPUT
        Hello
        null
        World

        OUTPUT);
        $m->print();
        $m->optional = null;
        $m->print();
        $m->optional = $m->alt_text;
        $m->print();

        $this->assertSame('World', $m->optional);
    }

    public function testHandlePointerInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame('Hello', $m->error_union->__string);

        $this->expectOutputString(<<<OUTPUT
        { 72, 101, 108, 108, 111 }
        error.GoldfishDied
        { 87, 111, 114, 108, 100 }

        OUTPUT);
        $m->print();
        $m->error_union = $m->Error->GoldfishDied;
        $m->print();
        $m->error_union = $m->alt_text;
        $m->print();

        $this->assertSame('World', $m->error_union->__string);
    }

    public function testHandlePointerInVector(): void
    {
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        $this->assertSame([ 1, 1, 1, 1 ], $m->vector_const->__plain);
        $this->assertSame([ 1, 1, 1, 1 ], $m->vector->__plain);
        $m->change(123);
        $this->assertSame([ 123, 123, 123, 123 ], $m->vector_const->__plain);
        $this->assertSame([ 123, 123, 123, 123 ], $m->vector->__plain);
    }

    public function testConstructPointer(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $b = new $m->IntPtr(1234);
        $this->assertSame(1234, $b->__value);
        $c = new $m->IntPtr->__child(4567);
        $d = new $m->IntPtr($c);
        $this->assertSame(4567, $d->{'*'});
        $d->{'*'} = 8888;
        $this->assertSame(8888, $d->{'*'});
        $e = new $m->IntPtr(1234);
        $this->assertSame(0, $b <=> $e);
        $this->assertSame(-1, $b <=> $d);
        $d->{'*'} = 8;
        $this->assertSame(1, $b <=> $d);
        $clone = clone $d;
        $this->assertEquals($d, $clone);
    }
}
