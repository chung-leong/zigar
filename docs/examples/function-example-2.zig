pub const Rectangle = struct {
    left: f64,
    right: f64,
    width: f64,
    height: f64,

    pub fn size(self: Rectangle) f64 {
        return self.width * self.height;
    }
};
