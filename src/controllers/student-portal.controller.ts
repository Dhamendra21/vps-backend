import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { students } from "../db/schema/students.js";
import { provisionStudentPortalLogin } from "../utils/student-portal-provision.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { getParamId } from "../utils/request.js";

export const provisionPortalAccess = asyncHandler(
  async (req: Request, res: Response) => {
    const studentId = getParamId(req);
    const body = req.body as {
      email: string;
      password: string;
      name?: string;
    };

    const [student] = await db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    if (!student) throw new ApiError(404, "Student not found");

    const result = await provisionStudentPortalLogin(req, studentId, {
      email: body.email,
      password: body.password,
      name:
        body.name ?? `${student.firstName} ${student.lastName}`.trim(),
    });

    res.status(201).json({
      success: true,
      data: {
        userId: result.user.id,
        email: result.user.email,
        studentId: result.student?.id,
      },
    });
  },
);