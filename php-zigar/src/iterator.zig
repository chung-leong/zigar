const std = @import("std");

const Generator = @import("generator.zig").Generator;
const php = @import("php.zig");
const ClassEntry = php.ClassEntry;
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const ObjectIteratorFunctions = php.ObjectIteratorFunctions;
const String = php.String;
const Value = php.Value;
const structure = @import("structure.zig");
const ZigObject = @import("object.zig").ZigObject;

pub fn ArrayIterator(comptime S: type) type {
    return struct {
        iter: ObjectIterator,
        object: *Object,
        len: c_ulong,

        fn fromIter(iter: *ObjectIterator) *@This() {
            return @fieldParentPtr("iter", iter);
        }

        pub fn create(obj: *Object) !*ObjectIterator {
            const self = try php.allocator.create(@This());
            var count: c_long = undefined;
            _ = try S.countElements(obj, &count);
            php.addRef(obj);
            php.initializeIterator(&self.iter);
            self.object = obj;
            self.len = @intCast(count);
            self.iter.funcs = &methods;
            return &self.iter;
        }

        pub fn destroy(iter: *ObjectIterator) void {
            const self = fromIter(iter);
            php.release(self.object);
        }

        pub fn isValid(iter: *ObjectIterator) !c_int {
            const self = fromIter(iter);
            return if (iter.index < self.len) php.SUCCESS else php.FAILURE;
        }

        pub fn getCurrentData(iter: *ObjectIterator) *Value {
            const self = fromIter(iter);
            var key = php.createValueLong(@intCast(iter.index));
            // readElement() returns an error union, hence the need for &
            _ = &S.readElement(self.object, &key, 0, &iter.data);
            return &iter.data;
        }

        pub fn getCurrentKey(iter: *ObjectIterator, key_ptr: *Value) void {
            key_ptr.* = php.createValueLong(@intCast(iter.index));
        }

        pub fn moveForward(_: *ObjectIterator) void {}

        const methods: ObjectIteratorFunctions = .{
            .dtor = php.transform(destroy),
            .valid = php.transform(isValid),
            .get_current_data = php.transform(getCurrentData),
            .get_current_key = php.transform(getCurrentKey),
            .move_forward = php.transform(moveForward),
        };
    };
}

pub fn PropertyIterator(comptime S: type) type {
    return struct {
        iter: ObjectIterator,
        member_iter: HashTableIterator,
        current_key: *String,
        object: *Object,
        flags: packed struct {
            valid: bool = false,
        },

        fn fromIter(iter: *ObjectIterator) *@This() {
            return @fieldParentPtr("iter", iter);
        }

        pub fn create(obj: *Object, members: *HashTable) !*ObjectIterator {
            const self = try php.allocator.create(@This());
            php.initializeIterator(&self.iter);
            self.object = obj;
            self.member_iter = .init(members, .{});
            self.flags = .{};
            self.iter.funcs = &methods;
            return &self.iter;
        }

        pub fn destroy(iter: *ObjectIterator) void {
            const self = fromIter(iter);
            php.release(self.member_iter.ht);
            php.release(self.object);
        }

        pub fn isValid(iter: *ObjectIterator) !c_int {
            const self = fromIter(iter);
            return if (iter.index < self.member_iter.len) php.SUCCESS else php.FAILURE;
        }

        pub fn getCurrentData(iter: *ObjectIterator) *Value {
            const self = fromIter(iter);
            php.release(iter.data);
            S.readProperty(self.object, self.current_key, 0, null, &iter.data) catch {};
            return &iter.data;
        }

        pub fn getCurrentKey(iter: *ObjectIterator, key_ptr: *Value) void {
            const self = fromIter(iter);
            key_ptr.* = php.createValueString(self.current_key);
        }

        pub fn moveForward(iter: *ObjectIterator) void {
            const self = fromIter(iter);
            const key_value = self.member_iter.next().?;
            self.current_key = php.getValueString(key_value) catch unreachable;
            php.addRef(self.current_key);
        }

        pub fn rewind(iter: *ObjectIterator) void {
            const self = fromIter(iter);
            self.member_iter.reset();
            moveForward(iter);
        }

        const methods: ObjectIteratorFunctions = .{
            .dtor = php.transform(destroy),
            .valid = php.transform(isValid),
            .get_current_data = php.transform(getCurrentData),
            .get_current_key = php.transform(getCurrentKey),
            .move_forward = php.transform(moveForward),
            .rewind = php.transform(rewind),
        };
    };
}

