import { fromNodeHeaders } from "better-auth/node";
import type { NextFunction, Request, Response } from "express";
import { auth, type AuthSession } from "../lib/auth.js";
import { ApiError } from "../utils/api-error.js";
import { canStudentUsePortal } from "../utils/student-portal-access.js";
import { isAdminRole } from "../utils/roles.js";

type SessionUser = AuthSession["user"] & {
  role?: string | null;
};

declare global {
  namespace Express {
    interface Request {
      session?: AuthSession | null;
      user?: SessionUser | null;
    }
  }
}

export async function attachSession(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (
      session?.user &&
      !isAdminRole(session.user.role) &&
      !(await canStudentUsePortal(session.user.id))
    ) {
      req.session = null;
      req.user = null;
      return next();
    }

    req.session = session;
    req.user = session?.user ?? null;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new ApiError(401, "Authentication required"));
  }
  next();
}