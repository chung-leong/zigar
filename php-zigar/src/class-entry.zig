const std = @import("std");

const AbortSignal = @import("abort-signal.zig").AbortSignal;
const accessor = @import("accessor.zig");
const ByteBuffer = @import("buffer.zig").ByteBuffer;
const enums = @import("enums.zig");
const MemberFlags = enums.MemberFlags;
const MemberType = enums.MemberType;
const StructureFlags = enums.StructureFlags;
const StructurePurpose = enums.StructurePurpose;
const StructureType = enums.StructureType;
const Host = @import("host.zig").ModuleHost;
const php = @import("php.zig");
const ArgumentIterator = php.ArgumentIterator;
const ClassEntry = php.ClassEntry;
const ExecuteData = php.ExecuteData;
const Function = php.Function;
const HashTable = php.HashTable;
const HashTableIterator = php.HashTableIterator;
const HashTableObjectIterator = php.HashTableObjectIterator;
const Object = php.Object;
const ObjectIterator = php.ObjectIterator;
const String = php.String;
const Value = php.Value;
const structure = @import("structure.zig");
const ZigObject = @import("object.zig").ZigObject;

pub const ZigClassEntry = struct {
    host: *Host,
    type: StructureType,
    purpose: StructurePurpose,
    flags: StructureFlags,
    alignment: std.mem.Alignment,
    signature: u64,
    length: ?usize,
    byte_size: ?usize,
    instance: Scope = undefined,
    static: Scope = undefined,
    status: packed struct {
        defined: bool = false,
        finalized: bool = false,
        activated: bool = false,
    } = .{},
    static_data: StaticData = undefined,
    php_portion: ClassEntry = undefined,

    pub const ScopeType = enum { instance, static };

    pub const Member = struct {
        type: MemberType,
        flags: MemberFlags,
        bit_offset: ?usize,
        bit_size: usize,
        byte_size: ?usize,
        slot: ?usize,
        class: *ZigClassEntry = undefined,
        accessors: accessor.Any = undefined,

        pub fn destructor(value: [*c]Value) callconv(.c) void {
            const member = php.getValuePointer(*Member, value) catch unreachable;
            if (!member.flags.is_self_referencing and !member.flags.is_missing_class) {
                member.class.release();
            }
            if (member.accessors == .constant) {
                member.accessors.constant.deinit();
            }
            php.allocator.destroy(member);
        }

        pub fn objectTransform(self: *const @This()) ?accessor.ObjectTransform {
            if (self.flags.is_missing_class) return null;
            return if (self.flags.is_string or self.type == .literal)
                .to_string
            else if (self.flags.is_plain)
                .to_plain
            else if (self.class.flags.common.has_value or self.class.flags.common.has_proxy)
                .to_value
            else
                null;
        }
    };
    pub const Template = struct {
        buffer: ?*ByteBuffer = null,
        table: ?*Value = null,

        fn release(self: *@This()) void {
            if (self.buffer) |b| b.release();
            if (self.table) |t| {
                php.release(t);
                php.allocator.destroy(t);
            }
        }
    };
    const Scope = struct {
        members: HashTable,
        template: Template,
        slot_count: usize,

        pub fn release(self: *@This()) void {
            php.destroyHashTable(&self.members);
            self.template.release();
        }
    };
    const StaticData = define: {
        const fields = std.meta.fields(@TypeOf(structure.by_enum));
        var new_fields: [fields.len]std.builtin.Type.UnionField = undefined;
        for (fields, 0..) |field, i| {
            const S = @field(structure.by_enum, field.name);
            const StructureStatic = if (@hasDecl(S, "Static")) S.Static else void;
            new_fields[i] = .{
                .name = field.name,
                .type = StructureStatic,
                .alignment = @alignOf(StructureStatic),
            };
        }
        break :define @Type(.{
            .@"union" = .{
                .layout = .auto,
                .decls = &.{},
                .fields = &new_fields,
                .tag_type = null,
            },
        });
    };

    pub inline fn entry(self: *@This()) *ClassEntry {
        return &self.php_portion;
    }

    pub inline fn fromEntry(ce: *ClassEntry) *@This() {
        return @fieldParentPtr("php_portion", ce);
    }

    pub inline fn fromObject(obj: *Object) *@This() {
        return fromEntry(obj.ce);
    }

    pub inline fn fromStructure(s: anytype) *@This() {
        const S = @TypeOf(s.*);
        const zig_obj = ZigObject(S).fromStructure(s);
        return fromObject(zig_obj.object());
    }

    pub inline fn fromStatic(s: anytype) *@This() {
        const S = @TypeOf(s.*);
        const field_name = inline for (std.meta.fields(StaticData)) |field| {
            if (field.type == S) break field.name;
        } else @compileError("Not part of static data union " ++ @typeName(S));
        const sd_ptr: *StaticData = @fieldParentPtr(field_name, s);
        return @fieldParentPtr("static_data", sd_ptr);
    }

    pub fn hasInterface(self: *@This(), interface_ce: *const php.ClassEntry) bool {
        return php.instanceOf(self.entry(), interface_ce);
    }

    pub fn hasMethods(self: *@This()) bool {
        return switch (self.type) {
            .@"struct", .@"union", .@"enum", .@"opaque" => true,
            else => false,
        };
    }

    pub fn addRef(self: *@This()) void {
        self.php_portion.refcount += 1;
    }

    pub fn release(self: *@This()) void {
        self.php_portion.refcount -= 1;
        if (self.php_portion.refcount == 0) {
            // std.debug.print("freeing class {s} ({s})\n", .{
            //     self.getName(),
            //     self.getStructureName(),
            // });
            if (self.status.activated) {
                self.host.release();
            }
            if (self.status.defined) {
                self.instance.release();
            }
            if (self.status.finalized) {
                self.static.release();
                // free static data
                switch (self.type) {
                    inline else => |t| {
                        const name = @tagName(t);
                        if (@FieldType(StaticData, name) != void) {
                            const data = &@field(self.static_data, name);
                            const Data = @TypeOf(data.*);
                            if (Data != void and @hasDecl(Data, "deinit")) data.deinit();
                        }
                    },
                }
            }
            freeEntry(self.entry());
            php.allocator.destroy(self);
        }
    }

    fn freeEntry(ce: *ClassEntry) void {
        if (ce.name) |n| php.release(n);
        if (ce.info.user.filename) |f| php.release(f);
        if (ce.unnamed_2.interfaces) |ptr| {
            const list = ptr[0..@as(usize, ce.num_interfaces)];
            php.allocator.free(list);
        }
    }

    pub fn get(obj: *Object, comptime is_error: bool) ?*@This() {
        const parent_ce = switch (is_error) {
            true => global_error_class,
            false => global_class,
        };
        return if (php.instanceOf(obj.ce, parent_ce)) fromObject(obj) else null;
    }

    pub fn create(host: *Host, info: *Value) !*Object {
        errdefer |err| std.debug.print("create => {}\n", .{err});
        var self: *@This() = try php.allocator.create(@This());
        errdefer php.allocator.destroy(self);
        const alignment = php.getPropertyWithType(usize, info, "align") catch 1;
        if (!std.math.isPowerOfTwo(alignment)) return error.InvalidAlignment;
        self.* = .{
            .host = host,
            .type = try php.getPropertyWithType(StructureType, info, "type"),
            .purpose = try php.getPropertyWithType(StructurePurpose, info, "purpose"),
            .flags = try php.getPropertyWithType(?StructureFlags, info, "flags") orelse @bitCast(@as(u32, 0)),
            .alignment = std.mem.Alignment.fromByteUnits(alignment),
            .length = try php.getPropertyWithType(?usize, info, "length"),
            .byte_size = try php.getPropertyWithType(?usize, info, "byteSize"),
            .signature = get: {
                const sig = try php.getProperty(info, "signature");
                if (php.getValueDouble(sig)) |d|
                    break :get @intFromFloat(d)
                else |_| if (php.getValueLong(sig)) |l|
                    break :get @intCast(l)
                else |_|
                    return error.InvalidSignature;
            },
        };
        const interfaces = try self.createInterfaceList();
        const ce = &self.php_portion;
        const name = if (php.getProperty(info, "name")) |value| use: {
            const str = try php.getValueString(value);
            php.addRef(str);
            break :use str;
        } else |_| php.createString(""); // use an empty string for now
        ce.* = .{
            .type = php.INTERNAL_CLASS,
            .refcount = 1,
            .name = name,
            .ce_flags = php.LINKED | php.RESOLVED_INTERFACES,
            .properties_info = php.createHashTable(null),
            .constants_table = php.createHashTable(null),
            .function_table = php.createHashTable(php.destructor.function),
            .num_interfaces = @intCast(interfaces.len),
            .unnamed_0 = .{
                .parent = self.getParentClass(),
            },
            .unnamed_1 = .{
                .create_object = php.transform(handleCreateObject),
            },
            .unnamed_2 = .{
                .interfaces = if (interfaces.len > 0) @ptrCast(interfaces.ptr) else null,
            },
            .info = .{
                .user = .{
                    .filename = php.createString("filename"),
                },
            },
        };
        // create the class object
        const class_obj = switch (self.type) {
            inline else => |t| create: {
                const S = @field(structure.by_enum, @tagName(t));
                const C = structure.Class(S);
                const class_zobj = try ZigObject(C).create(self);
                break :create class_zobj.object();
            },
        };
        // removing the initial refcount now that class_obj is holding a ref to this
        self.release();
        return class_obj;
    }

    pub fn defineStructure(class_obj: *Object, info: *Value) !void {
        // when this function is called, the only info related to the structure's "shape" is available
        errdefer |err| std.debug.print("defineStructure => {}\n", .{err});
        const self = fromObject(class_obj);
        self.instance = try self.extractScope(info, .instance);
        errdefer self.instance.release();
        switch (self.type) {
            .array => if (self.flags.array.has_slot) {
                self.instance.slot_count = self.length orelse return error.Unexpected;
            },
            .vector => if (self.flags.vector.has_slot) {
                self.instance.slot_count = self.length orelse return error.Unexpected;
            },
            .slice => if (self.flags.slice.has_slot) {
                self.instance.slot_count = std.math.maxInt(usize);
            },
            .pointer => {
                // add implicit members for pointer (address and possibly length)
                const byte_size = self.byte_size orelse return error.Unexpected;
                const count = byte_size / @sizeOf(usize);
                for (0..count) |i| {
                    const member = try php.allocator.create(Member);
                    errdefer php.allocator.destroy(member);
                    member.* = .{
                        .type = MemberType.uint,
                        .flags = .{ .is_missing_class = true },
                        .bit_offset = @bitSizeOf(usize) * i,
                        .bit_size = @bitSizeOf(usize),
                        .byte_size = @sizeOf(usize),
                        .slot = null,
                    };
                    var member_ptr = php.createValuePointer(member);
                    php.setHashEntry(&self.instance.members, 1 + i, &member_ptr);
                    member.accessors = try self.getAccessors(member, .instance, self.instance.slot_count);
                }
            },
            else => {},
        }
        self.status.defined = true;
    }

    pub fn finalizeStructure(class_obj: *Object, info: *Value) !void {
        // when this function is called, the static info has become available
        errdefer |err| std.debug.print("finalizeStructure => {}\n", .{err});
        const self = fromObject(class_obj);
        self.static = try self.extractScope(info, .static);
        errdefer self.static.release();
        switch (self.type) {
            .@"struct", .@"union", .@"enum", .@"opaque" => {
                // add getters/setters;
                var iter: HashTableObjectIterator(*Member) = .init(&self.static.members, .{});
                while (iter.next()) |member| {
                    if (member.flags.is_missing_class) continue;
                    if (member.class.type != .function) continue;
                    const name = iter.currentName() orelse continue;
                    const name_c = php.getStringContent(name);
                    if (name_c.len < 5 or !std.ascii.isWhitespace(name_c[3])) continue;
                    // jump over white-spaces
                    const ws_count = for (name_c[4..], 0..) |c, i| {
                        if (!std.ascii.isWhitespace(c)) break i + 1;
                    } else continue;
                    // get length of name
                    const name_len = for (name_c[3 + ws_count ..], 0..) |c, i| {
                        if (std.ascii.isWhitespace(c)) break i;
                    } else name_c.len - 3 - ws_count;
                    if (name_len == 0) continue;
                    const access_name = name_c[0..3];
                    const access: accessor.FieldAccess = if (std.mem.eql(u8, access_name, "get"))
                        .read
                    else if (std.mem.eql(u8, access_name, "set"))
                        .write
                    else
                        continue;
                    const si = 3 + ws_count;
                    const ei = si + name_len;
                    const prop_name = php.createString(name_c[si..ei]);
                    defer php.release(prop_name);
                    const expected_arg_count: usize = switch (access) {
                        .read => if (member.flags.is_method) 1 else 0,
                        .write => if (member.flags.is_method) 2 else 1,
                    };
                    if (member.class.length != expected_arg_count) continue;
                    const scope = switch (member.flags.is_method) {
                        true => &self.instance,
                        false => &self.static,
                    };
                    const prop_acc: *accessor.Property = get: {
                        if (php.getHashEntry(&scope.members, prop_name)) |value| {
                            const existing_member = try php.getValuePointer(*Member, value);
                            if (existing_member.accessors == .property) {
                                break :get &existing_member.accessors.property;
                            }
                        } else |_| {}
                        const new_member = try php.allocator.create(Member);
                        new_member.* = .{
                            .type = .void,
                            .flags = .{ .is_missing_class = true },
                            .bit_offset = 0,
                            .bit_size = 0,
                            .byte_size = null,
                            .slot = null,
                            .accessors = .{ .property = .{} },
                        };
                        const new_member_value = php.createValuePointer(new_member);
                        php.setHashEntry(&scope.members, prop_name, &new_member_value);
                        break :get &new_member.accessors.property;
                    };
                    switch (access) {
                        .read => prop_acc.getter = name,
                        .write => prop_acc.setter = name,
                    }
                }
            },
            else => {},
        }
        // set table of class object
        const table = try self.createTable(.static, null);
        // php.release(&table);
        switch (self.type) {
            inline else => |t| {
                const S = @field(structure.by_enum, @tagName(t));
                const C = structure.Class(S);
                const class_struct = ZigObject(C).fromObject(class_obj).structure();
                try class_struct.setStorage(undefined, &table);
                try class_struct.finalize(false);
            },
        }
        // initialize static data
        switch (self.type) {
            inline else => |t| {
                const name = @tagName(t);
                if (@FieldType(StaticData, name) != void) {
                    self.static_data = @unionInit(StaticData, name, .{});
                    const data = &@field(self.static_data, name);
                    try data.init(class_obj);
                }
            },
        }
        // attach class methods
        const ce = self.entry();
        switch (self.type) {
            inline else => |t| {
                const S = @field(structure.by_enum, @tagName(t));
                const C = structure.Class(S);
                // methods that are implemented as function objects
                const methods = C.getMethods();
                inline for (comptime std.meta.fieldNames(C.Methods)) |name| {
                    @field(ce, name) = &@field(methods, name);
                }
                // methods that use direct callbacks
                if (@hasDecl(S, "getIterator")) {
                    ce.get_iterator = getIteratorHandler(S);
                }
            },
        }
        self.status.finalized = true;
    }

    pub fn activate(obj: *Object) void {
        // this method is called when the host is about to release the structure map
        const self = fromObject(obj);
        self.host.addRef();
        self.status.activated = true;
    }

    pub fn getFlags(self: *@This(), comptime S: type) @FieldType(StructureFlags, structure.enumName(S)) {
        return @field(self.flags, structure.enumName(S));
    }

    pub fn getStaticData(self: *@This(), comptime S: type) *@FieldType(StaticData, structure.enumName(S)) {
        return &@field(self.static_data, structure.enumName(S));
    }

    pub fn getStructureName(self: *const @This()) []const u8 {
        return switch (self.type) {
            .error_union => "error union",
            .error_set => "error set",
            inline else => |e| @tagName(e),
        };
    }

    pub fn getName(self: *@This()) []const u8 {
        if (self.php_portion.name.*.len == 0) {
            self.php_portion.name = self.inferName() catch php.persistent("Unknown");
        }
        return php.getStringContent(self.php_portion.name);
    }

    pub fn getSlotCount(self: *@This(), comptime scope: ScopeType) usize {
        return switch (scope) {
            inline else => |s| @field(self, @tagName(s)).slot_count,
        };
    }

    pub fn getMember(self: *@This(), comptime scope: ScopeType, key: anytype) !*Member {
        switch (scope) {
            inline else => |s| {
                const container = &@field(self, @tagName(s));
                const value = try php.getHashEntry(&container.members, key);
                return php.getValuePointer(*Member, value) catch unreachable;
            },
        }
    }

    pub fn getMemberIterator(self: *@This(), comptime scope: ScopeType) HashTableObjectIterator(*Member) {
        switch (scope) {
            inline else => |s| {
                const container = &@field(self, @tagName(s));
                return .init(&container.members, .{});
            },
        }
    }

    pub fn createPropertyList(self: *@This(), comptime scope: ScopeType) ![]*String {
        const is_tagged_union = self.type == .@"union" and self.flags.@"union".has_tag;
        var prop_names: []*String = &.{};
        var prop_count: usize = 0;
        var index: usize = 0;
        var iter = self.getMemberIterator(scope);
        for (1..3) |stage| {
            while (iter.next()) |m| {
                if (m.accessors == .property and m.accessors.property.getter == null) continue;
                if (iter.currentName() == null) continue;
                if (is_tagged_union and m.accessors != .property) continue;
                if (stage == 1) {
                    prop_count += 1;
                } else if (stage == 2) {
                    prop_names[index] = iter.currentName().?;
                    index += 1;
                }
            }
            if (stage == 1) {
                if (prop_count == 0) break;
                prop_names = try php.allocator.alloc(*String, prop_count);
                iter.reset();
            }
        }
        return prop_names;
    }

    pub fn checkByteLength(self: *@This(), len: usize) !void {
        const element_size = self.byte_size orelse return;
        if (self.type == .slice) {
            const remainder = @rem(len, element_size);
            if (remainder != 0) {
                return php.throwExceptionFmt("'{s}'' has elements that are {d} byte{s} in length, received {d}", .{
                    self.getName(),
                    element_size,
                    if (element_size != 1) "s" else "",
                    len,
                });
            }
        } else {
            if (element_size != len) {
                return php.throwExceptionFmt("{s} has {d} byte{s}, received {d}", .{
                    self.getName(),
                    element_size,
                    if (element_size != 1) "s" else "",
                    len,
                });
            }
        }
    }

    pub fn getPointerTarget(self: *@This()) !*@This() {
        return switch (self.type) {
            .pointer => get: {
                const target_value = try php.getHashEntry(&self.instance.members, 0);
                const target_member = try php.getValuePointer(*Member, target_value);
                break :get target_member.class;
            },
            .error_union, .optional => get: {
                const payload_value = try php.getHashEntry(&self.instance.members, 0);
                const payload_member = try php.getValuePointer(*Member, payload_value);
                const payload_class = payload_member.class;
                break :get try payload_class.getPointerTarget();
            },
            else => error.NotPointer,
        };
    }

    fn createInterfaceList(self: *@This()) ![]*ClassEntry {
        var buffer: [16]*ClassEntry = undefined;
        var count: usize = 0;
        switch (self.type) {
            .@"enum" => {
                buffer[count] = php.getInterface(.stringable);
                count += 1;
            },
            .array, .vector, .slice => {
                buffer[count] = php.getInterface(.array_access);
                count += 1;
                buffer[count] = php.getInterface(.traversable);
                count += 1;
            },
            .error_set => {
                buffer[count] = php.getInterface(.throwable);
                count += 1;
            },
            .@"struct" => switch (self.purpose) {
                .generator, .iterator => {
                    buffer[count] = php.getInterface(.traversable);
                    count += 1;
                },
                else => {},
            },
            else => {},
        }
        if (count == 0) return &.{};
        const interfaces = try php.allocator.alloc(*ClassEntry, count);
        @memcpy(interfaces, buffer[0..count]);
        return interfaces;
    }

    fn extractScope(self: *@This(), info: *Value, comptime scope: ScopeType) !Scope {
        const scope_info = try php.getProperty(info, @tagName(scope));
        var members = try self.extractMembers(scope_info);
        errdefer php.destroyHashTable(&members);
        const template_info = php.getProperty(scope_info, "template") catch null;
        const template = try self.extractTemplate(template_info);
        // count the number of slots used
        var iter: HashTableObjectIterator(*Member) = .init(&members, .{});
        var slot_count: usize = 0;
        while (iter.next()) |member| {
            switch (member.type) {
                .object, .type, .literal => slot_count += 1,
                else => {},
            }
        }
        // attach accessors to members
        iter.reset();
        while (iter.next()) |member| {
            member.accessors = try self.getAccessors(member, scope, slot_count);
        }
        return .{ .members = members, .template = template, .slot_count = slot_count };
    }

    fn extractMembers(self: *@This(), scope_info: *Value) !HashTable {
        var result = php.createHashTable(Member.destructor);
        const member_list = php.getProperty(scope_info, "members") catch return result;
        const member_list_ht = try php.getValueHashTable(member_list);
        var iter: HashTableIterator = .init(member_list_ht, .{});
        while (iter.next()) |member_info| {
            const member_ht = try php.getValueHashTable(member_info);
            const name = php.getHashEntry(member_ht, "name") catch null;
            const member = try php.allocator.create(Member);
            errdefer php.allocator.destroy(member);
            member.* = .{
                .type = try php.getHashEntryWithType(MemberType, member_ht, "type"),
                .flags = try php.getHashEntryWithType(?MemberFlags, member_ht, "flags") orelse .{},
                .bit_offset = try php.getHashEntryWithType(?usize, member_ht, "bitOffset"),
                .bit_size = try php.getHashEntryWithType(?usize, member_ht, "bitSize") orelse 0,
                .byte_size = try php.getHashEntryWithType(?usize, member_ht, "byteSize"),
                .slot = try php.getHashEntryWithType(?usize, member_ht, "slot"),
            };
            if (php.getHashEntry(member_ht, "structure")) |struct_info| {
                const ref = try php.getProperty(struct_info, "class");
                const obj = try php.getValueObject(ref);
                const class = fromObject(obj);
                member.class = class;
                member.flags.is_self_referencing = class == self;
                if (class != self) class.addRef();
            } else |_| {
                member.flags.is_missing_class = true;
            }
            const member_ptr = php.createValuePointer(member);
            if (name) |n| {
                const key = try php.getValueString(n);
                php.setHashEntry(&result, key, &member_ptr);
            } else {
                php.setHashEntry(&result, iter.currentIndex().?, &member_ptr);
            }
        }
        return result;
    }

    fn extractTemplate(_: *@This(), template_info: ?*Value) !Template {
        var template: Template = .{};
        if (template_info) |info| {
            if (php.getProperty(info, "buffer")) |value| {
                const buf = try php.getValuePointer(*ByteBuffer, value);
                buf.addRef();
                template.buffer = buf;
            } else |_| {}
            if (php.getProperty(info, "table")) |value| {
                // we need to create a new Value, since the one from the importer get freed
                // the import process is complete
                const new_value = try php.allocator.create(Value);
                new_value.* = value.*;
                php.addRef(new_value);
                template.table = new_value;
            } else |_| {}
        }
        return template;
    }

    pub fn createTable(self: *const @This(), comptime scope_type: ScopeType, prefilled: ?*const Value) !Value {
        const scope = &@field(self, @tagName(scope_type));
        var new_table: Value = switch (scope.slot_count) {
            // if type only uses one slot, we don't need a hash table--a zval will do
            0, 1 => php.createValueNull(),
            else => php.createValueArray(null),
        };
        if (scope.slot_count > 0) {
            const sources: [2]?*const Value = .{ scope.template.table, prefilled };
            const new_ht = switch (scope.slot_count) {
                1 => undefined,
                else => php.getValueHashTable(&new_table) catch unreachable,
            };
            for (sources) |src| {
                const src_table = src orelse continue;
                const src_ht = try php.getValueHashTable(src_table);
                var iter: HashTableIterator = .init(src_ht, .{});
                while (iter.next()) |value| {
                    if (scope.slot_count == 1) {
                        php.release(&new_table);
                        new_table = value.*;
                        php.addRef(value);
                        break;
                    } else {
                        php.setHashEntryRef(new_ht, iter.currentIndex().?, value);
                    }
                }
            }
        }
        return new_table;
    }

    pub fn registerObject(self: *@This(), obj: *Object) !void {
        try self.host.object_map.add(obj);
    }

    pub fn unregisterObject(self: *@This(), obj: *Object) void {
        self.host.object_map.remove(obj);
    }

    pub fn obtainObjectAtOffset(self: *@This(), parent_buf: *ByteBuffer, offset: usize, len: usize) !*Object {
        const parent_bytes = try parent_buf.data(offset + len, false);
        const bytes = parent_bytes[offset .. offset + len];
        // see if there's an existing object
        const result = self.host.object_map.search(bytes, self.entry(), parent_buf.flags.read_only);
        if (result.match == .yes) {
            const obj = result.value();
            php.addRef(obj);
            return obj;
        } else {
            // need to create the object
            const buf = try parent_buf.slice(offset, len, self.alignment);
            const obj = try self.createObjectFromBuffer(buf, null);
            errdefer php.release(obj);
            return obj;
        }
    }

    pub fn obtainObjectAtAddress(self: *@This(), address: usize, len: usize, is_const: bool) !*Object {
        const byte_ptr: [*]u8 = @ptrFromInt(address);
        const bytes = byte_ptr[0..len];
        // look for an existing object at that memory location
        const result = self.host.object_map.search(bytes, self.entry(), is_const);
        if (result.match == .yes) {
            const obj = result.value();
            php.addRef(obj);
            return obj;
        } else {
            const buf = get: {
                if (self.host.unclaimed_buffer_map.claim(bytes)) |buf| {
                    // use a buffer that has just been allocated
                    if (is_const) buf.protect(true);
                    break :get buf;
                } else if (try self.host.object_map.acquireBuffer(bytes, self.alignment, is_const)) |buf| {
                    // use a buffer that's attached to an existing object
                    break :get buf;
                } else {
                    // assume addresss is valid, pointing to memory somewhere inside the app's address space
                    const buf = try ByteBuffer.create(self.alignment);
                    buf.referencExternal(bytes);
                    if (is_const) buf.protect(true);
                    break :get buf;
                }
            };
            defer buf.release();
            const obj = try self.createObjectFromBuffer(buf, null);
            errdefer php.release(obj);
            return obj;
        }
    }

    pub fn createObjectFromBuffer(self: *@This(), buf: *ByteBuffer, prefilled: ?*const Value) !*Object {
        // the byte buffer may or may not be initialized at this point
        switch (self.type) {
            inline else => |t| {
                const S = @field(structure.by_enum, @tagName(t));
                const table = try self.createTable(.instance, prefilled);
                defer php.release(&table);
                const zig_obj = try ZigObject(S).create(self);
                const obj_struct = zig_obj.structure();
                try obj_struct.setStorage(buf, &table);
                try obj_struct.finalize(false);
                return zig_obj.object();
            },
        }
    }

    pub fn createObject(self: *@This(), allocator: ?*const std.mem.Allocator, value: ?*const Value) !*Object {
        switch (self.type) {
            inline else => |t| {
                const S = @field(structure.by_enum, @tagName(t));
                const table = try self.createTable(.instance, null);
                const buf = try ByteBuffer.create(self.alignment);
                defer php.release(&table);
                const zig_obj = try ZigObject(S).create(self);
                const obj_struct = zig_obj.structure();
                try obj_struct.setStorage(buf, &table);
                try obj_struct.initialize(allocator, value);
                try obj_struct.finalize(true);
                return zig_obj.object();
            },
        }
    }

    pub fn enableCallback(self: *@This(), template: *Value, member_flags: *Value) !void {
        if (self.type != .function) return error.Unexpected;
        // attach static template, which holds the JS controller pointer
        self.static.template = try self.extractTemplate(template);
        const fn_static = self.getStaticData(structure.Function);
        const controller_buf = self.static.template.buffer orelse return error.Unexpected;
        fn_static.controller_address = @intFromPtr(controller_buf.bytes.ptr);
        // add flags to argument members
        const arg_member = try self.getMember(.instance, 0);
        var iter = arg_member.class.getMemberIterator(.instance);
        var index: usize = 0;
        while (iter.next()) |member| : (index += 1) {
            if (try php.getPropertyWithType(?MemberFlags, member_flags, index)) |flags| {
                member.flags = flags;
            }
        }
    }

    pub fn handleCreateObject(ce: *ClassEntry) !*Object {
        const self = fromEntry(ce);
        const buf = try ByteBuffer.create(self.alignment);
        defer buf.release();
        return try self.createObjectFromBuffer(buf, null);
    }

    pub fn getIteratorHandler(comptime S: type) *const fn ([*c]ClassEntry, [*c]Value, c_int) callconv(.c) [*c]ObjectIterator {
        const ns = struct {
            pub fn handleGetIterator(_: *ClassEntry, this: *Value, _: c_int) !?*ObjectIterator {
                const obj = try php.getValueObject(this);
                // because class objects has the same class entry as instance objects, we need to
                // distinguish between the two using ZigObject.isInstance() (which compares the handlers)
                return switch (ZigObject(structure.Class(S)).isInstance(obj)) {
                    true => structure.Class(S).getIterator(obj),
                    false => S.getIterator(obj),
                };
            }
        };
        return php.transform(ns.handleGetIterator);
    }

    fn getAccessors(self: *@This(), member: *Member, scope: ScopeType, slot_count: usize) !accessor.Any {
        @setEvalBranchQuota(2000000);
        const for_vector = if (scope == .instance) switch (self.type) {
            .array, .slice, .vector => true,
            else => false,
        } else false;
        const for_scalar = member.bit_offset != null;
        const byte_offset: usize = if (member.bit_offset) |bit_offset| bit_offset / 8 else 0;
        // when byte size is given the field is byte-aligned; there's no need to adjust for
        // use a bit-shifting accrossor
        const use_bit_offset = member.byte_size == null and member.bit_offset != null;
        const bit_offset: u3 = if (use_bit_offset) @intCast(member.bit_offset.? % 8) else undefined;
        const has_size = member.byte_size != null;
        var accessors: accessor.Any = inline for (comptime std.meta.fields(accessor.Any)) |field| {
            const Acc = field.type;
            var acc: Acc = undefined;
            switch (acc.type) {
                .void => if (member.type == .void) {
                    break @unionInit(accessor.Any, field.name, acc);
                },
                .bool, .int, .float, .gmp => {
                    const primitive_type: MemberType = comptime switch (acc.type) {
                        .bool => .bool,
                        .int, .gmp => switch (acc.attributes.signedness) {
                            .signed => .int,
                            .unsigned => .uint,
                        },
                        .float => .float,
                        else => unreachable,
                    };
                    if (for_scalar and member.type == primitive_type) {
                        if (acc.attributes.use_bit_offset == use_bit_offset) {
                            const match = check: {
                                // accessors handle one particular bit sizes
                                if (@hasField(@TypeOf(acc.attributes), "bit_size")) {
                                    break :check member.bit_size == acc.attributes.bit_size;
                                } else {
                                    if (acc.type == .bool) break :check true;
                                    if (acc.type == .gmp and member.bit_size > 64) {
                                        // accessors can handle different bit sizes
                                        break :check true;
                                    }
                                    break :check false;
                                }
                            };
                            if (match) {
                                acc.byte_offset = byte_offset;
                                if (@hasField(Acc, "bit_offset")) {
                                    acc.bit_offset = bit_offset;
                                }
                                break @unionInit(accessor.Any, field.name, acc);
                            }
                        }
                    }
                },
                .slot => if (member.type == .object or member.type == .literal or member.type == .type) {
                    if (acc.attributes.prebaked == !has_size) {
                        const slots: @TypeOf(acc.attributes.slots) = switch (slot_count > 1) {
                            true => .multiple,
                            false => .single,
                        };
                        const index: @TypeOf(acc.attributes.index) = switch (for_vector) {
                            true => .use,
                            false => .none,
                        };
                        if (acc.attributes.slots == slots and acc.attributes.index == index) {
                            if (@hasField(Acc, "slot")) {
                                acc.slot = member.slot orelse return error.Unexpected;
                            }
                            if (@hasField(Acc, "byte_size")) {
                                acc.byte_size = member.byte_size.?;
                            }
                            if (@hasField(Acc, "byte_offset")) {
                                acc.byte_offset = byte_offset;
                            }
                            if (@hasField(Acc, "class")) {
                                acc.class = member.class;
                            }
                            break @unionInit(accessor.Any, field.name, acc);
                        }
                    }
                },
                .vector => {
                    const primitive_type: MemberType = comptime switch (acc.attributes) {
                        .bool => .bool,
                        inline .int, .gmp => |child_attrs| switch (child_attrs.signedness) {
                            .signed => .int,
                            .unsigned => .uint,
                        },
                        .float => .float,
                    };
                    if (member.type == primitive_type) {
                        switch (acc.attributes) {
                            inline else => |child_attrs| {
                                const match = check: {
                                    if (@hasField(@TypeOf(child_attrs), "bit_size")) {
                                        // accessors handle one particular bit sizes
                                        break :check member.bit_size == child_attrs.bit_size;
                                    } else {
                                        if (acc.attributes == .bool) break :check true;
                                        if (acc.attributes == .gmp and member.bit_size > 64) {
                                            // accessors can handle different bit sizes
                                            break :check true;
                                        }
                                        break :check false;
                                    }
                                };
                                if (match) {
                                    if (@hasField(Acc, "bit_size")) {
                                        acc.bit_size = member.bit_size;
                                    }
                                    break @unionInit(accessor.Any, field.name, acc);
                                }
                            },
                        }
                    }
                },
                .null => if (member.type == .null or member.type == .undefined) {
                    break @unionInit(accessor.Any, field.name, acc);
                },
                .constant, .property, .inaccessible => {},
            }
        } else .{ .inaccessible = .{} };
        if (accessors == .inaccessible) {
            std.debug.print("no accessors\n", .{});
            std.debug.print("member type = {}\n", .{member.type});
        }
        if (member.type == .int or member.type == .uint) {
            if (!member.flags.is_missing_class) {
                if (member.class.type == .@"enum" or member.class.type == .error_set) {
                    // use constant accessor to translate integers to enum and error set objects
                    const int_accessors = accessors;
                    accessors = .{
                        .constant = try .init(int_accessors, member.class),
                    };
                }
            }
        }
        return accessors;
    }

    fn inferName(self: *@This()) !*String {
        errdefer |err| std.debug.print("inferName => {}\n", .{err});
        var sfb = std.heap.stackFallback(10240, php.allocator);
        const allocator = sfb.get();
        const counters = &self.host.importer.counters;
        const type_name: []const u8 = switch (self.type) {
            .primitive, .@"comptime" => get: {
                const member_value = try php.getHashEntry(&self.instance.members, 0);
                const member = try php.getValuePointer(*Member, member_value);
                break :get switch (member.type) {
                    .bool => "bool",
                    .int => switch (self.flags.primitive.is_size) {
                        true => "isize",
                        false => try std.fmt.allocPrint(allocator, "i{d}", .{member.bit_size}),
                    },
                    .uint => switch (self.flags.primitive.is_size) {
                        true => "isize",
                        false => try std.fmt.allocPrint(allocator, "u{d}", .{member.bit_size}),
                    },
                    .float => try std.fmt.allocPrint(allocator, "u{d}", .{member.bit_size}),
                    .void => "void",
                    .literal => "enum_literal",
                    .null => "null",
                    .undefined => "undefined",
                    .type => "type",
                    else => "unknown",
                };
            },
            .array => get: {
                const member_value = try php.getHashEntry(&self.instance.members, 0);
                const member = try php.getValuePointer(*Member, member_value);
                const len = self.length orelse return error.MissingLength;
                break :get try std.fmt.allocPrint(allocator, "[{d}]{s}", .{ len, member.class.getName() });
            },
            .@"struct" => switch (self.purpose) {
                .promise => "Promise",
                .generator => "Generator",
                .abort_signal => "AbortSignal",
                .allocator => "Allocator",
                .iterator => "Iterator",
                .file => "File",
                .directory => "Directory",
                else => get: {
                    defer counters.@"struct" += 1;
                    break :get try std.fmt.allocPrint(allocator, "S{d}", .{counters.@"struct"});
                },
            },
            .@"union" => try std.fmt.allocPrint(allocator, "U{d}", .{counters.@"union"}),
            .error_union => get: {
                const member0_value = try php.getHashEntry(&self.instance.members, 0);
                const payload_member = try php.getValuePointer(*Member, member0_value);
                const member1_value = try php.getHashEntry(&self.instance.members, 1);
                const err_member = try php.getValuePointer(*Member, member1_value);
                break :get try std.fmt.allocPrint(allocator, "{s}!{s}", .{
                    err_member.class.getName(),
                    payload_member.class.getName(),
                });
            },
            .error_set => switch (self.flags.error_set.is_global) {
                false => get: {
                    defer counters.error_set += 1;
                    break :get try std.fmt.allocPrint(allocator, "ES{d}", .{counters.error_set});
                },
                true => "anyerror",
            },
            .@"enum" => get: {
                defer counters.@"enum" += 1;
                break :get try std.fmt.allocPrint(allocator, "EN{d}", .{counters.@"enum"});
            },
            .optional => get: {
                const member_value = try php.getHashEntry(&self.instance.members, 0);
                const member = try php.getValuePointer(*Member, member_value);
                break :get try std.fmt.allocPrint(allocator, "?{s}", .{member.class.getName()});
            },
            .pointer => get: {
                const member_value = try php.getHashEntry(&self.instance.members, 0);
                const member = try php.getValuePointer(*Member, member_value);
                var prefix: []const u8 = switch (self.flags.pointer.is_multiple) {
                    false => "*",
                    true => if (self.flags.pointer.has_length)
                        "[]"
                    else if (self.flags.pointer.is_single)
                        "[*c]"
                    else
                        "[*]",
                };
                // TODO: deal with sentinel
                if (self.flags.pointer.is_const) {
                    prefix = try std.fmt.allocPrint(allocator, "{s}const ", .{prefix});
                }
                var element_name = member.class.getName();
                if (member.class.type == .slice) {
                    element_name = element_name[3..];
                }
                break :get try std.fmt.allocPrint(allocator, "{s}{s}", .{ prefix, element_name });
            },
            .slice => get: {
                const member_value = try php.getHashEntry(&self.instance.members, 0);
                const member = try php.getValuePointer(*Member, member_value);
                break :get switch (self.flags.slice.is_opaque) {
                    false => try std.fmt.allocPrint(allocator, "[_]{s}", .{member.class.getName()}),
                    true => "anyopaque",
                };
            },
            .vector => get: {
                const member_value = try php.getHashEntry(&self.instance.members, 0);
                const member = try php.getValuePointer(*Member, member_value);
                const len = self.length orelse return error.MissingLength;
                break :get try std.fmt.allocPrint(allocator, "@Vector({d}, {s})", .{ len, member.class.getName() });
            },
            .@"opaque" => get: {
                defer counters.@"opaque" += 1;
                break :get try std.fmt.allocPrint(allocator, "O{d}", .{counters.@"opaque"});
            },
            .arg_struct, .variadic_struct => |t| get: {
                var index: usize = 0;
                var iter = self.getMemberIterator(.instance);
                if (iter.len == 0) return error.InvalidType;
                const names = try allocator.alloc([]const u8, iter.len);
                defer allocator.free(names);
                while (iter.next()) |member| {
                    names[index] = member.class.getName();
                    index += 1;
                }
                break :get try std.fmt.allocPrint(allocator, "Arg(fn ({s}{s}) {s})", .{
                    try std.mem.join(allocator, ", ", names[1..]),
                    if (t == .variadic_struct) ", ..." else "",
                    names[0],
                });
            },
            .function => get: {
                const member_value = try php.getHashEntry(&self.instance.members, 0);
                const member = try php.getValuePointer(*Member, member_value);
                const arg_name = member.class.getName();
                break :get arg_name[4 .. arg_name.len - 1];
            },
        };
        return php.createString(type_name);
    }

    pub var global_class: *ClassEntry = undefined;
    pub var global_error_class: *ClassEntry = undefined;
    pub var abort_signal_class: *ClassEntry = undefined;

    pub fn registerGlobalClasses() !void {
        var ce: ClassEntry = .{
            .name = php.persistent("ZigObject"),
        };
        const parent_ce = php.getClassEntry(.standard);
        global_class = php.registerInternalClass(&ce, parent_ce) orelse {
            return error.ClassRegistrationFailure;
        };
        var error_ce: ClassEntry = .{
            .name = php.persistent("ZigError"),
        };
        const error_parent_ce = php.getClassEntry(.exception);
        global_error_class = php.registerInternalClass(&error_ce, error_parent_ce) orelse {
            return error.ClassRegistrationFailure;
        };
        var signal_ce: ClassEntry = .{
            .name = php.persistent("ZigAbortSignal"),
        };
        abort_signal_class = php.registerInternalClass(&signal_ce, parent_ce) orelse {
            return error.ClassRegistrationFailure;
        };
        abort_signal_class.unnamed_1.create_object = php.transform(AbortSignal.handleCreateObject);
    }

    pub fn isZig(ce: *ClassEntry) bool {
        return ce.*.unnamed_0.parent == global_class;
    }

    pub fn isZigError(ce: *ClassEntry) bool {
        return ce.*.unnamed_0.parent == global_error_class;
    }

    pub fn getParentClass(self: *@This()) *ClassEntry {
        return switch (self.type) {
            .error_set => global_error_class,
            else => global_class,
        };
    }
};
