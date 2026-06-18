const std = @import("std");
const builtin = @import("builtin");

const AbortSignal = @import("../abort-signal.zig").AbortSignal;
const AbortSignalStatic = @import("../abort-signal.zig").AbortSignalStatic;
const accessor = @import("../accessor.zig");
const AllocatorStatic = @import("../allocator.zig").AllocatorStatic;
const ByteBuffer = @import("../buffer.zig").ByteBuffer;
const cache = @import("../cache.zig");
const ZigClassEntry = @import("../class-entry.zig").ZigClassEntry;
const StructurePurpose = @import("../enums.zig").StructurePurpose;
const enums = @import("../enums.zig");
const StructureType = enums.StructureType;
const extension = @import("../extension.zig");
const failure = @import("../failure.zig");
const Error = failure.Error;
const gd = @import("../gd.zig");
const Generator = @import("../generator.zig").Generator;
const GeneratorStatic = @import("../generator.zig").GeneratorStatic;
const iterator = @import("../iterator.zig");
const ZigObject = @import("../object.zig").ZigObject;
const getObjectBuffer = @import("../object.zig").getObjectBuffer;
const php = @import("../php.zig");
const N = php.getStaticString;
const ArgumentIterator = php.ArgumentIterator;
const ClassEntry = php.ClassEntry;
const Function = php.Function;
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const Stream = php.Stream;
const String = php.String;
const FunctionCallCache = php.FunctionCallCache;
const Value = php.Value;
const Promise = @import("../promise.zig").Promise;
const PromiseStatic = @import("../promise.zig").PromiseStatic;
const SpecialExports = @import("../special-exports.zig").SpecialExports;
const structure = @import("../structure.zig");

