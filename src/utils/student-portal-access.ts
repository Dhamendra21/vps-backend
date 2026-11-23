import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { user as authUser } from "../db/schema/auth.js";
import { studentRegistrations, students } from "../db/schema/students.js";
import { ApiError } from "./api-error.js";
import { isAdminRole, ROLES } from "./roles.js";

export const STUDENT_PORTAL_LIFECYCLE_STATUSES = [
  "admitted",
  "transferred",
  "left",
] as const;

export type StudentPortalLifecycleStatus =
  (typeof STUDENT_PORTAL_LIFECYCLE_STATUSES)[number];

export async function getStudentProfileByUserId(userId: string) {
  const [row] = await db
    .select()
    .from(students)
    .where(eq(students.userId, userId))
    .limit(1);
  return row ?? null;
}

export function isPortalEligibleLifecycle(
  lifecycleStatus: string,
): lifecycleStatus is StudentPortalLifecycleStatus {
  return (STUDENT_PORTAL_LIFECYCLE_STATUSES as readonly string[]).includes(
    lifecycleStatus,
  );
}

export async function canStudentUsePortal(userId: string): Promise<boolean> {
  const student = await getStudentProfileByUserId(userId);
  if (!student) return false;
  return isPortalEligibleLifecycle(student.lifecycleStatus);
}

export async function assertApprovedRegistration(studentId: string) {
  const [registration] = await db
    .select()
    .from(studentRegistrations)
    .where(
      and(
        eq(studentRegistrations.studentId, studentId),
        eq(studentRegistrations.status, "approved"),
      ),
    )
    .limit(1);

  if (!registration) {
    throw new ApiError(
      400,
      "Student must have an approved school registration before admission",
    );
  }
}

export async function assertStudentPortalLogin(email: string): Promise<void> {
  const [account] = await db
    .select()
    .from(authUser)
    .where(eq(authUser.email, email))
    .limit(1);

  if (!account) return;

  if (isAdminRole(account.role)) return;

  const roles = (account.role ?? ROLES.STUDENT)
    .split(",")
    .map((value) => value.trim());
  if (roles.includes(ROLES.ADMIN)) return;

  const student = await getStudentProfileByUserId(account.id);
  if (!student) {
    throw new ApiError(
      403,
      "Login is only available for students admitted by the school. Contact the admin.",
    );
  }

  if (!isPortalEligibleLifecycle(student.lifecycleStatus)) {
    throw new ApiError(
      403,
      "Your school admission is not complete yet. You can sign in after the school admits you.",
    );
  }
}