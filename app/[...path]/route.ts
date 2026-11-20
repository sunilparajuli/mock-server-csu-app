import JSZip from "jszip";
import { config } from "@/lib/config";
import { catalogue, executeGraphQL } from "@/lib/graphql";
import { JsonRecord, resetState, state, stateSummary } from "@/lib/state";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(data, { status, headers });
}

function authorized(request: Request) {
  if (!config.requireAuth) return true;
  return request.headers.get("authorization")?.toLowerCase() === `bearer ${config.token}`;
}

async function body(request: Request): Promise<JsonRecord> {
  try { return await request.json() as JsonRecord; } catch { return {}; }
}

function fhirBundle(resources: JsonRecord[], page: number) {
  const start = Math.max(0, (page - 1) * config.pageSize);
  const links: JsonRecord[] = [{ relation: "self", url: "mock" }];
  if (start + config.pageSize < resources.length) links.push({ relation: "next", url: `?page-offset=${page + 1}` });
  return { resourceType: "Bundle", type: "searchset", total: resources.length, link: links, entry: resources.slice(start, start + config.pageSize).map((resource) => ({ resource })) };
}

async function handler(request: Request, context: { params: Promise<{ path: string[] }> }) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  const { path: parts } = await context.params;
  const path = `/${parts.join("/")}${new URL(request.url).pathname.endsWith("/") ? "/" : ""}`;
  const route = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  state.requests.push({ method: request.method, path, at: new Date().toISOString() });
  if (state.requests.length > 500) state.requests.splice(0, state.requests.length - 500);
  if (config.delayMs) await new Promise((resolve) => setTimeout(resolve, config.delayMs));

  if (route === "/health" && request.method === "GET") return json({ status: "ok", services: config.serviceCount, items: config.itemCount, pageSize: config.pageSize });
  if (route === "/__mock__/state" && request.method === "GET") return json(stateSummary());
  if (route === "/__mock__/reset" && request.method === "POST") { resetState(); return json({ status: "reset" }); }

  if (route === "/api/api_fhir_r4/login" && request.method === "POST") {
    const input = await body(request);
    if (!String(input.username ?? "").trim() || !String(input.password ?? "")) return json({ detail: "Invalid credentials" }, 401);
    return json({ token: config.token, exp: Math.floor(Date.now() / 1000) + 43200, username: String(input.username).trim() });
  }
  if (!authorized(request)) return json({ detail: "Missing or invalid bearer token" }, 401);

  if (route === "/api/tools/extracts/download_master_data" && request.method === "GET") {
    const data = { confirmationTypes: [], controls: [], education: [], familyTypes: [{ code: "H", name: "Household" }], hf: [{ id: 1, code: "ES168", name: "Mock Health Facility" }], identificationTypes: [], languages: [{ code: "fr", name: "French" }], locations: [], officers: [{ code: "MOCK001", lastName: "Officer" }], payers: [], products: [{ id: 1, code: "CSU", program: "CCS", minAge: 0, maxAge: 0 }, { id: 2, code: "VIH", program: "VIH", minAge: 0, maxAge: 0 }], professions: [], relations: [], phoneDefaults: { countryCode: "+237" }, genders: [{ code: "M" }, { code: "F" }], programs: [{ code: "CCS" }, { code: "VIH" }], cheques: [{ code: "CC240524", status: "New" }, { code: "CC240523", status: "Used" }], ModuleConfiguration: { layer: "fe", is_exposed: true, mpiMinLength: 12, mpiMaxLength: 20, chequeMinLength: 6 }, mockCatalogue: { serviceCount: config.serviceCount, itemCount: config.itemCount } };
    const zip = new JSZip();
    zip.file("MasterData.txt", JSON.stringify(data));
    const buffer = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const archiveBody = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    return new Response(archiveBody, { headers: { "content-type": "application/zip", "content-disposition": 'attachment; filename="MasterData.zip"' } });
  }
  if (route === "/api/graphql" && request.method === "POST") {
    const input = await body(request);
    try { return json({ data: executeGraphQL(String(input.query ?? ""), (input.variables ?? {}) as JsonRecord) }); }
    catch (error) { return json({ errors: [{ message: error instanceof Error ? error.message : String(error) }] }, 400); }
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page-offset") ?? 1);
  if (route === "/api/api_fhir_r4/Practitioner" && request.method === "GET") {
    const code = url.searchParams.get("identifier") ?? "MOCK001";
    return json(fhirBundle([{ resourceType: "Practitioner", id: "ca-1", identifier: [{ value: code }], name: [{ family: "Administrator" }] }], page));
  }
  if (route === "/api/api_fhir_r4/CodeSystem/diagnosis" && request.method === "GET") return json({ resourceType: "CodeSystem", id: "diagnosis", concept: [{ code: "D001", display: "Mock diagnosis" }] });
  if (route === "/api/api_fhir_r4/ActivityDefinition" && request.method === "GET") return json(fhirBundle(catalogue.services((page - 1) * config.pageSize).edges.map((edge) => ({ resourceType: "ActivityDefinition", ...edge.node })), 1));
  if (route === "/api/api_fhir_r4/Medication" && request.method === "GET") return json(fhirBundle(catalogue.items((page - 1) * config.pageSize).edges.map((edge) => ({ resourceType: "Medication", ...edge.node })), 1));
  if (route === "/api/api_fhir_r4/Claim" && request.method === "POST") { const input = await body(request); const id = String(input.id ?? crypto.randomUUID()); state.claims.set(id, input); return json({ resourceType: "Claim", id }, 201); }
  if (route === "/api/api_fhir_r4/Communication" && request.method === "POST") { const input = await body(request); if (input.resourceType !== "Communication") return json({ detail: "resourceType must be Communication" }, 422); const saved = { ...input, id: input.id ?? crypto.randomUUID() }; state.communications.push(saved); return json(saved, 201); }

  if (route === "/rest/api/policy/commissions" && request.method === "POST") {
    if (request.headers.get("api-version") !== "3") return json({ detail: "api-version: 3 is required" }, 400);
    const input = await body(request);
    if (!("insrance_product_code" in input)) return json({ detail: "Legacy field insrance_product_code is required" }, 422);
    return json({ commissions: [{ officerCode: input.enrolment_officer_code, amount: 25000, month: input.month, year: input.year }] });
  }
  if (route === "/rest/api/GetControlNumbersForEO" && request.method === "POST") { const input = await body(request); const count = Number(input.availableControlNumbers ?? 5); return json({ productCode: input.productCode, controlNumbers: Array.from({ length: count }, (_, i) => `CTRL${String(i + 1).padStart(6, "0")}`) }); }
  if (route === "/rest/api/GetAssignedControlNumbers" && request.method === "POST") { const input = await body(request); return json({ requests: input.requests ?? [], status: "assigned" }); }
  if (route === "/rest/api/GetControlNumber" && request.method === "POST") return json({ controlNumber: `CTRL${String(state.policies.size + 1).padStart(6, "0")}`, request: await body(request) });
  if (route === "/rest/api/premium/receipt" && request.method === "POST") { const input = await body(request); return json({ ReceiptNo: input.ReceiptNo, CHFID: input.CHFID, isValid: Boolean(input.ReceiptNo && input.CHFID) }); }
  if (parts[0] === "Images" && parts[1] === "Updated" && request.method === "GET") {
    const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==", "base64"));
    const imageBody = png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer;
    return new Response(imageBody, { headers: { "content-type": "image/png", "x-mock-photo": parts[2] ?? "" } });
  }
  return json({ detail: `Mock route not found: ${request.method} ${path}` }, 404);
}

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Authorization, Content-Type, Accept, api-version",
  "access-control-max-age": "86400",
};

async function withCors(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const response = await handler(request, context);
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export const GET = withCors;
export const POST = withCors;
export const OPTIONS = withCors;
