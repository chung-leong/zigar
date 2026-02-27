<?php declare(strict_types=1);

final class EnumHandlingTest extends ZigarTestCase
{   
    public function testImportEnumAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertSame(1, (int) $m->Pet->cat);
        $this->assertSame('dog cat monkey', "{$m->Pet->dog} {$m->Pet->cat} {$m->Pet->monkey}");
        $this->assertSame($m->Pet->cat, $m->Pet(1));
        $this->assertSame(null, $m->Pet(5));
        $this->assertSame(true, $m->pet instanceof $m->Pet);
        $this->assertSame($m->Pet->cat, $m->pet);
        $this->assertSame($m->Donut->plain, $m->Donut(gmp_init('0')));
        $this->assertSame($m->Donut->jelly, $m->Donut(gmp_init('0xfffffffffffffffffffffffffffffffe')));
        $this->assertSame('@enumFromInt(5)', (string) $m->Donut(gmp_init('5')));

        $this->expectOutputString(<<<OUTPUT
        .cat
        .dog

        OUTPUT);
        $m->print();
        $m->pet = $m->Pet->dog;
        $m->print();        
    }

    public function testPrintEnumArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        .cat .dog

        OUTPUT);
        $m->print($m->Pet->cat, $m->Pet->dog);
    }

    public function testReturnEnum(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $result = $m->getEnum();
        $this->assertSame($m->Pet->cat, $result);
    }

    public function testHandleEnumInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame([ 
            (int) $m->Pet->monkey,
            (int) $m->Pet->dog,
            (int) $m->Pet->cat,
        ], (array) $m->array);

        $this->expectOutputString(<<<OUTPUT
        { .monkey, .dog, .cat }

        OUTPUT);
        $m->print();
    }

    public function testHandleEnumInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame($m->Pet->dog, $m->struct_a->pet1);
        $this->assertSame($m->Pet->cat, $m->struct_a->pet2);
        $b = new $m->StructA();
        $this->assertSame($m->Pet->monkey, $b->pet1);
        $this->assertSame($m->Pet->dog, $b->pet2);

        $this->expectOutputString(<<<OUTPUT
        .{ .pet1 = .dog, .pet2 = .cat }
        .{ .pet1 = .monkey, .pet2 = .dog }

        OUTPUT);
        $m->print();
        $m->struct_a = $b;
        $m->print();
    }

    public function testHandleEnumInPackedStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        $this->assertSame($m->Pet->dog, $m->struct_a->pet1);
        $this->assertSame($m->Pet->cat, $m->struct_a->pet2);
        $this->assertSame(200, $m->struct_a->number);
        $this->assertSame($m->Pet->monkey, $m->struct_a->pet3);
        $b = new $m->StructA();
        $this->assertSame($m->Pet->monkey, $b->pet1);
        $this->assertSame($m->Pet->dog, $b->pet2);
        $this->assertSame(100, $b->number);
        $this->assertSame($m->Pet->cat, $b->pet3);

        $this->expectOutputString(<<<OUTPUT
        .{ .pet1 = .dog, .pet2 = .cat, .number = 200, .pet3 = .monkey }
        .{ .pet1 = .monkey, .pet2 = .dog, .number = 100, .pet3 = .cat }

        OUTPUT);
        $m->print();
        $m->struct_a = $b;
        $m->print();
    }

    public function testHandleEnumAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame($m->Pet->cat, $m->struct_a->pet);
        $b = new $m->StructA(number: 500);
        $this->assertSame($m->Pet->cat, $b->pet);

        $this->expectOutputString(<<<OUTPUT
        .{ .number = 500, .pet = .cat }

        OUTPUT);
        $m->print($b);
    }

    public function testHandleEnumInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame($m->Pet->cat, $m->union_a->pet);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'pet' is active", function() use($m) {
                $x = $m->union_a->number;
            });
        }

        $b = new $m->UnionA(pet: $m->Pet->dog);
        $c = new $m->UnionA(number: 123);
        $this->assertSame($m->Pet->dog, $b->pet);
        $this->assertSame(123, $c->number);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m, $c) {
                $x = $c->pet;
            });
        }

        $m->union_a = $b;
        $this->assertSame($m->Pet->dog, $m->union_a->pet);
        $m->union_a = $c;
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m) {
                $x = $m->union_a->pet;
            });
        }       
    }

    public function testHandleEnumInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
    }

    public function testHandleEnumInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
    }

    public function testHandleEnumInErrorUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
    }

    public function testHandleEnumInVector(): void
    {
        $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
    }
}

