const ResponseType = enum { normal, partial, bad };
const Response = struct {
    type: ResponseType,
    size: usize,
    code: u32 = 200,
    bytes: [8]u8,
};

pub fn getResponse() Response {
    return .{
        .type = .normal,
        .size = 512,
        .bytes = .{ 1, 2, 3, 4, 5, 6, 7, 8 },
    };
}