pub const GeneratorIterator = struct {
    iter: ObjectIterator,
    generator: *Generator,

    fn fromIter(iter: *ObjectIterator) *@This() {
        return @fieldParentPtr("iter", iter);
    }

    pub fn create(obj: *Object) !*ObjectIterator {
        const generator_struct = ZigObject(structure.Struct).fromObject(obj).structure();
        const generator = try generator_struct.getSpecialContext(Generator);
        const self = try php.allocator.create(@This());
        generator.addRef();
        php.initializeIterator(&self.iter);
        self.generator = generator;
        self.iter.funcs = &methods;
        return &self.iter;
    }

    pub fn destroy(iter: *ObjectIterator) void {
        const self = fromIter(iter);
        self.generator.release();
    }

    pub fn isValid(iter: *ObjectIterator) !c_int {
        const self = fromIter(iter);
        return if (self.generator.isValid()) php.SUCCESS else php.FAILURE;
    }

    pub fn getCurrentData(iter: *ObjectIterator) !*Value {
        const self = fromIter(iter);
        iter.data = self.generator.result;
        php.addRef(&iter.data);
        return &iter.data;
    }

    pub fn getCurrentKey(iter: *ObjectIterator, key_ptr: *Value) void {
        key_ptr.* = php.createValueLong(@intCast(iter.index));
    }

    pub fn moveForward(iter: *ObjectIterator) !void {
        const self = fromIter(iter);
        try self.generator.moveForward();
    }

    pub fn rewind(iter: *ObjectIterator) !void {
        const self = fromIter(iter);
        try self.generator.rewind();
    }

    const methods: ObjectIteratorFunctions = .{
        .dtor = php.transform(destroy),
        .valid = php.transform(isValid),
        .get_current_data = php.transform(getCurrentData),
        .get_current_key = php.transform(getCurrentKey),
        .move_forward = php.transform(moveForward),
        .rewind = php.transform(rewind),
    };
};

pub const IteratorIterator = struct {
    iter: ObjectIterator,
    iter_object: *Object,
    flags: packed struct {
        moved: bool = false,
        valid: bool = false,
    },

    fn fromIter(iter: *ObjectIterator) *@This() {
        return @fieldParentPtr("iter", iter);
    }

    pub fn create(obj: *Object) !*ObjectIterator {
        const self = try php.allocator.create(@This());
        php.addRef(obj);
        php.initializeIterator(&self.iter);
        self.iter_object = obj;
        self.iter.funcs = &methods;
        self.flags = .{};
        return &self.iter;
    }

    pub fn destroy(iter: *ObjectIterator) void {
        const self = fromIter(iter);
        php.release(self.iter_object);
    }

    pub fn isValid(iter: *ObjectIterator) !c_int {
        const self = fromIter(iter);
        return if (self.flags.valid) php.SUCCESS else php.FAILURE;
    }

    pub fn getCurrentData(iter: *ObjectIterator) !*Value {
        php.addRef(&iter.data);
        return &iter.data;
    }

    pub fn getCurrentKey(iter: *ObjectIterator, key_ptr: *Value) void {
        key_ptr.* = php.createValueLong(@intCast(iter.index));
    }

    pub fn moveForward(iter: *ObjectIterator) !void {
        const self = fromIter(iter);
        defer self.flags.moved = true;
        if (self.flags.valid) {
            php.release(&self.iter.data);
            self.flags.valid = false;
        }
        if (self.call("next")) |result| {
            if (!php.isNull(&result)) {
                self.iter.data = result;
                self.flags.valid = true;
            }
        } else |err| {
            return err;
        }
    }

    pub fn rewind(iter: *ObjectIterator) !void {
        const self = fromIter(iter);
        if (self.flags.moved) {
            if (self.call("reset")) |_| {
                self.flags.moved = false;
            } else |_| {
                return;
            }
        }
        try moveForward(iter);
    }

    fn call(self: *@This(), comptime method: []const u8) !Value {
        const obj_value = php.createValueObject(self.iter_object);
        const method_value = php.createValuePersistentString(method);
        return php.invokeMethod(&obj_value, &method_value, &.{});
    }

    const methods: ObjectIteratorFunctions = .{
        .dtor = php.transform(destroy),
        .valid = php.transform(isValid),
        .get_current_data = php.transform(getCurrentData),
        .get_current_key = php.transform(getCurrentKey),
        .move_forward = php.transform(moveForward),
        .rewind = php.transform(rewind),
    };
};
