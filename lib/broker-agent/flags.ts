/** Feature flags — off by default so mistaken deploys stay safe. */

export function isBrokerVoiceBetaEnabled() {
  return process.env.BROKER_VOICE_BETA === "1" || process.env.BROKER_VOICE_BETA === "true";
}

export function isMailboxOAuthEnabled() {
  return (
    process.env.BROKER_MAILBOX_OAUTH === "1" ||
    process.env.BROKER_MAILBOX_OAUTH === "true"
  );
}

export function isBrokerAssistantEmailEnabled() {
  return (
    process.env.BROKER_ASSISTANT_EMAIL === "1" ||
    process.env.BROKER_ASSISTANT_EMAIL === "true"
  );
}
