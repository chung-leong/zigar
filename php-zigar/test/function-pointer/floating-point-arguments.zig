const zigar = @import("zigar");

pub fn call(f: *const fn (f32, f32, f32, f32, f32, f32, f32, f32, f32, f32, f32, f32) f32) f32 {
    defer zigar.function.release(f);
    return f(0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2);
}
