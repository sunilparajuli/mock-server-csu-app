# Cameroon openIMIS Next.js mock server

Standalone API contract mock based on the Claims CSU, Policies CSU and Policies
VIH APKs. It is separate from the Flutter application.

## Start

```bash
cd /Users/hisoka/openimis/cameroon/mock_server
npm install
npm run dev
```

Open `http://localhost:8080`. For an Android emulator, set the mobile API base
URL to `http://10.0.2.2:8080/`.

Any non-empty username/password works. The token is `cameroon-mock-token`.

## Simulate 30,000 services and items

```bash
MOCK_SERVICE_COUNT=30000 MOCK_ITEM_COUNT=30000 npm run dev
```

Copy `.env.example` to `.env.local` to keep configuration between runs.

## Supported route families

- `POST /api/api_fhir_r4/login/`
- `POST /api/graphql`
- `GET /api/tools/extracts/download_master_data`
- FHIR Practitioner, diagnosis, ActivityDefinition, Medication, Claim and Communication
- Legacy `/rest/api/` commissions, controls and premium receipt routes
- `GET /Images/Updated/{value}`
- `GET /health`, `GET /__mock__/state`, `POST /__mock__/reset`

## Production build and tests

```bash
npm run build
npm test
```

This is an in-memory development mock. Restarting it clears submitted data. It
must not be exposed as a production service.

## Deploy on Vercel

Import the GitHub repository as a Next.js project. No build override is needed.
Set `MOCK_SERVICE_COUNT`, `MOCK_ITEM_COUNT`, `MOCK_PAGE_SIZE`,
`MOCK_REQUIRE_AUTH`, and `MOCK_DELAY_MS` in the Vercel project environment when
their defaults are not suitable.

Vercel functions do not provide durable process memory. Submitted claims,
policies, feedback, request history, and reset state may differ between function
instances and disappear after a cold start. Generated master data and catalogue
responses remain deterministic. Use a database or Vercel KV later if persistent
shared mock state is required.
