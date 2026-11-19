export const config = {
  token: "cameroon-mock-token",
  serviceCount: Number(process.env.MOCK_SERVICE_COUNT ?? 250),
  itemCount: Number(process.env.MOCK_ITEM_COUNT ?? 250),
  pageSize: Math.max(1, Number(process.env.MOCK_PAGE_SIZE ?? 100)),
  requireAuth: !["0", "false", "no"].includes(
    (process.env.MOCK_REQUIRE_AUTH ?? "true").toLowerCase(),
  ),
  delayMs: Math.max(0, Number(process.env.MOCK_DELAY_MS ?? 0)),
};
