import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "../db/index.js";
import * as authSchema from "../db/schema/auth.js";
import { env } from "../utils/env.js";
import { ROLES } from "../utils/roles.js";
import { assertStudentPortalLogin } from "../utils/student-portal-access.js";
import { ApiError as AppApiError } from "../utils/api-error.js";

export const auth = betterAuth({
  appName: "School Management",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  trustedOrigins: env.CORS_ORIGINS,
  plugins: [
    admin({
      defaultRole: ROLES.STUDENT,
      adminRoles: [ROLES.ADMIN],
    }),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = ctx.body?.email;
      if (typeof email !== "string" || !email) return;
      try {
        await assertStudentPortalLogin(email);
      } catch (error) {
        if (error instanceof AppApiError) {
          throw new APIError("FORBIDDEN", { message: error.message });
        }
        if (error instanceof APIError) throw error;
        throw error;
      }
    }),
  },
});

export type AuthSession = typeof auth.$Infer.Session;