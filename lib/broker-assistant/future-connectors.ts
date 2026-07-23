/**
 * Future source connectors (iteration 2+).
 * Iteration 1 only retrieves Ansa DB + company library.
 * Desktop and carrier_web register here so retrieveCompanyKnowledge can grow
 * without rewriting the assistant runtime.
 */

export type FutureConnectorId = "desktop" | "carrier_web";

export const FUTURE_CONNECTORS: Record<
  FutureConnectorId,
  { id: FutureConnectorId; status: "stub"; summary: string }
> = {
  desktop: {
    id: "desktop",
    status: "stub",
    summary:
      "Local helper or watched folder that indexes broker-selected desktop dirs into the company KB.",
  },
  carrier_web: {
    id: "carrier_web",
    status: "stub",
    summary:
      "Async research playbooks per carrier (SBCs/SPDs). Human-verified before reply; not used in auto-drafts until verified.",
  },
};

export function listFutureConnectors() {
  return Object.values(FUTURE_CONNECTORS);
}
