import { hello } from '../zig/hello.zig';

function App() {
  return (
    <div className="App">
      <button onClick={() => hello()}>
        Say hello
      </button>
    </div>
  );
}

export default App