pub const Struct = struct {
    table: Value = undefined,
    buffer: *ByteBuffer = undefined,

    pub const SpecialArgs = struct {
        allocator: ?Value = null,
        callback: ?Value = null,
        signal: ?Value = null,
        timeout: ?Value = null,
    };

    pub const Super = structure.StructLike(@This());
    pub const Tuple = structure.ArrayLike(@This());
    pub const Static = struct {
        backing_int: ?struct {
            class: *ZigClassEntry,
            accessors: *accessor.Any,
        } = null,
        required_field_count: usize = 0,
        total_field_count: usize = 0,
        special_static: union {
            allocator: *AllocatorStatic,
            promise: *PromiseStatic,
            generator: *GeneratorStatic,
            abort_signal: *AbortSignalStatic,
        } = undefined,
        root: ?*Root = null,

        pub const StaticPropCache = cache.IdCache(.{ .length, .zigar }, "__", .{});
        pub const Root = struct {
            symbol_names: ?*HashTable = null,
            symbol_types: ?*HashTable = null,

            fn deinit(self: *@This()) void {
                if (self.symbol_names) |ht| php.release(ht);
                if (self.symbol_types) |ht| php.release(ht);
                php.allocator.destroy(self);
            }
        };
        const SymbolType = enum { function, class, constant, variable };

        pub fn init(self: *@This(), class_obj: *Object) !void {
            const class = ZigClassEntry.fromObject(class_obj);
            var iter = class.getMemberIterator(.instance);
            // look for backing int
            const backing_int_member = while (iter.next()) |member| {
                if (member.flags.is_backing_int) break member;
            } else null;
            if (backing_int_member) |bim| {
                self.backing_int = .{
                    .class = bim.class,
                    .accessors = &bim.accessors,
                };
            }
            // count the number of required arguments
            iter.reset();
            while (iter.next()) |member| {
                if (member.flags.is_required) self.required_field_count += 1;
                if (iter.currentName() != null) self.total_field_count += 1;
            }
            switch (class.purpose) {
                inline .allocator, .promise, .generator, .abort_signal => |t| {
                    const SpecialStatic = switch (t) {
                        .allocator => AllocatorStatic,
                        .promise => PromiseStatic,
                        .generator => GeneratorStatic,
                        .abort_signal => AbortSignalStatic,
                        else => unreachable,
                    };
                    const ss = try php.allocator.create(SpecialStatic);
                    try ss.init(class);
                    self.special_static = @unionInit(@TypeOf(self.special_static), @tagName(t), ss);
                },
                else => {},
            }
        }

        pub fn deinit(self: *@This()) void {
            if (self.root) |root| root.deinit();
            const class = ZigClassEntry.fromStatic(self);
            switch (class.purpose) {
                inline .allocator, .promise, .generator, .abort_signal => |t| {
                    const ss = @field(self.special_static, @tagName(t));
                    ss.deinit();
                    php.allocator.destroy(ss);
                },
                else => {},
            }
        }

        pub fn markAsRoot(self: *@This()) !void {
            const root = try php.allocator.create(Root);
            root.* = .{};
            self.root = root;
        }

        pub fn getStaticProperty(self: *@This(), name: *String, cache_slot: ?[*]?*anyopaque) !Value {
            if (StaticPropCache.idFromString(name, cache_slot)) |id| {
                const class = ZigClassEntry.fromStatic(self);
                switch (id) {
                    .length => {
                        if (class.flags.@"struct".is_tuple) {
                            const iter = class.getMemberIterator(.instance);
                            return php.createValueAnyInt(iter.len);
                        }
                    },
                    .zigar => {
                        if (self.root != null) {
                            const obj = try SpecialExports.create(class);
                            return php.createValueObject(obj);
                        }
                    },
                }
            }
            return error.Missing;
        }

        pub fn exportSymbolsToGlobalNamespace(self: *@This(), callback: ?*Value) !Value {
            const root = self.root.?;
            if (root.symbol_names != null) return error.CalledAlready;
            var call_cache: FunctionCallCache = if (callback) |cb| try .init(cb) else undefined;
            // add a callback so we can remove the imports prior to request shutdown
            try extension.addRequestShutdownCallback(self, onRequestShutdown);
            // bump the refcount of the class object so exported items don't get gc'ed
            const class = ZigClassEntry.fromStatic(self);
            php.addRef(class.object);
            const symbol_names = php.createArray();
            errdefer php.release(symbol_names);
            const symbol_types = php.createArray();
            errdefer php.release(symbol_types);
            root.symbol_names = symbol_names;
            root.symbol_types = symbol_types;
            errdefer self.removeSymbolsFromGlobalNamespace() catch {};
            const class_struct = structure.Class(structure.Struct).fromObject(class.object);
            var member_iter = class.getMemberIterator(.static);
            while (member_iter.next()) |member| {
                const member_name = member_iter.currentName() orelse continue;
                const symbol_type: SymbolType = find: {
                    const member_entry = try php.getProperty(&class_struct.table, member.slot.?);
                    const member_obj = try php.getValueObject(member_entry);
                    const member_class = ZigClassEntry.fromObject(member_obj);
                    switch (member_class.type) {
                        .function => break :find .function,
                        .@"comptime" => {
                            const member_struct = structure.Comptime.fromObject(member_obj);
                            const target_obj = try php.getValueObject(&member_struct.table);
                            const target_class = ZigClassEntry.fromObject(target_obj);
                            break :find if (target_class.object == target_obj) .class else .constant;
                        },
                        inline else => |t| {
                            const S = @field(structure.by_enum, @tagName(t));
                            const member_struct = S.fromObject(member_obj);
                            const buf = member_struct.buffer;
                            break :find if (buf.flags.read_only) .constant else .variable;
                        },
                    }
                };
                if (symbol_type == .variable) continue;
                const symbol_type_value = php.createValueLong(@intFromEnum(symbol_type));
                const symbol_name_value = get: {
                    if (callback != null) {
                        const cb_args: [2]Value = .{
                            php.createValueString(member_name),
                            switch (symbol_type) {
                                .variable => unreachable,
                                inline else => |t| php.createValueString(N(@tagName(t))),
                            },
                        };
                        break :get try call_cache.invoke(&cb_args);
                    } else {
                        break :get php.createValueString(php.reuse(member_name));
                    }
                };
                defer php.release(&symbol_name_value);
                const symbol_name = php.getValueString(&symbol_name_value) catch {
                    switch (php.getValueType(&symbol_name_value)) {
                        .false, .null => continue,
                        else => return failure.report("callback should return a string or null or false", .{}),
                    }
                };
                const member_value = try member.accessors.get(class_struct);
                defer php.release(&member_value);
                switch (symbol_type) {
                    .function => {
                        const func_obj = try php.getValueObject(&member_value);
                        const func_struct = structure.Function.fromObject(func_obj);
                        const exportable = func_struct.createExportableVersion(symbol_name);
                        try php.registerFunction(symbol_name, exportable);
                    },
                    .class => {
                        const symbol_class_obj = try php.getValueObject(&member_value);
                        const symbol_class = ZigClassEntry.fromObject(symbol_class_obj);
                        const exportable = symbol_class.createExportableVersion(symbol_name);
                        try php.registerClass(symbol_name, exportable);
                    },
                    .constant => {
                        try php.registerConstant(symbol_name, &member_value);
                    },
                    else => unreachable,
                }
                _ = php.appendHashEntryRef(symbol_names, &symbol_name_value);
                _ = php.appendHashEntry(symbol_types, &symbol_type_value);
            }
            return php.createValueArray(php.reuse(symbol_names));
        }

        pub fn removeSymbolsFromGlobalNamespace(self: *@This()) !void {
            const root = self.root.?;
            const symbol_names = root.symbol_names orelse return;
            const symbol_types = root.symbol_types orelse return;
            var iter: HashTableIterator = .init(symbol_names, .{});
            while (iter.next()) |symbol_name_value| {
                const index = iter.currentIndex().?;
                const symbol_type_value = try php.getHashEntry(symbol_types, index);
                const symbol_type_long = try php.getValueLong(symbol_type_value);
                const symbol_type: SymbolType = @enumFromInt(symbol_type_long);
                const symbol_name = try php.getValueString(symbol_name_value);
                switch (symbol_type) {
                    .function => php.unregisterFunction(symbol_name),
                    .class => php.unregisterClass(symbol_name),
                    .constant => php.unregisterConstant(symbol_name),
                    .variable => unreachable,
                }
            }
            php.release(symbol_names);
            php.release(symbol_types);
            root.symbol_names = null;
            root.symbol_types = null;
            // remove reference on class object added by exportSymbolsToGlobalNamespace()
            const class = ZigClassEntry.fromStatic(self);
            php.release(class.object);
            extension.removeRequestShutdownCallback(self, onRequestShutdown);
        }

        fn onRequestShutdown(ptr: *anyopaque) void {
            const self: *@This() = @ptrCast(@alignCast(ptr));
            self.removeSymbolsFromGlobalNamespace() catch {};
        }
    };

    pub fn setStorage(self: *@This(), buffer: *ByteBuffer, table: *const Value) !void {
        try Super.setStorage(self, buffer, table);
        const class = ZigClassEntry.fromStructure(self);
        if (class.flags.@"struct".is_packed) {
            // mark buffer as packed so that child fields that are vectors are correctly handled
            buffer.flags.contains_packed_data = true;
        }
    }

    pub fn checkArguments(self: *@This(), arg_iter: *php.ArgumentIterator) !void {
        if (arg_iter.len != 1) {
            // check if the struct has default values for all fields
            const class = ZigClassEntry.fromStructure(self);
            const static = class.getStaticData(@This());
            if (arg_iter.len != 0 or static.required_field_count != 0) {
                return failure.report("{s} constructor expects an array as argument or named arguments", .{
                    class.getStructureName(),
                });
            }
        }
    }

    pub fn getValue(self: *@This(), transform: accessor.Transform) !Value {
        switch (transform) {
            .string => return error.Unsupported,
            .integer => {
                const class = ZigClassEntry.fromStructure(self);
                const static = class.getStaticData(@This());
                if (static.backing_int) |int| {
                    return try int.accessors.get(self);
                } else {
                    return error.Unsupported;
                }
            },
            .plain => {
                const obj = ZigObject(@This()).fromStructure(self).object();
                const class = ZigClassEntry.fromStructure(self);
                var plain = class.host.getPlainObject(obj, class.flags.@"struct".is_tuple);
                if (plain.status == .existing) return plain.value;
                defer class.host.removePlainObject(obj);
                var iter: iterator.PropertyIterator(@This()) = .init(obj);
                defer iter.deinit();
                while (iter.next()) |prop_value| {
                    try transform.apply(prop_value);
                    plain.add(iter.current_name.?, prop_value);
                }
                return plain.value;
            },
            else => {},
        }
        return Super.getValue(self, transform);
    }

    pub fn setValue(self: *@This(), value: *const Value, transform: accessor.Transform) Error!void {
        const class = ZigClassEntry.fromStructure(self);
        switch (class.purpose) {
            .gd_image => {
                const ptr = gd.getPointer(value) orelse {
                    return failure.report("GD image object expected", .{});
                };
                const ptr_value = php.createValuePointer(ptr);
                try self.setProperty(N("ptr"), &ptr_value, null);
                php.release(&self.table);
                self.table = php.reuse(value).*;
                return;
            },
            .file => {
                if (try self.getStreamHandle(value, false)) |handle| {
                    try self.setProperty(N("handle"), &handle, null);
                    return;
                } else {
                    const arg_d = php.createValueDebug(value);
                    defer php.release(&arg_d);
                    return failure.report("{s} '{s}' expects a file resource pointer from fopen(), received: {s}\n", .{
                        class.getStructureName(),
                        class.getName(),
                        php.getValueStringContent(&arg_d) catch unreachable,
                    });
                }
            },
            .directory => {
                if (try self.getStreamHandle(value, true)) |handle| {
                    try self.setProperty(N("fd"), &handle, null);
                    return;
                } else if (failure.hasMessage()) {
                    return error.Unexpected;
                } else {
                    const arg_d = php.createValueDebug(value);
                    defer php.release(&arg_d);
                    return failure.report("{s} '{s}' expects a directory handle from opendir(), received: {s}\n", .{
                        class.getStructureName(),
                        class.getName(),
                        php.getValueStringContent(&arg_d) catch unreachable,
                    });
                }
            },
            else => {},
        }
        if (transform == .none) {
            if (try Super.copySelf(self, value)) return;
            const static = class.getStaticData(@This());
            if (static.backing_int) |backing_int| {
                // see if value is a number for the backing int
                if (backing_int.accessors.set(self, value)) {
                    return;
                } else |_| {}
            }
            const ht = try php.getValueHashTable(value);
            const value_count = php.getHashLength(ht);
            var member_iter = class.getMemberIterator(.instance);
            if (class.flags.@"struct".is_tuple) {
                if (!php.isNormalArray(ht)) {
                    return failure.report("Tuple expects an index array", .{});
                }
                if (value_count != member_iter.len) {
                    return failure.reportLengthMismatch(class, member_iter.len, value_count);
                }
                var value_iter: HashTableIterator = .init(ht, .{});
                while (value_iter.next()) |element| {
                    const member = member_iter.next() orelse return error.Unexpected;
                    try member.accessors.set(self, element);
                }
                return;
            }
            // copy default values from template unless the number of initializers matches the number of fields
            if (value_count < static.total_field_count) {
                if (class.instance.template.buffer) |def| {
                    try self.buffer.copy(def);
                }
                // we need to track whether all required members are set
                while (member_iter.next()) |member| member.set = false;
            }
            var special_used: usize = 0;
            var unused: std.ArrayList([]const u8) = .empty;
            defer {
                for (unused.items) |item| php.allocator.free(item);
                unused.deinit(php.allocator);
            }
            var value_iter: HashTableIterator = .init(ht, .{});
            while (value_iter.next()) |member_value| {
                if (value_iter.currentName()) |name| {
                    if (Super.findMember(self, name, null)) |member| {
                        try member.accessors.set(self, member_value);
                        @constCast(member).set = true;
                    } else {
                        // maybe it's a special property
                        if (Super.setProperty(self, name, member_value, null)) {
                            special_used += 1;
                        } else |err| {
                            if (err != error.Missing) return err;
                            const label = try std.fmt.allocPrint(php.allocator, "'{s}'", .{
                                php.getStringContent(name),
                            });
                            try unused.append(php.allocator, label);
                        }
                    }
                } else if (value_iter.currentIndex()) |index| {
                    const label = try std.fmt.allocPrint(php.allocator, "{d}", .{index});
                    try unused.append(php.allocator, label);
                }
            }
            if (unused.items.len > 0) {
                const list = try std.mem.join(php.allocator, ", ", unused.items);
                defer php.allocator.free(list);
                const suffix = if (unused.items.len > 1) "s" else "";
                return failure.report("unused initializer{s}: {s}", .{ suffix, list });
            }
            if (special_used == 0 and value_count < static.total_field_count) {
                // see if any required field was missed
                var missing: std.ArrayList([]const u8) = .empty;
                defer {
                    for (missing.items) |item| php.allocator.free(item);
                    missing.deinit(php.allocator);
                }
                member_iter.reset();
                while (member_iter.next()) |member| {
                    const name = member_iter.currentName() orelse continue;
                    if (!member.set and member.flags.is_required) {
                        const label = try std.fmt.allocPrint(php.allocator, "'{s}'", .{
                            php.getStringContent(name),
                        });
                        try missing.append(php.allocator, label);
                    }
                }
                if (missing.items.len > 0) {
                    const list = try std.mem.join(php.allocator, ", ", missing.items);
                    defer php.allocator.free(list);
                    const suffix = if (missing.items.len > 1) "s" else "";
                    return failure.report("missing initializer{s} for required field{s}: {s}", .{
                        suffix,
                        suffix,
                        list,
                    });
                }
            }
            return;
        }
        return Super.setValue(self, value, transform);
    }

    pub fn getElement(self: *@This(), index: usize) !Value {
        const class = ZigClassEntry.fromStructure(self);
        var iter = class.getMemberIterator(.instance);
        var i: usize = 0;
        while (iter.next()) |m| {
            if (i == index) return try m.accessors.get(self);
            i += 1;
        }
        return error.OutOfBound;
    }

    pub fn setElement(self: *@This(), index: usize, value: *const Value) !void {
        const class = ZigClassEntry.fromStructure(self);
        var iter = class.getMemberIterator(.instance);
        var i: usize = 0;
        while (iter.next()) |m| {
            if (i == index) return try m.accessors.set(self, value);
            i += 1;
        }
        return error.OutOfBound;
    }

    pub fn getLength(self: *@This()) usize {
        const class = ZigClassEntry.fromStructure(self);
        const iter = class.getMemberIterator(.instance);
        return iter.len;
    }

    pub fn findMethod(self: *@This(), name: *String) !?*php.Function {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        return switch (class.purpose) {
            .allocator => static.special_static.allocator.findMethod(name),
            .promise => static.special_static.promise.findMethod(name),
            .generator => static.special_static.generator.findMethod(name),
            .abort_signal => static.special_static.abort_signal.findMethod(name),
            else => try Super.findMethod(self, name),
        };
    }

    pub fn visitPointers(self: *@This(), cb: anytype, args: anytype, comptime options: structure.VisitOptions) Error!void {
        const class = ZigClassEntry.fromStructure(self);
        if (class.flags.common.has_pointer) {
            var iter = class.getMemberIterator(.instance);
            while (iter.next()) |member| {
                if (member.class.flags.common.has_pointer) {
                    if (try member.accessors.getObject(self, options.ignore_uncreated)) |obj| {
                        try structure.invokeMethod(obj, "visitPointers", .{ cb, args, options });
                    }
                }
            }
        }
    }

    pub fn getAllocator(self: *@This()) !*std.mem.Allocator {
        const bytes = try self.buffer.data(0, false);
        return @ptrCast(@alignCast(@constCast(bytes.ptr)));
    }

    pub fn initSpecial(self: *@This(), comptime T: type, args: SpecialArgs) !void {
        const class = ZigClassEntry.fromStructure(self);
        const static = class.getStaticData(@This());
        switch (T) {
            std.mem.Allocator => {
                if (args.allocator) |av| if (php.getValuePointer([*]u8, &av) catch null) |byte_ptr| {
                    const bytes = byte_ptr[0..@sizeOf(std.mem.Allocator)];
                    try self.buffer.copyBytes(bytes);
                } else {
                    const src_obj = try php.getValueObject(&av);
                    const src_class = ZigClassEntry.fromObject(src_obj);
                    if (src_class.type != .@"struct" or src_class.purpose != .allocator) {
                        return error.NotAllocator;
                    }
                    const src_struct = fromObject(src_obj);
                    try self.buffer.copy(src_struct.buffer);
                } else {
                    const byte_ptr: [*]u8 = @ptrCast(&class.host.allocator);
                    const bytes = byte_ptr[0..@sizeOf(std.mem.Allocator)];
                    try self.buffer.copyBytes(bytes);
                }
            },
            Promise, Generator => {
                const ctx = try T.create(args.callback);
                const ptr_value = php.createValuePointer(ctx.buffer.bytes.ptr);
                try self.setProperty(N("ptr"), &ptr_value, null);
                const ss = switch (T) {
                    Promise => static.special_static.promise,
                    Generator => static.special_static.generator,
                    else => unreachable,
                };
                const callback_value = php.createValueObject(ss.callback);
                try self.setProperty(N("callback"), &callback_value, null);
                if (class.getMember(.instance, N("allocator")) catch null) |m| {
                    const allocator = try m.accessors.get(self);
                    defer php.release(&allocator);
                    const allocator_struct = try structure.Struct.fromValue(&allocator);
                    try allocator_struct.initSpecial(std.mem.Allocator, args);
                }
            },
            AbortSignal => {
                const signal = if (args.signal) |av|
                    try AbortSignal.fromValue(php.reuse(&av))
                else
                    try AbortSignal.create(args.timeout);
                const ptr_value = php.createValuePointer(&signal.value);
                try self.setProperty(N("ptr"), &ptr_value, null);
            },
            else => {},
        }
        switch (T) {
            Promise, Generator, AbortSignal => self.buffer.flags.contains_special_contents = true,
            else => {},
        }
    }

    pub fn getSpecialContext(self: *@This(), comptime T: type) !*T {
        const ptr = try self.getProperty(N("ptr"), null);
        defer php.release(&ptr);
        const ptr_struct = try structure.Pointer.fromValue(&ptr);
        const target = try ptr_struct.getValue(.none);
        defer php.release(&target);
        const context = accessor.getOpaqueTarget(T, &target);
        return context;
    }

    pub fn freeObject(obj: *Object) void {
        const class = ZigClassEntry.fromObject(obj);
        const self = fromObject(obj);
        switch (class.purpose) {
            .file => if (self.getProperty(N("handle"), null) catch null) |handle| {
                if (getDescriptor(&handle) catch null) |fd| {
                    if (class.host.dispatcher.isVirtualStream(fd)) {
                        class.host.dispatcher.removeStream(fd) catch {};
                    }
                }
            },
            .directory => if (self.getProperty(N("fd"), null) catch null) |handle| {
                if (getDescriptor(&handle) catch null) |fd| {
                    if (class.host.dispatcher.isVirtualStream(fd)) {
                        class.host.dispatcher.removeStream(fd) catch {};
                    }
                }
            },
            inline .promise, .generator, .abort_signal => |t| {
                if (self.buffer.flags.contains_special_contents) {
                    const T = switch (t) {
                        .promise => Promise,
                        .generator => Generator,
                        .abort_signal => AbortSignal,
                        else => unreachable,
                    };
                    if (self.getSpecialContext(T) catch null) |ctx| ctx.release();
                }
            },
            else => {},
        }
        Super.freeObject(obj);
    }

    pub fn compare(a: *Value, b: *Value) !c_int {
        const b_is_int = check: {
            switch (php.getValueType(b)) {
                .long, .double, .string => break :check true,
                .object => {
                    const obj_b = php.getValueObject(b) catch unreachable;
                    if (php.isGmpObject(obj_b)) break :check true;
                },
                else => {},
            }
            break :check false;
        };
        if (b_is_int) {
            const obj_a = php.getValueObject(a) catch return -1;
            const struct_a = fromObject(obj_a);
            const class = ZigClassEntry.fromObject(obj_a);
            const static = class.getStaticData(@This());
            if (static.backing_int) |int| {
                const backing_value = try int.accessors.get(struct_a);
                return php.compareValues(&backing_value, b);
            }
        }
        return Super.compare(a, b);
    }

    pub fn getIterator(obj: *Object) !?*ObjectIterator {
        const class = ZigClassEntry.fromObject(obj);
        return if (class.flags.@"struct".is_tuple)
            try iterator.TupleIterator.create(obj)
        else switch (class.purpose) {
            .iterator => try iterator.IteratorIterator.create(obj),
            .generator => try iterator.GeneratorIterator.create(obj),
            else => try Super.getIterator(obj),
        };
    }

    extern fn _get_osfhandle(fd: c_int) std.os.windows.HANDLE;

    fn getStreamHandle(self: *@This(), value: *const Value, is_dir: bool) !?Value {
        const class = ZigClassEntry.fromStructure(self);
        if (!class.host.isRedirecting()) {
            return failure.report("redirection disabled", .{});
        }
        const strm = php.getValueStream(value) catch return null;
        if (php.getDescriptor(strm)) |fd| {
            if (builtin.target.os.tag == .windows) {
                const handle = _get_osfhandle(fd);
                return php.createValuePointer(handle);
            } else {
                return php.createValueAnyInt(fd);
            }
        } else {
            // not a real file/dir--create a virtual descriptor
            if (class.host.dispatcher.addStream(strm, is_dir) catch null) |fd| {
                if (builtin.target.os.tag == .windows) {
                    // the fake win32 handle for a virtual file is its descriptor left-shifted by 1
                    const handle: *anyopaque = @ptrFromInt(fd << 1);
                    return php.createValuePointer(handle);
                } else {
                    return php.createValueAnyInt(fd);
                }
            }
        }
        return null;
    }

    fn getDescriptor(value: *const Value) !c_long {
        if (builtin.target.os.tag == .windows) {
            const ptr_struct = try structure.Pointer.fromValue(value);
            const address = try ptr_struct.getAddress();
            return @intCast(address >> 1);
        } else {
            return try php.getValueLong(value);
        }
    }

    pub const initialize = Super.initialize;
    pub const finalize = Super.finalize;
    pub const externalize = Super.externalize;
    pub const getExtent = Super.getExtent;
    pub const getProperty = Super.getProperty;
    pub const setProperty = Super.setProperty;
    pub const propertyExists = Super.propertyExists;
    pub const getConstructor = Super.getConstructor;
    pub const castObject = Super.castObject;
    pub const getMethod = Super.getMethod;
    pub const readProperty = Super.readProperty;
    pub const writeProperty = Super.writeProperty;
    pub const hasProperty = Super.hasProperty;
    pub const getProperties = Super.getProperties;
    pub const getPropertyPointer = Super.getPropertyPointer;
    pub const readElement = Tuple.readElement;
    pub const writeElement = Tuple.writeElement;
    pub const hasElement = Tuple.hasElement;
    pub const countElements = Tuple.countElements;
    pub const getGarbageCollection = Super.getGarbageCollection;
    pub const fromObject = Super.fromObject;
    pub const fromValue = Super.fromValue;
    pub const toValue = Super.toValue;
};
