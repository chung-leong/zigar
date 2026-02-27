<?php declare(strict_types=1);

final class ErrorSetHandlingTest extends ZigarTestCase
{   
    public function testImportErrorSetAsStaticVariables(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-static-variables.zig');
        $this->assertInstanceOf('Exception', $m->NormalError->OutOfMemory);
        $this->assertInstanceOf('ZigError', $m->NormalError->OutOfMemory);
        $this->assertSame($m->NormalError->OutOfMemory, $m->PossibleError->OutOfMemory);

        $this->expectOutputString(<<<OUTPUT
        error.FileNotFound
        error.OutOfMemory

        OUTPUT);
        $m->print();
        $m->error_var = $m->NormalError->OutOfMemory;
        $m->print();
        $m->error_var = new Exception('file not found');
        $this->assertSame($m->NormalError->FileNotFound, $m->error_var);
        // TODO: JSON stringify
    }

    public function testPrintErrorSetArguments(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-function-parameters.zig');
        $this->expectOutputString(<<<OUTPUT
        error.SystemIsOnFire
        error.NoMoreBeer

        OUTPUT);
        $m->print($m->StrangeError->SystemIsOnFire);
        $m->print($m->StrangeError->NoMoreBeer);
    }

    public function testReturnErrorSet(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-return-value.zig');
        $this->assertSame($m->StrangeError->NoMoreBeer, $m->getError());
        $this->assertSame($m->StrangeError->AlienInvasion, $m->getAnyError());
    }

    public function testHandleErrorSetInArray(): void
    {
        $m = ZigImporter::load(__DIR__ . '/array-of.zig');
        $this->assertSame(4, count($m->array));
        $this->assertSame($m->StrangeError->SystemIsOnFire, $m->array[0]);
        $this->assertSame($m->StrangeError->DogAteAllMemory, $m->array[1]);
        $this->assertSame($m->StrangeError->AlienInvasion, $m->array[2]);
        $this->assertSame($m->StrangeError->CondomBrokeYouPregnant, $m->array[3]);
        $this->assertSame([
            $m->StrangeError->SystemIsOnFire,
            $m->StrangeError->DogAteAllMemory,
            $m->StrangeError->AlienInvasion,
            $m->StrangeError->CondomBrokeYouPregnant,
        ], (array) $m->array);

        $this->expectOutputString(<<<OUTPUT
        { error.SystemIsOnFire, error.DogAteAllMemory, error.AlienInvasion, error.CondomBrokeYouPregnant }
        { error.SystemIsOnFire, error.DogAteAllMemory, error.NoMoreBeer, error.CondomBrokeYouPregnant }

        OUTPUT);
        $m->print();
        $m->array[2] = $m->StrangeError->NoMoreBeer;
        $m->print();
    }

    public function testHandleErrorSetInStruct(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-struct.zig');
        $this->assertSame($m->StrangeError->AlienInvasion, $m->struct_a->err1);
        $this->assertSame($m->StrangeError->SystemIsOnFire, $m->struct_a->err2);

        $b = new $m->StructA();
        $this->assertSame($m->StrangeError->SystemIsOnFire, $b->err1);
        $this->assertSame($m->StrangeError->DogAteAllMemory, $b->err2);

        $this->expectOutputString(<<<OUTPUT
        .{ .err1 = error.AlienInvasion, .err2 = error.SystemIsOnFire }
        .{ .err1 = error.SystemIsOnFire, .err2 = error.DogAteAllMemory }

        OUTPUT);
        $m->print();
        $m->struct_a = $b;
        $m->print();
    }

    public function testHandleErrorSetInPackedStruct(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-packed-struct.zig');
        });
    }

    public function testHandleErrorSetAsComptimeField(): void
    {
        $m = ZigImporter::load(__DIR__ . '/as-comptime-field.zig');
        $this->assertSame($m->StrangeError->SystemIsOnFire, $m->struct_a->err);
        $b = new $m->StructA(number: 500);
        $this->assertSame($m->StrangeError->SystemIsOnFire, $b->err);

        $this->expectOutputString(<<<OUTPUT
        .{ .number = 500, .err = error.SystemIsOnFire }

        OUTPUT);
        $m->print($b);        
    }

    public function testHandleErrorSetInBareUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-bare-union.zig');
        $this->assertSame($m->StrangeError->AlienInvasion, $m->union_a->err);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'err' is active", function() use($m) {
                $x = $m->union_a->number;
            });
        }

        $b = new $m->UnionA(err: $m->StrangeError->NoMoreBeer);
        $c = new $m->UnionA(number: 123);
        $this->assertSame($m->StrangeError->NoMoreBeer, $b->err);
        $this->assertSame(123, $c->number);
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m, $c) {
                $x = $c->err;
            });
        }

        $m->union_a = $b;
        $this->assertSame($m->StrangeError->NoMoreBeer, $m->union_a->err);
        $m->union_a = $c;
        if (ZigImporter::safetyCheck()) {
            $this->assertExceptionMessage("'number' is active", function() use($m) {
                $x = $m->union_a->err;
            });
        }       
    }

    public function testHandleErrorSetInTaggedUnion(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-tagged-union.zig');
        $this->assertSame($m->StrangeError->DogAteAllMemory, $m->union_a->err);
        $tag = $m->TagType($m->union_a);
        $this->assertSame($m->TagType->err, $tag);
        $this->assertSame(null, $m->union_a->number);

        $b = new $m->UnionA(err: $m->StrangeError->CondomBrokeYouPregnant);
        $c = new $m->UnionA(number: 123);
        $this->assertSame($m->StrangeError->CondomBrokeYouPregnant, $b->err);
        $this->assertSame(123, $c->number);
        $this->assertSame(null, $c->err);

        $m->union_a = $b;
        $this->assertSame($m->StrangeError->CondomBrokeYouPregnant, $m->union_a->err);
        $m->union_a = $c;
        $this->assertSame(null, $m->union_a->err);
    }

    public function testHandleErrorSetInOptional(): void
    {
        $m = ZigImporter::load(__DIR__ . '/in-optional.zig');
        $this->assertSame($m->StrangeError->SystemIsOnFire, $m->optional);

        $this->expectOutputString(<<<OUTPUT
        error.SystemIsOnFire
        null
        error.NoMoreBeer

        OUTPUT);
        $m->print();
        $m->optional = null;
        $m->print();
        $m->optional = $m->StrangeError->NoMoreBeer;
        $m->print();
    }

    public function testHandleErrorSetInErrorUnion(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/in-error-union.zig');
        });
    }

    public function testHandleErrorSetInVector(): void
    {
        $this->assertExceptionMessage("unable to create module", function() {
            $m = ZigImporter::load(__DIR__ . '/vector-of.zig');
        });
    }

    public function testConstructErrorSet(): void
    {
        $m = ZigImporter::load(__DIR__ . '/constructor.zig');
    }    
}

