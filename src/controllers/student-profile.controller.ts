import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import {
  studentAdmissions,
  studentInquiries,
  studentRegistrations,
  students,
} from "../db/schema/students.js";
import { getStudentRowForUser } from "../utils/student-access.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { isAdminRole } from "../utils/roles.js";
import { getParamId } from "../utils/request.js";
import { isPortalEligibleLifecycle } from "../utils/student-portal-access.js";

type AuthUser = { id: string; role?: string | null };

export const getMyStudentProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const student = await getStudentRowForUser(user.id);

    if (!student) {
      throw new ApiError(
        404,
        "No student profile is linked to your account. Contact the school admin.",
      );
    }

    const [latestRegistration] = await db
      .select()
      .from(studentRegistrations)
      .where(eq(studentRegistrations.studentId, student.id))
      .limit(1);

    const [latestAdmission] = await db
      .select()
      .from(studentAdmissions)
      .where(eq(studentAdmissions.studentId, student.id))
      .limit(1);

    const [latestInquiry] = await db
      .select()
      .from(studentInquiries)
      .where(eq(studentInquiries.studentId, student.id))
      .limit(1);

    res.json({
      success: true,
      data: {
        student,
        inquiry: latestInquiry ?? null,
        registration: latestRegistration ?? null,
        admission: latestAdmission ?? null,
      },
    });
  },
);

export const linkStudentToUser = asyncHandler(
  async (req: Request, res: Response) => {
    const id = getParamId(req);
    const body = req.body as { userId: string };

    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.id, id))
      .limit(1);

    if (!student) throw new ApiError(404, "Student not found");

    if (!isPortalEligibleLifecycle(student.lifecycleStatus)) {
      throw new ApiError(
        400,
        "Portal login can only be linked after the student is admitted",
      );
    }

    const [updated] = await db
      .update(students)
      .set({ userId: body.userId })
      .where(eq(students.id, id))
      .returning();

    res.json({ success: true, data: updated });
  },
);

export const getStudentById = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  const id = getParamId(req);

  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.id, id))
    .limit(1);

  if (!student) throw new ApiError(404, "Student not found");

  if (!isAdminRole(user.role) && student.userId !== user.id) {
    throw new ApiError(403, "You do not have access to this student record");
  }

  res.json({ success: true, data: student });
});