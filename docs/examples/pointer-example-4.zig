pub fn setI8(array: []i8, value: i8) void {
    for (array) |*element_ptr| {
        element_ptr.* = value;
    }
}
