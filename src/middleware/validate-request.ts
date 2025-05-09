import { body, ValidationChain } from "express-validator";
import { validationResult } from "express-validator";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { OrchestrationResult } from "../utils/orchestration-result";
import { CODES } from "../enums/codes";

const validateRequest: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    OrchestrationResult.badRequest(
      res,
      CODES.VALIDATION_REQUEST_ERROR,
      `${errors.array().map((error) => `${error.msg}`)}, `
    );
    return;
  }
  next();
};

// Type alias for Validator Middleware
type ValidatorMiddleware = ValidationChain | RequestHandler;

export const validateSignup: ValidatorMiddleware[] = [
  body("name").exists().withMessage("Name must be valid"),
  body("email").isEmail().withMessage("Email must be valid"),
  body("password")
    .trim()
    .isLength({ min: 8, max: 32 })
    .withMessage("Password must be between 8 and 32 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/\d/)
    .withMessage("Password must contain at least one digit")
    .matches(/[\W_]/)
    .withMessage("Password must contain at least one special character"),
  validateRequest,
];

export const validateAdminCreateSuperUser: ValidatorMiddleware[] = [
  body("name").exists().withMessage("Name must be valid"),
  body("email").isEmail().withMessage("Email must be valid"),
  body("type").exists().withMessage("Type must be valid"),
  body("password")
    .trim()
    .isLength({ min: 8, max: 32 })
    .withMessage("Password must be between 8 and 32 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/\d/)
    .withMessage("Password must contain at least one digit")
    .matches(/[\W_]/)
    .withMessage("Password must contain at least one special character"),
  validateRequest,
];

export const validateSignin: ValidatorMiddleware[] = [
  body("email").isEmail().withMessage("Email must be valid"),
  body("password").exists(),
  validateRequest,
];

export const validateUpdatePassword: ValidatorMiddleware[] = [
  body("oldPassword").exists().withMessage("Old password must be valid"),
  body("newPassword")
    .trim()
    .isLength({ min: 8, max: 32 })
    .withMessage("Password must be between 8 and 32 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/\d/)
    .withMessage("Password must contain at least one digit")
    .matches(/[\W_]/)
    .withMessage("Password must contain at least one special character"),
  body("confirmNewPassword")
    .trim()
    .isLength({ min: 8, max: 32 })
    .withMessage("Password must be between 8 and 32 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/\d/)
    .withMessage("Password must contain at least one digit")
    .matches(/[\W_]/)
    .withMessage("Password must contain at least one special character"),
  validateRequest,
];

export const validateAddPassword: ValidatorMiddleware[] = [
  body("newPassword")
    .trim()
    .isLength({ min: 8, max: 32 })
    .withMessage("Password must be between 8 and 32 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/\d/)
    .withMessage("Password must contain at least one digit")
    .matches(/[\W_]/)
    .withMessage("Password must contain at least one special character"),
  body("confirmNewPassword")
    .trim()
    .isLength({ min: 8, max: 32 })
    .withMessage("Password must be between 8 and 32 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/\d/)
    .withMessage("Password must contain at least one digit")
    .matches(/[\W_]/)
    .withMessage("Password must contain at least one special character"),
  validateRequest,
];

export const validateUpdateAccount: ValidatorMiddleware[] = [
  body("name").exists().withMessage("Name must be valid"),
  validateRequest,
];

export const validateActivateAccount: ValidatorMiddleware[] = [
  body("code").exists().withMessage("Provide a code"),

  validateRequest,
];

export const validateTwoFactor: ValidatorMiddleware[] = [
  body("code").exists().withMessage("Provide a code"),
  body("id").exists().withMessage("Provide a id"),

  validateRequest,
];

export const validateOauth: ValidatorMiddleware[] = [
  body("code").exists().withMessage("Provide a code"),

  validateRequest,
];

export const validateGeneratePasswordCode: ValidatorMiddleware[] = [
  body("email").isEmail().withMessage("Email must be valid"),

  validateRequest,
];

export const validateResetPassword: ValidatorMiddleware[] = [
  body("code").exists().withMessage("Provide a code"),
  body("password")
    .trim()
    .isLength({ min: 8, max: 32 })
    .withMessage("Password must be between 8 and 32 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/\d/)
    .withMessage("Password must contain at least one digit")
    .matches(/[\W_]/)
    .withMessage("Password must contain at least one special character"),
  validateRequest,
];
