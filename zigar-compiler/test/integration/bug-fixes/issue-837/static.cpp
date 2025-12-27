int state = 0;

struct C {
  C() {
    state = 1;
  }
  ~C() {
    state = 2;
  }
};

// uncomment this line and it will crash at exit
static C c{};

int useC() {
  C c{};
  (void)c;
  return state;
}
