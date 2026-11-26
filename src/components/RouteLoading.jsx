export default function RouteLoading() {
  return (
    <main className="wrap sdc-route-loading" role="status" aria-live="polite" aria-label="Loading page">
      <span className="sdc-loading-mark" aria-hidden="true">SD</span>
      <p>Opening your page…</p>
      <div className="sdc-loading-grid" aria-hidden="true">
        <span /><span /><span />
      </div>
    </main>
  );
}
