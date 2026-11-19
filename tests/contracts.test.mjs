import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";

const base = "http://127.0.0.1:8181";
let server;

before(async () => {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "8181"], { stdio: "ignore" });
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Mock server did not start");
});

after(() => server?.kill());

test("FHIR login returns a token", async () => {
  const response = await fetch(`${base}/api/api_fhir_r4/login/`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "officer", password: "secret" }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).token, "cameroon-mock-token");
});

test("GraphQL catalogue is paginated", async () => {
  const response = await fetch(`${base}/api/graphql`, { method: "POST", headers: { authorization: "Bearer cameroon-mock-token", "content-type": "application/json" }, body: JSON.stringify({ query: "query GetServices($offset:Int){medicalServices(offset:$offset){totalCount edges{node{code}}}}", variables: { offset: 0 } }) });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.ok(result.data.medicalServices.edges.length <= 100);
});

test("commission contract enforces legacy spelling", async () => {
  const response = await fetch(`${base}/rest/api/policy/commissions`, { method: "POST", headers: { authorization: "Bearer cameroon-mock-token", "api-version": "3", "content-type": "application/json" }, body: JSON.stringify({ insurance_product_code: "CSU" }) });
  assert.equal(response.status, 422);
});
