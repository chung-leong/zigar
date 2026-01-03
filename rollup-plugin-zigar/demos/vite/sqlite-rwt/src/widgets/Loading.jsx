import { useEffect } from "react";

function Loading({ onUnmount }) {
  useEffect(() => onUnmount);
  return <div className="Loading">LOADING</div>;
}

export default Loading;