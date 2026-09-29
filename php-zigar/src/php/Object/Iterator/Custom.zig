const std = @import("std");

const php = @import("../../root.zig");
const c = php.c;
const pi = php.imports;
const Array = php.Array;
const Class = php.Class;
const failure = php.failure;
const Function = php.Function;
const Object = php.Object;
const php_al = php.allocator;
const String = php.String;
const Value = php.Value;
const Access = Value.Access;
const Kind = Value.Kind;
const argCount = php.util.argCount;
const ArgType = php.util.ArgType;
const ReturnType = php.util.ReturnType;

pub fn @"fn"(comptime T: type) type {
    return struct {
        pub fn create(custom: T) !*@This() {
            const self = try php_al.create(@This());
            pi.zend_iterator_init(&self.iter);
            self.iter.funcs = &methods;
            self.iter.setData(.fromNull());
            self.custom = custom;
            self.has_value = false;
            self.index = 0;
            return self;
        }

        fn fromIter(iter: *T) *@This() {
            return @fieldParentPtr("iter", iter);
        }

        fn retrieve(self: *@This()) void {
            if (!self.has_value) {
                const Next = @TypeOf(T.next);
                const result = switch (ArgType(Next, 1)) {
                    0 => self.custom.next(),
                    1 => self.custom.next(php_al),
                    else => unreachable,
                };
                if (result) |entry| {
                    const key = if (Entry == Payload) self.index else entry[0];
                    self.key = .fromAny(key);
                    const payload = if (Entry == Payload) entry else entry[1];
                    self.iter.data().* = .fromAny(payload);
                }
            }
        }

        fn clear(self: *@This()) bool {
            if (self.has_value) {
                self.key.release();
                self.iter.data().release();
                self.has_value = false;
            }
        }

        fn destroy(iter: *Object.Iterator) void {
            const self = fromIter(iter);
            if (@hasDecl(T, "deinit")) {
                self.custom.deinit();
            }
            self.clear();
        }

        fn isValid(iter: *Object.Iterator) c_int {
            const self = fromIter(iter);
            self.retrieve();
            return if (self.has_value) c.SUCCESS else c.FAILURE;
        }

        fn getCurrentData(iter: *Object.Iterator) callconv(.c) *Value {
            const self = fromIter(iter);
            self.retrieve();
            return self.iter.data();
        }

        fn getCurrentKey(iter: *Object.Iterator, key_ptr: *Value) callconv(.c) void {
            const self = fromIter(iter);
            self.retrieve();
            key_ptr.* = &self.key;
        }

        fn moveForward(iter: *Object.Iterator) callconv(.c) void {
            const self = fromIter(iter);
            if (!self.has_value) self.retrieve();
            self.clear();
            self.index += 1;
        }

        fn rewind(iter: *Object.Iterator) callconv(.c) void {
            if (@hasDecl(T, "reset")) {
                const self = fromIter(iter);
                self.clear();
                self.index = 0;
                self.custom.reset();
            }
        }

        const Entry = init: {
            if (!@hasDecl(T, "next")) @compileError("No next method: " ++ @typeName(T));
            const Next = @TypeOf(T.next);
            const Arg0 = ArgType(Next, 0);
            if (Arg0 != *T) @compileError("Next method does not accept self pointer: " ++ @typeName(Next));
            if (argCount(Next) == 2) {
                const Arg1 = ArgType(Next, 1);
                if (Arg1 != std.mem.Allocator) @compileError("Next method can only accept an allocator as its sole argument");
            }
            const RT = ReturnType(Next);
            switch (@typeInfo(RT)) {
                .optional => |opt| break :init opt.child,
                else => @compileError("Next method does not return optional value : " ++ @typeName(Next)),
            }
        };
        const Payload = init: {
            switch (@typeInfo(Entry)) {
                .@"struct" => |st| switch (st.is_tuple) {
                    true => switch (st.field_types.len) {
                        2 => {
                            const Key = st.field_types[0];
                            if (Key != *String and Key != c_long) @compileError("Key must be *String or c_long");
                            break :init st.field_types[1];
                        },
                        else => @compileError("Tuple with two items expected"),
                    },
                    else => break :init Entry,
                },
                else => break :init Entry,
            }
        };
        const methods: Object.Iterator.Functions = .{
            .dtor = @ptrCast(destroy),
            .valid = @ptrCast(isValid),
            .get_current_data = @ptrCast(getCurrentData),
            .get_current_key = @ptrCast(getCurrentKey),
            .move_forward = @ptrCast(moveForward),
            .rewind = @ptrCast(rewind),
        };

        iter: Object.Iterator align(@max(@alignOf(Object.Iterator), @alignOf(T))),
        custom: T,
        key: Value,
        index: usize,
        has_value: bool,
    };
}
