import { useEffect } from "react";

function Loading({ onUnload }) {
  useEffect(() => onUnload);
  return <div className="Loading">LOADING</div>;
}

export default Loading;