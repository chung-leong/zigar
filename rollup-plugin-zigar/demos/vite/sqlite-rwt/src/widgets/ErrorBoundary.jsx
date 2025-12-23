import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <h1>{this.state.error.message}</h1>;
    }
    return this.props.children; 
  }
}

export default ErrorBoundary;