const std = @import("std");

const accessor = @import("accessor.zig");
const php = @import("php.zig");
const String = php.String;
const ZigClassEntry = @import("class-entry.zig").ZigClassEntry;

pub fn IdFromTags(comptime tags: anytype) type {
    var fields: [tags.len]std.builtin.Type.EnumField = undefined;
    inline for (tags, 0..) |tag, i| {
        fields[i] = .{
            .name = @tagName(tag),
            .value = i,
        };
    }
    return @Type(.{
        .@"enum" = .{
            .fields = &fields,
            .decls = &.{},
            .is_exhaustive = true,
            .tag_type = std.math.IntFittingRange(0, tags.len),
        },
    });
}

pub fn IdCache(comptime tags: anytype, comptime prefix: []const u8, comptime aliases: anytype) type {
    return struct {
        id_address: usize,
        value: Id,

        pub const Id = IdFromTags(tags);

        const id = std.fmt.comptimePrint("{}", .{tags});

        pub inline fn find(cache_slot: ?[*]?*anyopaque) !?Id {
            const self: *@This() = if (cache_slot) |ptr| @ptrCast(ptr) else return null;
            return if (self.id_address == @intFromPtr(id))
                self.value
            else if (self.id_address != 0)
                error.ForAnotherCache
            else
                null;
        }

        pub inline fn set(cache_slot: ?[*]?*anyopaque, value: Id) void {
            const self: *@This() = if (cache_slot) |ptr| @ptrCast(ptr) else return;
            self.* = .{ .id_address = @intFromPtr(id), .value = value };
        }

        pub fn idFromString(name: *String, cache_slot: ?[*]?*anyopaque) ?Id {
            if (find(cache_slot) catch return null) |value| return value;
            return inline for (tags) |tag| {
                if (php.matchString(name, prefix ++ @tagName(tag))) {
                    set(cache_slot, tag);
                    return tag;
                }
            } else inline for (comptime std.meta.fields(@TypeOf(aliases))) |field| {
                if (php.matchString(name, field.name)) {
                    const tag = @field(aliases, field.name);
                    set(cache_slot, tag);
                    return tag;
                }
            } else null;
        }
    };
}

pub const TransformCache = struct {
    id_address: usize,
    value: accessor.Transform,

    const id = "Transform";

    pub inline fn find(cache_slot: ?[*]?*anyopaque) !?accessor.Transform {
        const self: *@This() = if (cache_slot) |ptr| @ptrCast(ptr) else return null;
        return if (self.id_address == @intFromPtr(id))
            self.value
        else if (self.id_address != 0)
            error.ForAnotherCache
        else
            null;
    }

    pub inline fn set(cache_slot: ?[*]?*anyopaque, value: accessor.Transform) void {
        const self: *@This() = if (cache_slot) |ptr| @ptrCast(ptr) else return;
        self.* = .{ .id_address = @intFromPtr(id), .value = value };
    }

    pub fn idFromString(name: *String, cache_slot: ?[*]?*anyopaque) ?accessor.Transform {
        if (find(cache_slot) catch return null) |value| return value;
        const transforms = .{
            .__value = .none,
            .__plain = .plain,
            .__string = .string,
            .__int = .integer,
            .__bytes = .bytes,
            .__base64 = .base64,
            .__typed_array = .typed_array,
            .__clamped_array = .clamped_array,
            .@"$" = .plain,
        };
        return inline for (std.meta.fields(@TypeOf(transforms))) |field| {
            if (php.matchString(name, field.name)) {
                const transform = @field(transforms, field.name);
                set(cache_slot, transform);
                break transform;
            }
        } else null;
    }
};

pub const MemberCache = struct {
    class_address: usize,
    member: *const ZigClassEntry.Member,
    extra: ?*anyopaque = null,

    pub inline fn find(cache_slot: ?[*]?*anyopaque, class: *ZigClassEntry) !?*const ZigClassEntry.Member {
        const self: *@This() = if (cache_slot) |ptr| @ptrCast(ptr) else return null;
        return if (self.class_address == @intFromPtr(class))
            self.member
        else if (self.class_address != 0)
            error.ForAnotherCache
        else
            null;
    }

    pub inline fn findSelf(cache_slot: ?[*]?*anyopaque, class: *ZigClassEntry) ?*@This() {
        const self: *@This() = if (cache_slot) |ptr| @ptrCast(ptr) else return null;
        return if (self.class_address == @intFromPtr(class)) self else null;
    }

    pub inline fn set(cache_slot: ?[*]?*anyopaque, class: *ZigClassEntry, member: *const ZigClassEntry.Member) void {
        const self: *@This() = if (cache_slot) |ptr| @ptrCast(ptr) else return;
        self.* = .{ .class_address = @intFromPtr(class), .member = member };
    }
};
