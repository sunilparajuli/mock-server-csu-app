import { config } from "@/lib/config";
import { stateSummary } from "@/lib/state";

export const dynamic = "force-dynamic";

export default function Home() {
  const summary = stateSummary();
  return <main>
    <div className="label">Contract development server</div>
    <h1>Cameroon openIMIS Mock</h1>
    <p className="sub">FHIR, GraphQL, master-data and legacy REST routes matching the three Cameroon APKs. This server is for local development and API compatibility testing only.</p>
    <section className="grid">
      <div className="card"><div className="value">{config.serviceCount.toLocaleString()}</div><div className="label">Services</div></div>
      <div className="card"><div className="value">{config.itemCount.toLocaleString()}</div><div className="label">Items</div></div>
      <div className="card"><div className="value">{config.pageSize}</div><div className="label">Page size</div></div>
      <div className="card"><div className="value">{summary.requestCount}</div><div className="label">Requests</div></div>
    </section>
    <h2>Connect</h2>
    <pre><code>{`Android emulator base URL: http://10.0.2.2:8080/\nMock token: ${config.token}\nHealth: GET /health\nState: GET /__mock__/state\nReset: POST /__mock__/reset`}</code></pre>
    <h2>Current state</h2>
    <pre><code>{JSON.stringify(summary, null, 2)}</code></pre>
  </main>;
}
