import type { VercelRequest } from "@vercel/node";
import { getAdminServices } from "./firebase-admin";

export class BookletAuthError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = "BookletAuthError";
    this.statusCode = statusCode;
  }
}

export function bearerToken(value: string | string[] | undefined) {
  const header = Array.isArray(value) ? value[0] : value;
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

type BookletAuthRequest = Pick<VercelRequest, "headers"> & {
  bookletDevUserId?: string;
};

export async function requireBookletUser(req: BookletAuthRequest) {
  if (process.env.NODE_ENV !== "production" && req.bookletDevUserId)
    return { uid: req.bookletDevUserId };
  const token = bearerToken(req.headers.authorization);
  if (!token)
    throw new BookletAuthError("Sign in is required to use Booklet Studio");
  try {
    const decoded = await getAdminServices().auth.verifyIdToken(token, true);
    if (!decoded.uid) throw new Error("Token contains no user ID");
    return { uid: decoded.uid };
  } catch {
    throw new BookletAuthError("Your Booklet Studio session is invalid or expired");
  }
}

export function assertOwner(ownerId: string | undefined, userId: string) {
  if (!ownerId || ownerId !== userId)
    throw new BookletAuthError("This Booklet Studio record belongs to another user", 403);
}
