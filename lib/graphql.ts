import { randomUUID } from "node:crypto";
import { config } from "./config";
import { JsonRecord, state } from "./state";

function operationName(query: string): string {
  const match = query.match(/\b(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  if (match) return match[1];
  for (const name of ["mutationLogs", "createClaim", "createFamily", "createInsuree", "createPolicy", "createPremium", "renewPolicy"]) {
    if (query.includes(name)) return name;
  }
  throw new Error("GraphQL operation name is required");
}

function pageInfo(offset: number, total: number) {
  const end = Math.min(total, offset + config.pageSize);
  return { hasNextPage: end < total, hasPreviousPage: offset > 0, endCursor: String(end) };
}

type CatalogNode = {
  id: string;
  code: string;
  name: string;
  price: number;
  program?: { code: string; nameProgram?: string };
};

type CatalogConnection = {
  totalCount: number;
  pageInfo: ReturnType<typeof pageInfo>;
  edges: { node: CatalogNode }[];
};

function services(offset: number): CatalogConnection {
  const end = Math.min(config.serviceCount, offset + config.pageSize);
  const edges = Array.from({ length: Math.max(0, end - offset) }, (_, index) => {
    const number = offset + index + 1;
    return { node: { id: `service-${number}`, code: `SRV${String(number).padStart(5, "0")}`, name: `Mock medical service ${String(number).padStart(5, "0")}`, price: 500 + (number % 5000), program: { code: number % 2 ? "CCS" : "VIH" } } };
  });
  return { totalCount: config.serviceCount, pageInfo: pageInfo(offset, config.serviceCount), edges };
}

function items(offset: number): CatalogConnection {
  const end = Math.min(config.itemCount, offset + config.pageSize);
  const edges = Array.from({ length: Math.max(0, end - offset) }, (_, index) => {
    const number = offset + index + 1;
    return { node: { id: `item-${number}`, code: `ITM${String(number).padStart(5, "0")}`, name: `Mock medical item ${String(number).padStart(5, "0")}`, price: 100 + (number % 2500) } };
  });
  return { totalCount: config.itemCount, pageInfo: pageInfo(offset, config.itemCount), edges };
}

function priceListServices() {
  return services(0).edges.map(({ node }) => ({ node: { service: { ...node, nameProgram: node.program?.code ?? "CCS" } } }));
}

function priceListItems() {
  return items(0).edges.map(({ node }) => ({ node: { item: { ...node, program: { code: "CCS", nameProgram: "Cheque Sante" } } } }));
}

function facilityCatalog(connection: CatalogConnection, facilityId: string) {
  return {
    ...connection,
    edges: connection.edges.map(({ node }) => {
      const programCode = node.program?.code ?? "CCS";
      return { node: {
      ...node,
      type: "H",
      program: { code: programCode, nameProgram: node.program?.nameProgram ?? programCode },
      healthFacility: { id: facilityId, code: "ES168" },
      } };
    }),
  };
}

function mutationResult(input: JsonRecord, label: string) {
  const clientMutationId = String(input.clientMutationId ?? randomUUID());
  const result = { clientMutationId, internalId: randomUUID() };
  state.mutationLogs.set(clientMutationId, { clientMutationId, clientMutationLabel: label, status: 0, error: null, requestDateTime: new Date().toISOString() });
  return result;
}

function inputOf(variables: JsonRecord): JsonRecord {
  const input = variables.input;
  return input && typeof input === "object" && !Array.isArray(input) ? input as JsonRecord : {};
}

export function executeGraphQL(query: string, variables: JsonRecord): JsonRecord {
  const operation = operationName(query);
  const name = operation.toLowerCase();
  const offset = Number(variables.offset ?? 0);

  if (["checkmutation", "mutationlogs"].includes(name)) {
    const log = state.mutationLogs.get(String(variables.clientMutationId ?? ""));
    const edges = log ? [{ node: log }] : [];
    return { mutationLogs: { totalCount: edges.length, edges } };
  }
  if (["getservices", "claimservices"].includes(name)) return { medicalServices: facilityCatalog(services(offset), String(variables.hfId ?? "hf-1")) };
  if (["getmedications", "getitems", "claimitems"].includes(name)) return { medicalItems: facilityCatalog(items(offset), String(variables.hfId ?? "hf-1")) };
  if (name === "claimgenericcatalog" || name === "claimgenericcatalogquery") {
    const facilityId = String(variables.healthFacilityId ?? "hf-1");
    return { medicalServices: facilityCatalog(services(offset), facilityId), medicalItems: facilityCatalog(items(offset), facilityId) };
  }
  if (["getdiagnosis", "claimdiagnoses"].includes(name)) {
    const all = Array.from({ length: 20 }, (_, i) => ({ node: { id: String(i + 1), code: `D${String(i + 1).padStart(3, "0")}`, name: `Mock diagnosis ${i + 1}` } }));
    return { diagnoses: { totalCount: all.length, pageInfo: pageInfo(offset, all.length), edges: all.slice(offset, offset + config.pageSize) } };
  }
  if (["getprograms", "claimprograms"].includes(name)) return { program: { edges: [{ node: { idProgram: "1", code: "CCS", nameProgram: "Cheque Sante" } }, { node: { idProgram: "2", code: "VIH", nameProgram: "VIH" } }] } };
  if (name === "claimgenericcatalog" || name === "claimeligiblecatalog") {
    const facilityId = String(variables.healthFacilityId ?? "hf-1");
    return { medicalServices: facilityCatalog(services(offset), facilityId), medicalItems: facilityCatalog(items(offset), facilityId) };
  }
  if (["getclaimadmins", "claimmobilesetup"].includes(name)) return { claimAdmins: { totalCount: 1, pageInfo: pageInfo(0, 1), edges: [{ node: { id: "ca-1", code: variables.code ?? "MOCK001", lastName: "Administrator", healthFacility: { id: "hf-1", code: "ES168", name: "Mock Health Facility", servicesPricelist: { details: { edges: priceListServices() } }, itemsPricelist: { details: { edges: priceListItems() } } }, programs: [{ id: "1", code: "CCS" }] } }] } };
  if (name === "getpaymentlist") return { claimAdmins: { edges: [{ node: { code: variables.claim_administrator_code ?? "MOCK001", healthFacility: { id: "hf-1", code: "ES168", servicesPricelist: { details: { edges: priceListServices() } }, itemsPricelist: { details: { edges: priceListItems() } } } } }] } };
  if (["getinsuree", "inquire", "getinsureeinquire", "insureeprofilequery"].includes(name)) {
    const chfId = String(variables.chfId ?? variables.chfid ?? variables.insureeCHFID ?? "120902348063480");
    const node = { id: "insuree-1", uuid: "insuree-uuid-1", chfId, lastName: "Mock", otherNames: "Beneficiary", gender: { code: "F" }, dob: "1990-01-01" };
    return query.includes("insureeProfile") ? { insureeProfile: node } : { insurees: { totalCount: 1, edges: [{ node }] } };
  }
  if (name === "chequeimportline") {
    const code = String(variables.chequeImportLineCode ?? "");
    return { chequeimportline: { code, status: code === "CC240523" ? "Used" : "New" } };
  }
  if (name === "validateclaimcode") {
    const code = String(variables.claimCode ?? "");
    return { validateClaimCode: Boolean(code) && !state.claims.has(code) };
  }
  if (name === "createclaim") {
    const input = inputOf(variables);
    const code = String(input.code ?? `CLM-${state.claims.size + 1}`);
    if (state.claims.has(code)) return { createClaim: null, errors: ["Claim already exists"] };
    const result = mutationResult(input, `create claim ${code}`);
    state.claims.set(code, { ...input, id: result.internalId });
    return { createClaim: result };
  }

  const mutations: Record<string, [Map<string, JsonRecord>, string]> = {
    createfamily: [state.families, "createFamily"], updatefamily: [state.families, "updateFamily"],
    createinsuree: [state.insurees, "createInsuree"], updateinsuree: [state.insurees, "updateInsuree"],
    createpolicy: [state.policies, "createPolicy"], createpremium: [state.premiums, "createPremium"],
  };
  if (mutations[name]) {
    const [bucket, responseKey] = mutations[name];
    const input = inputOf(variables);
    const key = String(input.uuid ?? input.id ?? input.chfId ?? randomUUID());
    bucket.set(key, { ...input, uuid: key });
    return { [responseKey]: mutationResult(input, operation) };
  }
  if (["renewpolicy", "renewpolicymutation"].includes(name)) {
    const input = inputOf(variables);
    if (!input.uuid) return { renewPolicy: null, errors: ["Expected input.uuid"] };
    state.renewals.set(String(input.uuid), input);
    return { renewPolicy: mutationResult(input, "renew policy") };
  }
  if (["deleterenewal", "deletepolicyrenewals"].includes(name)) {
    const input = inputOf(variables);
    if (Array.isArray(input.uuids)) input.uuids.forEach((id) => state.renewals.delete(String(id)));
    return { deletePolicyRenewals: mutationResult(input, "delete renewals") };
  }
  if (name === "getrenewals") return { policyRenewals: { totalCount: state.renewals.size, edges: [...state.renewals.values()].map((node) => ({ node })) } };
  if (name === "getclaims") return { claims: { totalCount: state.claims.size, edges: [...state.claims.values()].map((node) => ({ node })) } };
  if (name === "getfamily") return { families: { totalCount: state.families.size, edges: [...state.families.values()].map((node) => ({ node })) } };
  if (["getfamilypolicies", "getpolicy"].includes(name)) return { policiesByFamily: { totalCount: state.policies.size, edges: [...state.policies.values()].map((node) => ({ node })) } };
  if (["getsnapshotpolicies", "getcumulativepolicies"].includes(name)) {
    const counts: Record<string, number> = { idle: 3, active: 12, suspended: 2, expired: 7, ready: 1, new: 6, renewed: 4 };
    return Object.fromEntries(Object.entries(counts).filter(([key]) => query.includes(key)).map(([key, value]) => [key, { totalCount: value }]));
  }
  throw new Error(`Unsupported mock GraphQL operation: ${operation}`);
}

export const catalogue = { services, items };
