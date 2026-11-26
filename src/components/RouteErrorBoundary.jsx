import React from 'react';
import { Link } from 'react-router-dom';

export default class RouteErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, info) {
    console.error('Stationery Dot route render failed:', error, info?.componentStack || '');
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="wrap sdc-route-error" role="alert" aria-live="assertive">
        <div className="card">
          <span className="section-overline">PAGE DID NOT LOAD</span>
          <h1>Let’s get this page back.</h1>
          <p>This page could not finish loading. Your cart and order details have not been submitted.</p>
          <div className="row">
            <button className="btn" type="button" onClick={() => window.location.reload()}>Reload page</button>
            <Link className="btn alt" to="/">Go to homepage</Link>
          </div>
        </div>
      </main>
    );
  }
}
