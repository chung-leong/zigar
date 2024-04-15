var numbers = [_]u32{ 1, 2, 3, 4, 5, 6, 7, 8, 9, 88 };
pub var ptr1: [*]u32 = &numbers;
pub var ptr2: [*c]u32 = &numbers;
pub var ptr3: [*:88]u32 = @ptrCast(&numbers);
