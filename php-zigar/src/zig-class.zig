const std = @import("std");

const accessor = @import("accessor.zig");
const byte_buffer = @import("byte-buffer.zig");
const ByteBuffer = byte_buffer.ByteBuffer;
const enums = @import("enums.zig");
const MemberFlags = enums.MemberFlags;
const MemberType = enums.MemberType;
const StructureFlags = enums.StructureFlags;
const StructurePurpose = enums.StructurePurpose;
const StructureType = enums.StructureType;
const module_host = @import("module-host.zig");
const Host = module_host.ModuleHost;
const php = @import("php.zig");
const ClassEntry = php.ClassEntry;
const Function = php.Function;
const HashPosition = php.HashPosition;
const HashTable = php.HashTable;
const Object = php.Object;
const String = php.String;
const Value = php.Value;
const structure = @import("structure.zig");
const zig_object = @import("zig-object.zig");
const ZigObject = zig_object.ZigObject;

pub const ZigClass = struct {
    host: *Host,
    type: StructureType,
    purpose: StructurePurpose,
    flags: StructureFlags,
    alignment: usize,
    signature: u64,
    length: ?usize,
    byte_size: ?usize,
    instance: Scope = .{},
    static: Scope = .{},
    finalized: bool = false,
    static_data: StaticData = undefined,
    php_portion: ClassEntry = undefined,

    pub const ScopeType = enum { instance, static };

    const Scope = struct {
        members: HashTable = undefined,
        template: Template = undefined,
        slot_count: usize = 0,

        fn release(self: *@This()) void {
            php.destroyHashTable(&self.members);
            self.template.release();
        }
    };
    pub const Member = struct {
        type: MemberType,
        flags: MemberFlags,
        bit_offset: ?usize,
        bit_size: usize,
        byte_size: ?usize,
        slot: ?usize,
        class: ?*ZigClass,
        accessors: accessor.Any = undefined,

        pub fn destructor(value: [*c]Value) callconv(.c) void {
            const member = php.getValuePointer(*Member, value) catch unreachable;
            if (member.class) |c| c.release();
            php.allocator.destroy(member);
        }
    };
    pub const Template = struct {
        bytes: ?*ByteBuffer = null,
        slots: ?*Value = null,

        fn release(self: *@This()) void {
            if (self.bytes) |b| b.release();
            if (self.slots) |s| php.release(s);
        }
    };
    const StaticData = define: {
        const fields = std.meta.fields(@TypeOf(structure.by_enum));
        var new_fields: [fields.len]std.builtin.Type.UnionField = undefined;
        for (fields, 0..) |field, i| {
            const Structure = @field(structure.by_enum, field.name);
            const StructureStatic = if (@hasDecl(Structure, "Static")) Structure.Static else void;
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

    pub fn entry(self: *@This()) *ClassEntry {
        return &self.php_portion;
    }

    pub fn fromEntry(ce: *ClassEntry) *@This() {
        return @fieldParentPtr("php_portion", ce);
    }

    pub fn fromObject(obj: *Object) *@This() {
        return fromEntry(obj.ce);
    }

    pub fn fromStructure(s: anytype) *@This() {
        const S = @TypeOf(s.*);
        const zig_obj = ZigObject(S).fromStructure(s);
        return fromEntry(zig_obj.php_portion.ce);
    }

    pub fn addRef(self: *@This()) void {
        self.php_portion.refcount += 1;
    }

    pub fn release(self: *@This()) void {
        self.php_portion.refcount -= 1;
        // std.debug.print("release class {x} (ref = {d})\n", .{ @intFromPtr(self), self.php_portion.refcount });
        if (self.php_portion.refcount == 0) {
            // std.debug.print("freeing class\n", .{});
            self.host.release();
            if (self.finalized) {
                self.static.release();
                self.instance.release();
            }
            const ce = self.entry();
            php.release(ce.name);
            php.release(ce.info.user.filename);
            php.allocator.destroy(self);
        }
    }

    pub fn define(host: *Host, info: *Value) !void {
        var self: *@This() = try php.allocator.create(@This());
        errdefer php.allocator.destroy(self);
        self.* = .{
            .host = host,
            .type = try php.getPropertyWithType(StructureType, info, "type"),
            .purpose = try php.getPropertyWithType(StructurePurpose, info, "purpose"),
            .flags = try php.getPropertyWithType(?StructureFlags, info, "flags") orelse @bitCast(@as(u32, 0)),
            .alignment = try php.getPropertyWithType(usize, info, "align"),
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
        ce.* = .{
            .type = php.USER_CLASS,
            .refcount = 1,
            .name = php.createString("ZigClass"),
            .ce_flags = php.LINKED | php.RESOLVED_INTERFACES,
            .properties_info = php.createHashTable(null),
            .constants_table = php.createHashTable(null),
            .function_table = php.createHashTable(php.destructor.function),
            .num_interfaces = @intCast(interfaces.len),
            .unnamed_1 = .{
                .create_object = php.transform(createObject),
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
        var ref = try createRef(ce);
        try php.setProperty(info, "class", &ref);
        host.addRef();
    }

    pub fn finalize(info: *Value) !void {
        const ref = try php.getProperty(info, "class");
        const obj = try php.getValueObject(ref);
        const self = fromEntry(obj.ce);
        self.instance = try self.extractScope(info, "instance");
        errdefer self.instance.release();
        self.static = try self.extractScope(info, "static");
        errdefer self.static.release();
        inline for (.{ "static", "instance" }) |scope_name| {
            const scope = &@field(self, scope_name);
            const ht = &scope.members;
            var pos: php.HashPosition = undefined;
            // attach count the number of slots used
            php.initializeHashPosition(ht, &pos);
            while (try php.getHashPositionPointer(*ZigClass.Member, ht, &pos)) |member| {
                if (member.slot != null) scope.slot_count += 1;
                if (!php.moveHashPositionForward(ht, &pos)) break;
            }
            // attach accessors to members
            php.initializeHashPosition(ht, &pos);
            while (try php.getHashPositionPointer(*ZigClass.Member, ht, &pos)) |member| {
                member.accessors = try getAccessors(scope, member);
                if (!php.moveHashPositionForward(ht, &pos)) break;
            }
        }
        // set slots of ref object
        const static = structure.Static.fromObject(obj);
        try static.setStorage(undefined, self.static.template.slots orelse php.null_value);
        // initialize static data
        switch (self.type) {
            inline else => |t| {
                const name = @tagName(t);
                if (@FieldType(StaticData, name) != void) {
                    self.static_data = @unionInit(StaticData, name, .{});
                    const data = &@field(self.static_data, name);
                    try data.initialize(self);
                }
            },
        }
        self.finalized = true;
    }

    pub fn createInstance(info: *const Value, memory: *const Value, slots: *const Value) !Value {
        const ref = try php.getProperty(info, "class");
        const obj = try php.getValueObject(ref);
        const bytes = try php.getValuePointer(*ByteBuffer, memory);
        const new = try createObjectWith(obj.ce, bytes, slots);
        return php.createValueObject(new);
    }

    pub fn getFlags(self: *@This(), comptime S: type) @FieldType(StructureFlags, structure.enumName(S)) {
        return @field(self.flags, structure.enumName(S));
    }

    pub fn getStaticData(self: *@This(), comptime S: type) @FieldType(StaticData, structure.enumName(S)) {
        return @field(self.static_data, structure.enumName(S));
    }

    pub fn getStructureName(self: *@This()) []const u8 {
        return switch (self.type) {
            inline else => |e| @tagName(e),
        };
    }

    pub fn getName(self: *@This()) []const u8 {
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
                const container = @field(self, @tagName(s));
                const value = try php.getHashEntry(&container.members, key);
                return try php.getValuePointer(*Member, value);
            },
        }
    }

    pub fn createInterfaceList(self: *@This()) ![]*ClassEntry {
        var buffer: [16]*ClassEntry = undefined;
        var count: usize = 0;
        switch (self.type) {
            .array, .vector, .slice => {
                buffer[count] = php.getInterface(.array_access);
                count += 1;
            },
            else => {},
        }
        if (count == 0) return &.{};
        const interfaces = try php.allocator.alloc(*ClassEntry, count);
        @memcpy(interfaces, buffer[0..count]);
        return interfaces;
    }

    fn extractScope(self: *@This(), info: *Value, name: []const u8) !Scope {
        const scope_info = try php.getProperty(info, name);
        var members = try self.extractMembers(scope_info);
        errdefer php.destroyHashTable(&members);
        const template = try self.extractTemplate(scope_info);
        return .{ .members = members, .template = template };
    }

    fn extractMembers(self: *@This(), scope_info: *Value) !HashTable {
        var result = php.createHashTable(Member.destructor);
        if (php.getProperty(scope_info, "members")) |member_list| {
            const member_list_ht = try php.getValueHashTable(member_list);
            var pos: HashPosition = undefined;
            php.initializeHashPosition(member_list_ht, &pos);
            while (php.getHashPositionValue(member_list_ht, &pos)) |member_info| {
                const key = php.getHashPositionKey(member_list_ht, &pos);
                // if (php.getValueLong(&key)) |int| {
                //     std.debug.print("key = {d}\n", .{int});
                // } else |_| if (php.getValueStringContent(&key)) |str| {
                //     std.debug.print("key = {s}\n", .{str});
                // } else |_| {}
                const member_ht = php.getValueHashTable(member_info) catch {
                    if (member_info.u1.v.type == php.IS_LONG) {
                        std.debug.print("{x} type = {d}, {d}\n", .{
                            @intFromPtr(member_list_ht),
                            member_info.u1.v.type,
                            member_info.value.lval,
                        });
                    } else if (member_info.u1.v.type == php.IS_STRING) {
                        std.debug.print("{x} type = {d}, {s}\n", .{
                            @intFromPtr(member_list_ht),
                            member_info.u1.v.type,
                            try php.getValueStringContent(member_info),
                        });
                    }
                    if (!php.moveHashPositionForward(member_list_ht, &pos)) break;
                    continue;
                };
                var key_str: ?[]const u8 = null;
                var key_int: usize = undefined;
                if (php.getHashEntry(member_ht, "name")) |name| {
                    key_str = try php.getValueStringContent(name);
                } else |_| {
                    key_int = @intCast(try php.getValueLong(&key));
                }
                const member = try php.allocator.create(Member);
                errdefer php.allocator.destroy(member);
                member.* = .{
                    .type = try php.getHashEntryWithType(MemberType, member_ht, "type"),
                    .flags = try php.getHashEntryWithType(?MemberFlags, member_ht, "flags") orelse .{},
                    .bit_offset = try php.getHashEntryWithType(?usize, member_ht, "bitOffset"),
                    .bit_size = try php.getHashEntryWithType(?usize, member_ht, "bitSize") orelse 0,
                    .byte_size = try php.getHashEntryWithType(?usize, member_ht, "byteSize"),
                    .slot = try php.getHashEntryWithType(?usize, member_ht, "slot"),
                    .class = get: {
                        const struct_info = php.getHashEntry(member_ht, "structure") catch break :get null;
                        const ref = try php.getProperty(struct_info, "class");
                        const obj = try php.getValueObject(ref);
                        const class = fromEntry(obj.ce);
                        if (class != self) class.addRef();
                        break :get class;
                    },
                };
                var member_ptr = php.createValuePointer(member);
                if (key_str) |str|
                    try php.setHashEntry(&result, str, &member_ptr)
                else
                    try php.setHashEntry(&result, key_int, &member_ptr);
                if (!php.moveHashPositionForward(member_list_ht, &pos)) break;
            }
        } else |_| {}
        return result;
    }

    fn extractTemplate(_: *@This(), scope_info: *Value) !Template {
        if (php.getProperty(scope_info, "template")) |template_info| {
            const bytes = if (php.getProperty(template_info, "memory")) |value| use: {
                const buf = try php.getValuePointer(*ByteBuffer, value);
                buf.addRef();
                break :use buf;
            } else |_| null;
            const slots = if (php.getProperty(template_info, "slots")) |value| use: {
                php.addRef(value);
                break :use value;
            } else |_| null;
            return .{ .bytes = bytes, .slots = slots };
        } else |_| {
            return .{ .bytes = null, .slots = null };
        }
    }

    fn createRef(ce: *ClassEntry) !Value {
        const self = fromEntry(ce);
        const zig_obj = try ZigObject(structure.Static).create(self);
        self.release(); // remove initial refcount now that the ref object exists
        return php.createValueObject(zig_obj.object());
    }

    pub fn createObject(ce: *ClassEntry) !*Object {
        const self = fromEntry(ce);
        switch (self.type) {
            inline else => |t| {
                const S = @field(structure.by_enum, @tagName(t));
                const flags = @field(self.flags, @tagName(t));
                const bytes = create: {
                    if (self.type != .variadic_struct) break :create null;
                    const len = self.byte_size orelse break :create null;
                    const new = try ByteBuffer.createNew(len, self.alignment);
                    if (self.instance.template.bytes) |def| @memcpy(new.bytes, def.bytes);
                    break :create new;
                };
                defer if (bytes) |b| b.release();
                var slots = create: {
                    if (!flags.has_slot) break :create php.createValueNull();
                    var new = php.createValueArray();
                    errdefer php.release(&new);
                    if (self.instance.template.slots) |def| {
                        const ht = try php.getValueHashTable(def);
                        const new_ht = try php.getValueHashTable(&new);
                        var pos: HashPosition = undefined;
                        php.initializeHashPosition(ht, &pos);
                        while (php.getHashPositionValue(ht, &pos)) |value| {
                            const key = php.getHashPositionKey(ht, &pos);
                            const long = try php.getValueLong(&key);
                            try php.setHashEntryRef(new_ht, long, value);
                            if (php.moveHashPositionForward(ht, &pos)) break;
                        }
                    }
                    break :create new;
                };
                defer php.release(&slots);
                const zig_obj = try ZigObject(S).create(self);
                try zig_obj.setStorage(bytes orelse undefined, &slots);
                return zig_obj.object();
            },
        }
    }

    pub fn createObjectWith(ce: *ClassEntry, bytes: *ByteBuffer, slots: *const Value) !*Object {
        const self = fromEntry(ce);
        switch (self.type) {
            inline else => |t| {
                const S = @field(structure.by_enum, @tagName(t));
                const zig_obj = try ZigObject(S).create(self);
                try zig_obj.setStorage(bytes, slots);
                return zig_obj.object();
            },
        }
    }

    fn getAccessors(scope: *Scope, member: *Member) !accessor.Any {
        @setEvalBranchQuota(2000000);
        // array accessors don't have an offset
        const for_scalar = member.bit_offset != null;
        const byte_offset: usize = if (member.bit_offset) |bit_offset| bit_offset / 8 else 0;
        const bit_offset_mod8: ?u3 = if (member.bit_offset) |bit_offset|
            // when byte size is given the field is byte-aligned; there's no need to adjust for
            // use a bit-shifting accrossor
            if (member.byte_size != null) null else @intCast(bit_offset % 8)
        else
            null;
        switch (member.type) {
            .bool => {
                if (for_scalar) {
                    // iterate through all possible bit offsets
                    inline for (.{ null, 0, 1, 2, 3, 4, 5, 6, 7 }) |offset| {
                        if (bit_offset_mod8 == offset) {
                            const primitive = accessor.boolean.get(.{
                                .bit_offset = offset,
                            }, .{
                                .byte_offset = byte_offset,
                            });
                            return .{ .primitive = primitive };
                        }
                    }
                } else {
                    // TODO: deal with vectors inside packed struct
                    const vector = accessor.vector.get(.{ .child = bool, .is_packed = false }, .{});
                    return .{ .vector = vector };
                }
            },
            .int, .uint => inline for (0..65) |bits| {
                if (member.bit_size == bits) {
                    inline for (.{ .signed, .unsigned }) |signedness| {
                        if ((member.type == .int) == (signedness == .signed)) {
                            if (for_scalar) {
                                inline for (.{ null, 0, 1, 2, 3, 4, 5, 6, 7 }) |offset| {
                                    if (bit_offset_mod8 == offset) {
                                        const primitive = accessor.int.get(.{
                                            .signedness = signedness,
                                            .bit_size = bits,
                                            .bit_offset = offset,
                                        }, .{
                                            .byte_offset = byte_offset,
                                        });
                                        return .{ .primitive = primitive };
                                    }
                                }
                            } else {
                                const T = @Type(.{
                                    .int = .{ .signedness = signedness, .bits = bits },
                                });
                                const vector = accessor.vector.get(.{ .child = T, .is_packed = false }, .{});
                                return .{ .vector = vector };
                            }
                        }
                    }
                    break;
                }
            },
            .float => inline for (.{ 16, 32, 64, 80, 128 }) |bits| {
                if (member.bit_size == bits) {
                    if (for_scalar) {
                        inline for (.{ null, 0, 1, 2, 3, 4, 5, 6, 7 }) |offset| {
                            if (bit_offset_mod8 == offset) {
                                const primitive = accessor.float.get(.{
                                    .bit_size = bits,
                                    .bit_offset = offset,
                                }, .{
                                    .byte_offset = byte_offset,
                                });
                                return .{ .primitive = primitive };
                            }
                        }
                    } else {
                        const T = @Type(.{
                            .float = .{ .bits = bits },
                        });
                        const vector = accessor.vector.get(.{ .child = T, .is_packed = false }, .{});
                        return .{ .vector = vector };
                    }
                }
            },
            .void => {
                return .{ .primitive = accessor.void.get(.{}, .{}) };
            },
            .object, .type, .literal => |t| if (member.slot) |slot| {
                // the lack of a slot means the member isn't meant to be accessed directly
                // only applicable to functions, I think
                const transform: ?accessor.Transform = get: {
                    if (member.flags.is_string or t == .literal) {
                        break :get .to_string;
                    } else if (member.flags.is_plain) {
                        break :get .to_plain;
                    } else if (member.class) |class| {
                        if (class.flags.common.has_value or class.flags.common.has_proxy)
                            break :get .to_value;
                    }
                    break :get null;
                };
                if (member.byte_size) |byte_size| {
                    // compound types like structs and unions are represented by objects
                    // these are stored in slots of their parent objects and are created lazily
                    const class = member.class orelse return error.MissingClass;
                    return if (scope.slot_count > 1) .{
                        .multi_slot = accessor.slot.get(.{
                            .type = .multi_slot,
                        }, .{
                            .class_entry = class.entry(),
                            .byte_offset = byte_offset,
                            .byte_size = byte_size,
                            .slot = slot,
                            .transform = transform,
                        }),
                    } else .{
                        .single_slot = accessor.slot.get(.{
                            .type = .single_slot,
                        }, .{
                            .class_entry = class.entry(),
                            .byte_offset = byte_offset,
                            .byte_size = byte_size,
                            .transform = transform,
                        }),
                    };
                } else {
                    // static members don't have a size since they're ready-made objects
                    // that sit in the template slots; this is applicable to comptime field as well
                    return if (scope.slot_count > 1) .{
                        .multi_slot_prebaked = accessor.slot.get(.{
                            .type = .multi_slot_prebaked,
                        }, .{
                            .slot = slot,
                            .transform = transform,
                        }),
                    } else .{
                        .single_slot_prebaked = accessor.slot.get(.{
                            .type = .single_slot_prebaked,
                        }, .{
                            .transform = transform,
                        }),
                    };
                }
            },
            .null => {
                return .{ .null = accessor.null.get(.{}, .{}) };
            },
            else => {},
        }
        // std.debug.print("No accessor for {}\n", .{member.type});
        return .{ .missing = {} };
    }
};
