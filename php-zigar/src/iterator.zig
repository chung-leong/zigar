const std = @import("std");

const php = @import("php.zig");
const ClassEntry = php.ClassEntry;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const ObjectIteratorFunctions = php.ObjectIteratorFunctions;
const Value = php.Value;

pub fn Iterator(comptime S: type) type {
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
            const ce = if (class_entry) |*ce| ce else create: {
                class_entry = .{
                    .name = php.createPersistentString("zigar_array_iterator"),
                };
                break :create &class_entry.?;
            };
            php.addRef(obj);
            self.* = .{
                .iter = .{
                    .std = .{
                        .gc = .{ .refcount = 1 },
                        .ce = ce,
                        .handlers = php.std_object_handlers,
                    },
                    .data = php.createValueNull(),
                    .funcs = &functions,
                    .index = 0,
                },
                .object = obj,
                .len = @intCast(count),
            };
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

        pub fn getCurrentData(iter: *ObjectIterator) !*Value {
            const self = fromIter(iter);
            var key = php.createValueLong(@intCast(iter.index));
            _ = try S.readElement(self.object, &key, 0, &iter.data);
            return &iter.data;
        }

        pub fn getCurrentKey(iter: *ObjectIterator, key_ptr: *Value) void {
            key_ptr.* = php.createValueLong(@intCast(iter.index));
        }

        pub fn moveForward(iter: *ObjectIterator) void {
            iter.index += 1;
        }

        pub fn rewind(iter: *ObjectIterator) void {
            iter.index = 0;
        }

        const functions: ObjectIteratorFunctions = .{
            .dtor = php.transform(destroy),
            .valid = php.transform(isValid),
            .get_current_data = php.transform(getCurrentData),
            .get_current_key = php.transform(getCurrentKey),
            .move_forward = php.transform(moveForward),
            .rewind = php.transform(rewind),
        };
        var class_entry: ?ClassEntry = null;
    };
}
