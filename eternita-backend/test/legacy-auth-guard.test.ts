import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@nestjs/common", () => ({
  UnauthorizedException: class UnauthorizedException extends Error {},
  Injectable: () => () => undefined,
}));
jest.mock("../src/auth/firebase-auth.service", () => ({ FirebaseAuthService: class FirebaseAuthService {} }));

import { AuthGuard } from "../src/auth/auth.guard";

describe("legacy route authentication boundary", () => {
  it("rejects unauthenticated requests", async () => {
    const verifyIdToken = jest.fn() as jest.Mock;
    (verifyIdToken as any).mockRejectedValue(new Error("Missing bearer token"));
    const guard = new AuthGuard({ verifyIdToken } as any);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    } as any;

    await expect(guard.canActivate(context)).rejects.toThrow();
  });
});
