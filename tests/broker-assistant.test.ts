import { describe, expect, it, afterEach } from "vitest";
import {
  isBrokerAssistantEmailEnabled,
  isMailboxOAuthEnabled,
} from "../lib/broker-agent/flags";
import { isNoiseEmail } from "../lib/broker-assistant/gmail-ops";
import { listFutureConnectors } from "../lib/broker-assistant/future-connectors";

describe("broker assistant flags", () => {
  const originalAssistant = process.env.BROKER_ASSISTANT_EMAIL;
  const originalMailbox = process.env.BROKER_MAILBOX_OAUTH;

  afterEach(() => {
    if (originalAssistant === undefined) delete process.env.BROKER_ASSISTANT_EMAIL;
    else process.env.BROKER_ASSISTANT_EMAIL = originalAssistant;
    if (originalMailbox === undefined) delete process.env.BROKER_MAILBOX_OAUTH;
    else process.env.BROKER_MAILBOX_OAUTH = originalMailbox;
  });

  it("keeps assistant and mailbox oauth off by default", () => {
    delete process.env.BROKER_ASSISTANT_EMAIL;
    delete process.env.BROKER_MAILBOX_OAUTH;
    expect(isBrokerAssistantEmailEnabled()).toBe(false);
    expect(isMailboxOAuthEnabled()).toBe(false);
  });

  it("enables when set to 1", () => {
    process.env.BROKER_ASSISTANT_EMAIL = "1";
    process.env.BROKER_MAILBOX_OAUTH = "1";
    expect(isBrokerAssistantEmailEnabled()).toBe(true);
    expect(isMailboxOAuthEnabled()).toBe(true);
  });
});

describe("gmail noise filter", () => {
  it("skips noreply and self mail", () => {
    expect(
      isNoiseEmail(
        {
          id: "1",
          threadId: "t",
          from: "noreply@carrier.com",
          to: [],
          subject: "Notice",
          body: "hi",
          labelIds: ["INBOX"],
        },
        "broker@ansa.test",
      ),
    ).toBe(true);
    expect(
      isNoiseEmail(
        {
          id: "2",
          threadId: "t",
          from: "Client <hr@acme.com>",
          to: [],
          subject: "HSA question",
          body: "How does our HSA work?",
          labelIds: ["INBOX"],
        },
        "broker@ansa.test",
      ),
    ).toBe(false);
  });
});

describe("future connectors", () => {
  it("exposes desktop and carrier_web stubs", () => {
    const ids = listFutureConnectors().map((c) => c.id).sort();
    expect(ids).toEqual(["carrier_web", "desktop"]);
  });
});
