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

test("Flutter claim setup operations return the expected response shapes", async () => {
  const headers = { authorization: "Bearer cameroon-mock-token", "content-type": "application/json" };
  const setup = await fetch(`${base}/api/graphql`, { method: "POST", headers, body: JSON.stringify({ query: "query ClaimMobileSetup($code:String){claimAdmins(code:$code){edges{node{id code healthFacility{id code name servicesPricelist{details{edges{node{service{code name price program{code nameProgram}}}}}}} itemsPricelist{details{edges{node{item{code name price program{code nameProgram}}}}}}}}}}", variables: { code: "MOCK001" } }) });
  const setupData = (await setup.json()).data.claimAdmins.edges[0].node;
  assert.equal(setupData.code, "MOCK001");
  assert.ok(setupData.healthFacility.servicesPricelist.details.edges[0].node.service.code);
  assert.ok(setupData.healthFacility.itemsPricelist.details.edges[0].node.item.code);

  const programs = await fetch(`${base}/api/graphql`, { method: "POST", headers, body: JSON.stringify({ query: "query ClaimPrograms($first:Int){program(first:$first){edges{node{idProgram code nameProgram}}}}", variables: { first: 100 } }) });
  assert.equal((await programs.json()).data.program.edges[0].node.code, "CCS");

  const eligible = await fetch(`${base}/api/graphql`, { method: "POST", headers, body: JSON.stringify({ query: "query ClaimEligibleCatalog($healthFacilityId:ID){medicalServices(healthFacilityId:$healthFacilityId){edges{node{id code name price type program{code nameProgram} healthFacility{id code}}}} medicalItems(healthFacilityId:$healthFacilityId){edges{node{id code name price type program{code nameProgram} healthFacility{id code}}}}}", variables: { healthFacilityId: "hf-1" } }) });
  const eligibleData = (await eligible.json()).data;
  assert.equal(eligibleData.medicalServices.edges[0].node.healthFacility.id, "hf-1");
  assert.equal(eligibleData.medicalItems.edges[0].node.healthFacility.code, "ES168");
});

test("commission contract enforces legacy spelling", async () => {
  const response = await fetch(`${base}/rest/api/policy/commissions`, { method: "POST", headers: { authorization: "Bearer cameroon-mock-token", "api-version": "3", "content-type": "application/json" }, body: JSON.stringify({ insurance_product_code: "CSU" }) });
  assert.equal(response.status, 422);
});
