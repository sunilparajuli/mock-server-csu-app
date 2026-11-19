export type JsonRecord = Record<string, unknown>;

export interface MockState {
  claims: Map<string, JsonRecord>;
  families: Map<string, JsonRecord>;
  insurees: Map<string, JsonRecord>;
  policies: Map<string, JsonRecord>;
  premiums: Map<string, JsonRecord>;
  renewals: Map<string, JsonRecord>;
  mutationLogs: Map<string, JsonRecord>;
  communications: JsonRecord[];
  requests: { method: string; path: string; at: string }[];
}

const globalState = globalThis as typeof globalThis & { __cameroonMock?: MockState };

export const state: MockState =
  globalState.__cameroonMock ?? {
    claims: new Map(),
    families: new Map(),
    insurees: new Map(),
    policies: new Map(),
    premiums: new Map(),
    renewals: new Map(),
    mutationLogs: new Map(),
    communications: [],
    requests: [],
  };

globalState.__cameroonMock = state;

export function resetState() {
  state.claims.clear();
  state.families.clear();
  state.insurees.clear();
  state.policies.clear();
  state.premiums.clear();
  state.renewals.clear();
  state.mutationLogs.clear();
  state.communications.length = 0;
  state.requests.length = 0;
}

export function stateSummary() {
  return {
    claims: state.claims.size,
    families: state.families.size,
    insurees: state.insurees.size,
    policies: state.policies.size,
    premiums: state.premiums.size,
    renewals: state.renewals.size,
    communications: state.communications.length,
    requestCount: state.requests.length,
    recentRequests: state.requests.slice(-30).reverse(),
  };
}
