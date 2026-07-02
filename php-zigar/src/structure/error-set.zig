const std = @import("std");

const accessor = @import("../accessor.zig");
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const ZigException = @import("../exception.zig").ZigException;
const failure = @import("../failure.zig");
const Error = failure.Error;
const ArrayBuffer = @import("../js-compat.zig").ArrayBuffer;
const php = @import("../php.zig");
const MethodCallCaches = php.MethodCallCaches;
const N = php.getStaticString;
const Array = php.Array;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Function = php.Function;
const HashTable = php.HashTable;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("../structure.zig");

pub const ErrorSet = struct {
    buffer: *ByteBuffer = undefined,

    pub const Super = structure.Parent(@This());
    pub const Static = struct {
        constant_acc: *accessor.Constant = undefined,

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            const member = try class.getMember(.instance, 0);
            if (member.accessors != .constant) return error.Unexpected;
            self.constant_acc = &member.accessors.constant;
            if (class.static.template.table) |*static_table| {
                // loop through static members and create corresponding exceptions for errors in set
                var iter = class.getMemberIterator(.static);
                while (iter.next()) |static_member| {
                    const slot = static_member.slot orelse continue;
                    const err = try php.getProperty(static_table, slot);
                    const err_struct = try fromValue(err);
                    const name = iter.currentName() orelse return error.MissingName;
                    if (class.host.findException(name) == null) {
                        const int_value = try self.constant_acc.int.get(err_struct);
                        const int = try php.getValueLong(&int_value);
                        _ = try class.host.addException(name, int);
                    }
                }
            }
        }

        pub fn castValue(self: *@This(), value: *Value) !?Value {
            switch (php.getValueType(value)) {
                .long, .string => return self.findException(value) catch php.createValueNull(),
                .object => {
                    const obj = php.getValueObject(value) catch unreachable;
                    if (obj.ce == php.getClassEntry(.standard)) {
                        const ht = php.getValueHashTable(value) catch unreachable;
                        if (php.getHashEntry(ht, "error") catch null) |msg| {
                            return try self.castValue(msg);
                        }
                    } else if (php.instanceOf(obj, ArrayBuffer.entry())) {
                        return null; // allow default handling
                    }
                },
                else => {},
            }
            const value_d = php.createValueDebug(value);
            defer php.release(&value_d);
            return failure.report("casting operation requires an interger, string, object, or ArrayBuffer as argument, received {s}", .{
                php.getValueStringContent(&value_d) catch unreachable,
            });
        }

        pub fn findException(self: *@This(), value: *const Value) !Value {
            const class = ZigClassEntry.fromStatic(self);
            switch (php.getValueType(value)) {
                .long => {
                    const err_code = php.getValueLong(value) catch unreachable;
                    if (err_code == 0) return php.createValueNull();
                    if (class.host.findException(err_code)) |ex_struct| {
                        return ex_struct.toValue();
                    }
                    // create new exception
                    var text_buffer: [64]u8 = undefined;
                    const text = std.fmt.bufPrint(&text_buffer, "UnknownError #{d}", .{err_code}) catch unreachable;
                    const name = php.createString(text);
                    defer php.release(name);
                    const ex_struct = try class.host.addException(name, err_code);
                    return ex_struct.toValue();
                },
                .string => {
                    const name = php.getValueString(value) catch unreachable;
                    if (class.host.findException(name)) |ex_struct| {
                        if (ex_struct.isPartOf(class)) {
                            return ex_struct.toValue();
                        }
                    }
                    if (class.host.findException(N("Unexpected"))) |ex_struct| {
                        if (ex_struct.isPartOf(class)) {
                            return ex_struct.toValue();
                        }
                    }
                    const es_name = try self.createCanonicalName();
                    defer php.allocator.free(es_name);
                    return failure.report("'{s}' does not correspond to an entry in {s}", .{
                        php.getStringContent(name),
                        es_name,
                    });
                },
                .object => {
                    const err_obj = php.getValueObject(value) catch unreachable;
                    if (ZigException.isInstance(err_obj)) {
                        const ex_struct = ZigException.fromObject(err_obj);
                        if (ex_struct.isPartOf(class)) {
                            return ex_struct.toValue();
                        }
                    }
                    if (php.isException(err_obj)) {
                        const message = try php.getExceptionMessage(err_obj);
                        defer php.release(&message);
                        return self.findException(&message);
                    }
                    return failure.report("'{s}' does not implement throwable", .{
                        php.getStringContent(err_obj.ce.*.name),
                    });
                },
                else => return error.InvalidType,
            }
        }

        pub fn findCanonical(self: *@This(), value: *const Value) !Value {
            return try self.findException(value);
        }

        pub fn findCanonicalInt(self: *@This(), value: *const Value) !Value {
            const ex = try self.findException(value);
            defer php.release(&ex);
            const ex_struct = try ZigException.fromValue(&ex);
            return ex_struct.code;
        }

        fn createCanonicalName(self: *@This()) ![]const u8 {
            const class = ZigClassEntry.fromStatic(self);
            if (class.flags.error_set.is_global) return try php.allocator.dupe(u8, "global error set");
            var iter = class.getMemberIterator(.static);
            const list = try php.allocator.alloc([]const u8, iter.len);
            defer php.allocator.free(list);
            var index: usize = 0;
            while (iter.next()) |_| {
                list[index] = php.getStringContent(iter.currentName().?);
                index += 1;
            }
            const joined = try std.mem.join(php.allocator, ", ", list);
            defer php.allocator.free(joined);
            return if (iter.len <= 1)
                try std.fmt.allocPrint(php.allocator, "error{{{s}}}", .{joined})
            else
                try std.fmt.allocPrint(php.allocator, "error{{ {s} }}", .{joined});
        }
    };

    pub fn getValue(self: *@This(), transform: accessor.Transform) !Value {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        const value = try static.constant_acc.get(self.buffer);
        defer php.release(&value);
        return switch (transform) {
            .none => php.reuse(&value).*,
            .string => {
                const ex_struct = try ZigException.fromValue(&value);
                return php.reuse(&ex_struct.message).*;
            },
            .plain => get: {
                const ex_struct = try ZigException.fromValue(&value);
                const ht = php.createArray();
                php.setHashEntryRef(ht, "error", &ex_struct.message);
                var result = php.createValueArray(ht);
                // convert to stdclass
                try php.convertValue(&result, .object);
                break :get result;
            },
            .integer => get: {
                const ex_struct = try ZigException.fromValue(&value);
                break :get ex_struct.code;
            },
            .boolean => php.createValueBool(true),
            else => return error.Unsupported,
        };
    }

    pub fn setValue(self: *@This(), value: *const Value, transform: accessor.Transform) !void {
        if (try self.copySelf(value)) return;
        if (transform == .none) {
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            try static.constant_acc.set(self.buffer, value);
        } else {
            try Super.setValue(self, value, transform);
        }
    }

    pub fn getPropertiesFor(obj: *Object, purpose_i: c_uint) !*HashTable {
        const purpose: php.PropPurpose = @enumFromInt(purpose_i);
        const self = fromObject(obj);
        switch (purpose) {
            .debug, .json => {
                const value = try self.getValue(.plain);
                return try php.getValueHashTable(&value);
            },
            else => return php.createArray(),
        }
    }

    pub fn compare(a: *Value, b: *Value) !c_int {
        const obj_a = php.getValueObject(a) catch return -1;
        if (php.getValueType(b) == .string) {
            const struct_a = fromObject(obj_a);
            const str_value_a = try struct_a.getValue(.string);
            php.release(&str_value_a);
            const sc_a = php.getValueStringContent(&str_value_a) catch unreachable;
            const sc_b = php.getValueStringContent(b) catch unreachable;
            return switch (std.mem.order(u8, sc_a, sc_b)) {
                .lt => -1,
                .gt => 1,
                .eq => 0,
            };
        }
        const obj_b = php.getValueObject(b) catch return 1;
        if (obj_a == obj_b) return 0;
        if (obj_a.ce != obj_b.ce) {
            return if (@intFromPtr(obj_a.ce) < @intFromPtr(obj_b.ce)) -1 else 1;
        }
        const class = ZigClassEntry.fromObject(obj_a);
        const static = class.getStaticData(@This());
        const struct_a = fromObject(obj_a);
        const struct_b = fromObject(obj_b);
        const value_a = try static.constant_acc.int.get(struct_a);
        const value_b = try static.constant_acc.int.get(struct_b);
        return php.compareValues(&value_a, &value_b);
    }

    pub const getExtent = Super.getExtent;
    pub const setStorage = Super.setStorage;
    pub const initialize = Super.initialize;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const checkArguments = Super.checkArguments;
    pub const getProperty = Super.getProperty;
    pub const setProperty = Super.setProperty;
    pub const propertyExists = Super.propertyExists;
    pub const visitPointers = Super.visitPointers;
    pub const getConstructor = Super.getConstructor;
    pub const cloneObject = Super.cloneObject;
    pub const freeObject = Super.freeObject;
    pub const castObject = Super.castObject;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getProperties = Super.getProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const fromObject = Super.fromObject;
    pub const fromValue = Super.fromValue;
    const copySelf = Super.copySelf;
};
