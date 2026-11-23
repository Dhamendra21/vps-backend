import { fromNodeHeaders } from "better-auth/node";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import { db } from "../db/index.js";
import { students } from "../db/schema/students.js";
import { auth } from "../lib/auth.js";
import { ApiError } from "./api-error.js";
import { isPortalEligibleLifecycle } from "./student-portal-access.js";

type ProvisionInput = {
  email: string;
  password: string;
  name: string;
};

export async function provisionStudentPortalLogin(
  req: Request,
  studentId: string,
  input: ProvisionInput,
) {
  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);

  if (!student) throw new ApiError(404, "Student not found");

  if (!isPortalEligibleLifecycle(student.lifecycleStatus)) {
    throw new ApiError(
      400,
      "Portal login can only be provisioned after the student is admitted",
    );
  }

  if (student.userId) {
    throw new ApiError(
      409,
      "This student already has a portal login. Use link-user to change the account.",
    );
  }

  const created = await auth.api.createUser({
    body: {
      email: input.email,
      password: input.password,
      name: input.name,
    },
    headers: fromNodeHeaders(req.headers),
  });

  if (!created?.user?.id) {
    throw new ApiError(500, "Failed to create student portal account");
  }

  const [updatedStudent] = await db
    .update(students)
    .set({
      userId: created.user.id,
      email: input.email,
    })
    .where(eq(students.id, studentId))
    .returning();

  return {
    user: created.user,
    student: updatedStudent,
  };
}