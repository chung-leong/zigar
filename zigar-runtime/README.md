
## Limitations

* Pointers with no length or terminator are not accessible - Zigar only exposes memory when it knows the length. Pointers that points to a single object (`*T`), slices (`[]T`), and pointers with sentinel value (`[*:0]T`) are OK. Pointers that can pointer to arbitrary numbers of objects (`[*]T` and `[*c]T`) are not.
* Pointers within bare and extern (i.e. C-compatible) unions are not accessible - Zigar simply cannot figure out if these pointers are pointing to valid memory regions. Pointers are only accessible inside unions with tags.
*