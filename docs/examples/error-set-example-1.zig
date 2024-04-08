pub const FileOpenError = error{
    access_denied,
    out_of_memory,
    file_not_found,
};

pub const AllocationError = error{
    out_of_memory,
};

pub fn fail(reason: u32) !bool {
    return switch (reason) {
        1 => FileOpenError.access_denied,
        2 => FileOpenError.out_of_memory,
        3 => FileOpenError.file_not_found,
        else => false,
    };
}
