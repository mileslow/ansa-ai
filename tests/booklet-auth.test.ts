import { describe, expect, it } from "vitest";
import {
  assertOwner,
  bearerToken,
  BookletAuthError,
  requireBookletUser,
} from "../lib/booklet-auth";

describe("Booklet Studio ownership", () => {
  it("parses bearer tokens without accepting other authorization schemes", () => {
    expect(bearerToken("Bearer firebase-token")).toBe("firebase-token");
    expect(bearerToken("bearer another-token")).toBe("another-token");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });

  it("rejects missing and cross-owner records", () => {
    expect(() => assertOwner("user-1", "user-1")).not.toThrow();
    expect(() => assertOwner("user-2", "user-1")).toThrow(BookletAuthError);
    expect(() => assertOwner(undefined, "user-1")).toThrow(
      "belongs to another user",
    );
  });

  it("accepts only a server-injected development identity outside production", async () => {
    await expect(
      requireBookletUser({ headers: {}, bookletDevUserId: "local-booklet-studio" }),
    ).resolves.toEqual({ uid: "local-booklet-studio" });
  });
});
