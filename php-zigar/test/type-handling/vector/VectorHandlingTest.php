<?php declare(strict_types=1);

final class VectorHandlingTest extends ZigarTestCase
{   
    public function testImportVectorAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame([ 1.0, 2.0, 3.0, 4.0 ], (array) $m->v1);
        $this->assertSame([ 1.0, 2.0, 3.0, 4.0 ], [ ...$m->v1 ]);
        $this->assertSame([ 1.0, 2.0, 3.0, 4.0 ], $m->v1->__plain);

        $m->v2 = [ 4.0, 5.0, 6.0 ];
        $this->assertSame([ 4.0, 5.0, 6.0 ], $m->v2->__plain);
        $this->expectOutputString(<<<OUTPUT
        { 4, 5, 6 }
        0: 1
        1: 2
        2: 3
        3: 4

        OUTPUT);
        $m->print();
        foreach ($m->v1 as $index => $value) {
            echo "$index: $value\n";
        }

        $this->assertSame([ 1.0, 2.0, 3.0, 4.0 ], $m->v3);
    }

    public function testPrintVectorArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        { 1.1, 2.2, 3.3, 4.4 }

        OUTPUT);
        $m->print([ 1.1, 2.2, 3.3, 4.4 ]);
    }

    public function testReturnVector(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $result = $m->getVector();
        $this->assertSame([ 1, 2, 3, 4 ], (array) $result);
    }

    public function testHandleVectorInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame(2, count($m->array));
        $this->assertSame([ 1, 2, 3, 4 ], (array) $m->array[0]);
        $this->assertSame([ 2, 3, 4, 5 ], (array) $m->array[1]);
        $this->assertSame([
            [ 1, 2, 3, 4 ],
            [ 2, 3, 4, 5 ],
        ], $m->array->__plain);

        $this->expectOutputString(<<<OUTPUT
        { { 1, 2, 3, 4 }, { 2, 3, 4, 5 } }
        { { 1, 2, 300, 4 }, { 2, 3, 4, 5000 } }

        OUTPUT);
        $m->print();
        $m->array[0][2] = 300;
        $m->array[1][3] = 5000;
        $m->print();
    }

    public function testHandleVectorInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame([ 10, 20, 30, 40 ], (array) $m->struct_a->vector1);
        $this->assertSame([ 11, 21, 31, 41 ], (array) $m->struct_a->vector2);
        $this->assertEquals((object) [
            'vector1' =>  [ 10, 20, 30, 40 ],
            'vector2' =>  [ 11, 21, 31, 41 ],
        ], $m->struct_a->__plain);
        
        $b = new $m->StructA();
        $this->assertSame([ 1, 2, 3, 4 ], (array) $b->vector1);
        $this->assertSame([ 5, 6, 7, 8 ], (array) $b->vector2);
        $this->assertEquals((object) [
            'vector1' => [ 1, 2, 3, 4 ],
            'vector2' => [ 5, 6, 7, 8 ],
        ], $b->__plain);

        $this->expectOutputString(<<<OUTPUT
        .{ .vector1 = { 10, 20, 30, 40 }, .vector2 = { 11, 21, 31, 41 } }
        .{ .vector1 = { 1, 2, 3, 4 }, .vector2 = { 5, 6, 7, 8 } }

        OUTPUT);
        $m->print();
        $m->struct_a = $b;
        $m->print();
    }

    public function testHandleVectorInPackedStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        $this->assertSame([ 10, 20, 30, 40 ], (array) $m->struct_a->vector1);
        $this->assertSame([ 2, 3, 4, 5 ], (array) $m->struct_a->vector2);
        $this->assertSame(200, $m->struct_a->number);
        $this->assertSame([ 12, 22, 32, 42 ], (array) $m->struct_a->vector3);

        $this->expectOutputString(<<<OUTPUT
        .{ .vector1 = { 10, 20, 30, 40 }, .vector2 = { 2, 3, 4, 5 }, .number = 200, .vector3 = { 12, 22, 32, 42 } }
        .{ .vector1 = { 10, 20, 30, 40 }, .vector2 = { 2, 3, 4, 5 }, .number = 201, .vector3 = { 12, 22, 32, 43 } }

        OUTPUT);
        $m->print();
        $m->struct_a->number = 201;
        $m->struct_a->vector3[3] = 43;
        $m->print();
    }

    public function testHandleVectorAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame([ 1, 2, 3, 4 ], (array) $m->struct_a->vector);

        $b = new $m->StructA(number: 500);
        $this->assertSame(500, $b->number);
        $this->assertSame([ 1, 2, 3, 4 ], (array) $b->vector);

        $this->expectOutputString(<<<OUTPUT
        .{ .number = 500, .vector = { 1, 2, 3, 4 } }

        OUTPUT);
        $m->print($b);
    }

    public function testHandleVectorInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame([ 1, 2, 3, 4 ], (array) $m->union_a->vector);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'vector' is active", function() use($m) {
                $x = $m->union_a->number;
            });
        }

        $b = new $m->UnionA(vector: [ 5, 6, 7, 8 ]);
        $this->assertSame([ 5, 6, 7, 8 ], (array) $b->vector);
        $c = new $m->UnionA(number: 123);
        $this->assertSame(123, $c->number);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($c) {
                $x = $c->vector;
            });
        }

        $m->union_a = $b;
        $this->assertSame([ 5, 6, 7, 8 ], (array) $m->union_a->vector);
        $this->assertEquals((object) [ 
            'vector' => [ 5, 6, 7, 8 ],
            'number' => 5,
        ], $m->union_a->__plain);
        $m->union_a = $c;
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m) {
                $x = $m->union_a->vector;
            });
        }
    }

    public function testHandleVectorInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame([ 1, 2, 3, 4 ], (array) $m->union_a->vector);
        $tag = $m->TagType($m->union_a);
        $this->assertSame($m->TagType->vector, $tag);
        $this->assertSame(null, $m->union_a->number);

        $b = new $m->UnionA(vector: [ 5, 6, 7, 8 ]);
        $c = new $m->UnionA(number: 123);
        $this->assertSame([ 5, 6, 7, 8 ], (array) $b->vector);
        $this->assertEquals((object) [
            'vector' => [ 5, 6, 7, 8 ]
        ], $b->__plain);
        $this->assertSame(123, $c->number);
        $this->assertSame(null, $c->vector);
        $this->assertEquals((object) [
            'number' => 123
        ], $c->__plain);

        $m->union_a = $b;
        $this->assertSame([ 5, 6, 7, 8 ], (array) $m->union_a->vector);
        $this->assertEquals((object) [
            'vector' => [ 5, 6, 7, 8 ]
        ], $m->union_a->__plain);
        $m->union_a = $c;
        $this->assertSame(null, $m->union_a->vector);
        $this->assertEquals((object) [
            'number' => 123
        ], $m->union_a->__plain);
    }

    public function testHandleVectorInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->expectOutputString(<<<OUTPUT
        { 1, 2, 3, 4 }
        null
        { 5, 6, 7, 8 }
        
        OUTPUT);
        $m->print();
        $m->optional = null;
        $m->print(); 
        $m->optional = [ 5, 6, 7, 8 ];
        $m->print();
    }

    public function testHandleVectorInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        $this->assertSame([ 1, 2, 3, 4 ], (array) $m->error_union);

        $this->expectOutputString(<<<OUTPUT
        { 1, 2, 3, 4 }
        error.GoldfishDied
        { 10, 20, 30, 40 }

        OUTPUT);
        $m->print();
        $m->error_union = $m->Error->GoldfishDied;
        $m->print();
        $m->error_union = [ 10, 20, 30, 40 ];
        $m->print();

        $m->error_union = new Exception('no money');
        // TODO: problem with exception
        // $this->assertExceptionMessage('no money', function() use($m) {
        //     $x = $m->error_union;
        // });
    }

    public function testFailWithVectorInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }

    public function testConstructVector(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
        $b = new $m->Vector([ 1, 2, 3, 4 ]);
        $this->assertSame([ 1.0, 2.0, 3.0, 4.0 ], $b->__plain);
        $c = $m->Vector(pack('ffff', 1.0, 2.0, 3.0, 4.0));
        $this->assertSame([ 1.0, 2.0, 3.0, 4.0 ], $c->__plain);
        $this->assertExceptionMessage("out of bound", function() use($m) {
            $x = new $m->Vector([ 1, 2, 3, 4, 5 ]);
        });
    }
}

