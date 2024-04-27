pub const NumberAndNothing = struct {
    number: i32,
    comptime nothing: @TypeOf(null) = null,
};
