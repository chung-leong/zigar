const php = @import("root.zig");
const c = php.c;

pub fn @"fn"(comptime T: type) type {
    return struct {
        pub fn init() !void {
            if (@hasDecl(T, "init")) {
                const result = T.init();
                const RT = @TypeOf(result);
                default = switch (@typeInfo(RT)) {
                    .error_union => try result,
                    else => result,
                };
            } else {
                default = .{};
            }
            value = default;
        }

        pub fn deinit() void {
            if (@hasDecl(T, "deinit")) {
                default.deinit();
            }
        }

        pub fn get() *T {
            return &value;
        }

        pub fn reset() void {
            value = default;
        }

        threadlocal var value: T = undefined;
        var default: T = undefined;
    };
}
