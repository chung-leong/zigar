pub fn number(big: bool) usize {
    return if (big) 0xFFFF_FFFF_FFFF_FFF else 0x001F_FFFF_FFFF_FFFF;
}
