import { useActionState } from 'react';
import { save } from '../zig/save.zig';
import './App.css';

async function sendData() {
  const url = 'https://localhost:8080/uploads/test2.txt';
  const transform = new TransformStream(undefined, { highWaterMark: 1024 * 16 });
  const writer = transform.writable.getWriter();
  save(writer).then(() => writer.close());
  const response = await fetch(url, {
    method: 'PUT',
    body: transform.readable,
    duplex: 'half',
  });
  return await response.text()
}

function App() {
  const [ message, formAction, isPending] = useActionState(sendData, '');
  return (
    <form action={formAction}>
      <button disabled={isPending}>Send data</button>
      <div>{message}</div>
    </form>
  )
}

export default App
