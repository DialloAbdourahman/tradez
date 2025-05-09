import { Router } from "express";
import {
  validateActivateAccount,
  validateAddPassword,
  validateAdminCreateSuperUser,
  validateGeneratePasswordCode,
  validateOauth,
  validateResetPassword,
  validateSignin,
  validateSignup,
  validateTwoFactor,
  validateUpdateAccount,
  validateUpdatePassword,
} from "../middleware/validate-request";
import authController from "../controllers/auth-controller";
import { requireAuth } from "../middleware/require-auth";
import { verifyRoles } from "../middleware/verify-roles";
import { UserType } from "@prisma/client";

const router = Router();

router
  // .post("/add", authController.addUser)
  // .get("/test-alpaca", authController.testAlpaca)
  .post("/signup", validateSignup, authController.signUp) // TESTED
  .post("/activate", validateActivateAccount, authController.activateMyAccount) // TESTED
  .post("/signin", validateSignin, authController.signin) // TESTED
  .post("/set-2fa", validateTwoFactor, authController.setTwoFA) // TESTED
  .post("/verify-2fa", validateTwoFactor, authController.verifyTwoFA) // TESTED
  .post(
    "/secured-super-user",
    requireAuth,
    verifyRoles([UserType.Admin]),
    validateAdminCreateSuperUser,
    authController.createsSecuredSuperUser
  ) // TESTED
  .post("/logout", requireAuth, authController.logout) // TESTED
  .post("/token", authController.refreshToken) // TESTED
  .post(
    "/forgot-password",
    validateGeneratePasswordCode,
    authController.forgotPassword
  ) // TESTED
  .post(
    "/restore/:id",
    requireAuth,
    verifyRoles([UserType.Admin]),
    authController.restoreUser
  ) // TESTED
  .post(
    "/deactivate-account/:id",
    requireAuth,
    verifyRoles([UserType.Admin]),
    authController.deactivateAccount
  ) // TESTED
  .post("/oauth-google", validateOauth, authController.oauthGoogle) // TESTED
  .post(
    "/super-user-activates-account/:id",
    requireAuth,
    verifyRoles([UserType.Admin]),
    authController.activateAccount
  ) // TESTED
  .get("/profile", requireAuth, authController.getProfile) // TESTED
  .get("/has-password", requireAuth, authController.hasPassword) // TESTED
  .patch(
    "/add-password",
    requireAuth,
    verifyRoles([UserType.Client]),
    validateAddPassword,
    authController.addPassword
  ) // TESTED
  .patch(
    "/update",
    requireAuth,
    validateUpdateAccount,
    authController.updateAccount
  ) // TESTED
  .patch("/reset-password", validateResetPassword, authController.resetPassword) // TESTED
  .patch(
    "/update-password",
    requireAuth,
    validateUpdatePassword,
    authController.updatePassword
  ) // TESTED
  .delete(
    "/:id",
    requireAuth,
    verifyRoles([UserType.Admin]),
    authController.deleteUser
  );

export { router as authRouter };

// Test the routes.
// Document the routes.

// More admin routes like
//  => Getting the list of users.
//  => Lost device reset two factor auth route.
