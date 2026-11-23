import { Router } from "express";
import {
  createAdmission,
  getAdmission,
  listAdmissions,
  updateAdmission,
} from "../controllers/admission.controller.js";
import { createBifurcation, searchBifurcations } from "../controllers/bifurcation.controller.js";
import {
  downloadLeavingCertificate,
  downloadTransferCertificate,
  listLeavingCertificates,
  listTransferCertificates,
  uploadLeavingCertificate,
  uploadTransferCertificate,
} from "../controllers/certificate.controller.js";
import {
  convertInquiryToRegistration,
  createInquiry,
  getInquiry,
  listInquiries,
  updateInquiry,
} from "../controllers/inquiry.controller.js";
import {
  createRegistration,
  getRegistration,
  listRegistrations,
  updateRegistration,
} from "../controllers/registration.controller.js";
import {
  getMyStudentProfile,
  getStudentById,
  linkStudentToUser,
} from "../controllers/student-profile.controller.js";
import { provisionPortalAccess } from "../controllers/student-portal.controller.js";
import { attachSession, requireAuth } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/rbac.middleware.js";
import { certificateUpload } from "../middlewares/upload.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  admissionListQuerySchema,
  bifurcationSearchQuerySchema,
  certificateListQuerySchema,
  convertInquirySchema,
  createAdmissionSchema,
  createBifurcationSchema,
  createInquirySchema,
  createRegistrationSchema,
  idParamSchema,
  inquiryListQuerySchema,
  linkStudentUserSchema,
  provisionPortalAccessSchema,
  registrationListQuerySchema,
  updateAdmissionSchema,
  updateInquirySchema,
  updateRegistrationSchema,
  uploadCertificateMetaSchema,
  uploadLeavingCertificateMetaSchema,
} from "../validators/student.validator.js";

const studentRouter = Router();

studentRouter.use(attachSession, requireAuth);

studentRouter.get("/me", getMyStudentProfile);
studentRouter.get(
  "/profile/:id",
  validate({ params: idParamSchema }),
  getStudentById,
);

studentRouter.get(
  "/inquiries",
  validate({ query: inquiryListQuerySchema }),
  listInquiries,
);
studentRouter.get(
  "/inquiries/:id",
  validate({ params: idParamSchema }),
  getInquiry,
);
studentRouter.post(
  "/inquiries",
  requireAdmin,
  validate({ body: createInquirySchema }),
  createInquiry,
);
studentRouter.patch(
  "/inquiries/:id",
  requireAdmin,
  validate({ params: idParamSchema, body: updateInquirySchema }),
  updateInquiry,
);
studentRouter.post(
  "/inquiries/:id/convert-registration",
  requireAdmin,
  validate({ params: idParamSchema, body: convertInquirySchema }),
  convertInquiryToRegistration,
);

studentRouter.get(
  "/registrations",
  validate({ query: registrationListQuerySchema }),
  listRegistrations,
);
studentRouter.get(
  "/registrations/:id",
  validate({ params: idParamSchema }),
  getRegistration,
);
studentRouter.post(
  "/registrations",
  requireAdmin,
  validate({ body: createRegistrationSchema }),
  createRegistration,
);
studentRouter.patch(
  "/registrations/:id",
  requireAdmin,
  validate({ params: idParamSchema, body: updateRegistrationSchema }),
  updateRegistration,
);

studentRouter.get(
  "/admissions",
  validate({ query: admissionListQuerySchema }),
  listAdmissions,
);
studentRouter.get(
  "/admissions/:id",
  validate({ params: idParamSchema }),
  getAdmission,
);
studentRouter.post(
  "/admissions",
  requireAdmin,
  validate({ body: createAdmissionSchema }),
  createAdmission,
);
studentRouter.patch(
  "/admissions/:id",
  requireAdmin,
  validate({ params: idParamSchema, body: updateAdmissionSchema }),
  updateAdmission,
);

studentRouter.get(
  "/transfer-certificates",
  validate({ query: certificateListQuerySchema }),
  listTransferCertificates,
);
studentRouter.post(
  "/transfer-certificates",
  requireAdmin,
  certificateUpload.single("file"),
  validate({ body: uploadCertificateMetaSchema }),
  uploadTransferCertificate,
);
studentRouter.get(
  "/transfer-certificates/:id/download",
  validate({ params: idParamSchema }),
  downloadTransferCertificate,
);

studentRouter.get(
  "/leaving-certificates",
  validate({ query: certificateListQuerySchema }),
  listLeavingCertificates,
);
studentRouter.post(
  "/leaving-certificates",
  requireAdmin,
  certificateUpload.single("file"),
  validate({ body: uploadLeavingCertificateMetaSchema }),
  uploadLeavingCertificate,
);
studentRouter.get(
  "/leaving-certificates/:id/download",
  validate({ params: idParamSchema }),
  downloadLeavingCertificate,
);

studentRouter.get(
  "/bifurcations/search",
  validate({ query: bifurcationSearchQuerySchema }),
  searchBifurcations,
);
studentRouter.post(
  "/bifurcations",
  requireAdmin,
  validate({ body: createBifurcationSchema }),
  createBifurcation,
);

studentRouter.patch(
  "/:id/link-user",
  requireAdmin,
  validate({ params: idParamSchema, body: linkStudentUserSchema }),
  linkStudentToUser,
);

studentRouter.post(
  "/:id/portal-access",
  requireAdmin,
  validate({ params: idParamSchema, body: provisionPortalAccessSchema }),
  provisionPortalAccess,
);

export { studentRouter };