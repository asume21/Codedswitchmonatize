import jwt from "jsonwebtoken";

const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.AUTH_TOKEN_SECRET) {
  console.error(
    "❌ FATAL: AUTH_TOKEN_SECRET environment variable is required in production",
  );
}

const SECRET =
  process.env.AUTH_TOKEN_SECRET || "dev_auth_token_secret_change_me";

const TOKEN_TTL = "7d";

export interface AuthTokenPayload {
  userId: string;
}

export function signUserToken(userId: string): string {
  return jwt.sign({ userId } satisfies AuthTokenPayload, SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

export function verifyUserToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, SECRET) as AuthTokenPayload | string;
    if (typeof decoded === "string" || !decoded?.userId) return null;
    return decoded.userId;
  } catch {
    return null;
  }
}
