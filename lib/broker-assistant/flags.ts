/** Feature flags for the broker email assistant (off by default). */

export {
  isBrokerAssistantEmailEnabled,
  isMailboxOAuthEnabled,
} from "../broker-agent/flags";

export function assertBrokerAssistantEnabled() {
  if (
    process.env.BROKER_ASSISTANT_EMAIL !== "1" &&
    process.env.BROKER_ASSISTANT_EMAIL !== "true"
  ) {
    throw new Error("Broker email assistant is disabled (set BROKER_ASSISTANT_EMAIL=1)");
  }
}
