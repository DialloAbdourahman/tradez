import { Request, Response } from "express";
import { CODES } from "../enums/codes";
import { prisma } from "../prisma";
import { OrchestrationResult } from "../utils/orchestration-result";
import { PasswordManager } from "../utils/password";
import { UserType } from "@prisma/client";
import { AwsSesHelper } from "../utils/aws-ses";
import { JWTCodes } from "../utils/jwt-codes";
import { generateTokens } from "../utils/generate-tokens";
import qrCode from "qrcode";
import { authenticator } from "otplib";
import jwt from "jsonwebtoken";
import { getUserFromGoogle } from "../utils/get-user-from-google";

const securedUsers: {
  max: number;
  userType: UserType;
  twoFa: boolean;
}[] = [
  {
    max: Number(process.env.TOTAL_ADMINS_IN_SYSTEM),
    userType: UserType.Admin,
    twoFa: true,
  },
];

export type UserReturned = {
  id: string;
  name: string;
  email: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
  qrCode?: string;
  twoFAEnabled?: boolean;
  accessToken?: string;
  refreshToken?: string;
};

const superUserSeeUserInfo = {
  id: true,
  name: true,
  email: true,
  type: true,
  createdAt: true,
  updatedAt: true,
  isActive: true,
  isDeleted: true,
  creator: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

const signUp = async (req: Request, res: Response) => {
  let { email, password, name } = req.body;

  const existingUser = await prisma.user.findFirst({
    where: {
      email,
    },
  });

  if (existingUser) {
    if (existingUser.isDeleted) {
      OrchestrationResult.badRequest(
        res,
        CODES.ACCOUNT_DELETED,
        "Account has been deleted, contact support team."
      );
      return;
    }

    if (existingUser.isActive) {
      OrchestrationResult.badRequest(
        res,
        CODES.EMAIL_IN_USE,
        "Email exist already in user"
      );
      return;
    } else {
      OrchestrationResult.badRequest(
        res,
        CODES.ACCOUNT_NOT_ACTIVATED,
        "Account exist already but has not been activated, check email."
      );
      return;
    }
  }

  password = await PasswordManager.toHash(password);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password,
      type: UserType.Client,
    },
  });

  const { code } = JWTCodes.generate(
    { id: user.id, email: user.email },
    process.env.ACTIVATE_ACCOUNT_JWT_KEY as string
  );

  const awsHelper = new AwsSesHelper();
  await awsHelper.sendActivateAccountEmail(
    user.email,
    user.name || "user",
    code
  );

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      activateAccountToken: code,
    },
  });

  OrchestrationResult.success(res, 201);
};

const activateMyAccount = async (req: Request, res: Response) => {
  const { code } = req.body;

  const { id } = JWTCodes.decode(
    code,
    process.env.ACTIVATE_ACCOUNT_JWT_KEY as string
  );

  const user = await prisma.user.findFirst({
    where: {
      id,
    },
  });

  if (user?.activateAccountToken !== code) {
    OrchestrationResult.badRequest(
      res,
      CODES.TOKEN_DOES_NOT_MATCH,
      "Token does not match"
    );
    return;
  }

  if (!user) {
    OrchestrationResult.notFound(res, CODES.NOT_FOUND, "Account not found");
    return;
  }

  if (user.isActive) {
    OrchestrationResult.success(res);
    return;
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      isActive: true,
      activateAccountToken: null,
    },
  });

  OrchestrationResult.success(res);
};

const signin = async (req: Request, res: Response) => {
  let { email, password } = req.body;

  const user = await prisma.user.findFirst({
    where: {
      email,
    },
  });

  if (!user) {
    OrchestrationResult.badRequest(
      res,
      CODES.UNABLE_TO_LOGIN,
      "Unable to login"
    );
    return;
  }

  if (!user?.isActive) {
    OrchestrationResult.badRequest(
      res,
      CODES.ACCOUNT_NOT_ACTIVATED,
      "Activate your account"
    );
    return;
  }

  if (user?.isDeleted) {
    OrchestrationResult.badRequest(
      res,
      CODES.ACCOUNT_DELETED,
      "Your account has been deleted, contact support."
    );
    return;
  }

  if (!user.password) {
    OrchestrationResult.badRequest(
      res,
      CODES.NO_PASSWORD_TO_ACCOUNT,
      "Your account doesn't have a password. Use Google to login or click on forgot password to associate a password to your account."
    );
    return;
  }

  const match = await PasswordManager.compare(user.password, password);

  if (!match) {
    OrchestrationResult.badRequest(
      res,
      CODES.UNABLE_TO_LOGIN,
      "Unable to login"
    );
    return;
  }

  if (
    securedUsers.find(
      (securedUserType) =>
        securedUserType.userType === user.type && securedUserType.twoFa === true
    )
  ) {
    if (user.twoFAEnabled) {
      const data: UserReturned = {
        id: user.id,
        name: user.name || "",
        email: user.email,
        type: user.type,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        twoFAEnabled: user.twoFAEnabled,
      };

      OrchestrationResult.item(res, data, 200);
      return;
    } else {
      const uri = authenticator.keyuri(
        user.id,
        "Tradez",
        user.twoFATempSecret as string
      );
      const imageCode = await qrCode.toDataURL(uri);

      const data: UserReturned = {
        id: user.id,
        name: user.name || "",
        email: user.email,
        type: user.type,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        twoFAEnabled: user.twoFAEnabled,
        qrCode: imageCode,
      };

      OrchestrationResult.item(res, data, 200);
      return;
    }
  }

  const { accessToken, refreshToken } = generateTokens({
    id: user.id,
    email: user.email,
    type: user.type,
  });

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      token: refreshToken,
    },
  });

  const data: UserReturned = {
    id: user.id,
    name: user.name || "",
    email: user.email,
    type: user.type,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    accessToken,
    refreshToken,
  };

  OrchestrationResult.item(res, data, 200);
};

const createsSecuredSuperUser = async (req: Request, res: Response) => {
  let { email, password, name, type } = req.body;

  const securedUser = securedUsers.find((item) => item.userType === type);

  if (!securedUser) {
    OrchestrationResult.badRequest(
      res,
      CODES.NOT_ALLOWED_USER_TYPE,
      "Cannot create account for this user type"
    );
    return;
  }

  let max: number = securedUser.max;

  const userTypeMaxCount = await prisma.user.count({
    where: {
      type: type as UserType,
      isDeleted: false,
    },
  });

  if (userTypeMaxCount + 1 > max) {
    OrchestrationResult.badRequest(
      res,
      CODES.MAX_USERS_IN_SYSTEM,
      `Maximum number of ${type} in the system is ${max}`
    );
    return;
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      email,
    },
  });

  if (existingUser) {
    if (existingUser.isDeleted) {
      OrchestrationResult.badRequest(
        res,
        CODES.ACCOUNT_DELETED,
        "Account has been deleted, contact support team."
      );
      return;
    }

    if (existingUser.isActive) {
      OrchestrationResult.badRequest(
        res,
        CODES.EMAIL_IN_USE,
        "Email exist already in user"
      );
      return;
    } else {
      OrchestrationResult.badRequest(
        res,
        CODES.ACCOUNT_NOT_ACTIVATED,
        "Account exist already but has not been activated, check email."
      );
      return;
    }
  }

  password = await PasswordManager.toHash(password);

  const twoFATempSecret = securedUser.twoFa
    ? authenticator.generateSecret()
    : null;

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password,
      type: type,
      creatorId: req.currentUser?.id,
      twoFATempSecret,
    },
    select: superUserSeeUserInfo,
  });

  const { code } = JWTCodes.generate(
    { id: user.id, email: user.email },
    process.env.ACTIVATE_ACCOUNT_JWT_KEY as string
  );

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      activateAccountToken: code,
    },
  });

  const awsHelper = new AwsSesHelper();
  await awsHelper.sendActivateAccountEmail(
    user.email,
    user.name || "user",
    code
  );

  OrchestrationResult.item(res, user, 201);
};

const setTwoFA = async (req: Request, res: Response) => {
  let { code, id } = req.body;

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    OrchestrationResult.badRequest(
      res,
      CODES.UNABLE_TO_LOGIN,
      "Unable to login"
    );
    return;
  }

  if (!user?.isActive) {
    OrchestrationResult.badRequest(
      res,
      CODES.ACCOUNT_NOT_ACTIVATED,
      "Activate your account"
    );
    return;
  }

  if (user?.isDeleted) {
    OrchestrationResult.badRequest(
      res,
      CODES.ACCOUNT_DELETED,
      "Your account has been deleted, contact support."
    );
    return;
  }

  if (!user.password) {
    OrchestrationResult.badRequest(
      res,
      CODES.NO_PASSWORD_TO_ACCOUNT,
      "Your account doesn't have a password. Use Google to login or click on forgot password to associate a password to your account."
    );
    return;
  }

  if (user?.twoFAEnabled) {
    OrchestrationResult.badRequest(
      res,
      CODES.TWO_FACTOR_ENABLED_ALREADY,
      "Cannot use this route as two factor is enabled already."
    );
    return;
  }

  const tempSecret = user?.twoFATempSecret;

  const verified = authenticator.check(code, tempSecret as string);

  if (!verified) {
    OrchestrationResult.badRequest(
      res,
      CODES.WRONG_CODE_OR_EXPIRED_CODE,
      "Wrong code or expired code."
    );
    return;
  }

  await prisma.user.update({
    where: { id },
    data: {
      twoFAEnabled: true,
      twoFASecret: tempSecret,
    },
  });

  const { accessToken, refreshToken } = generateTokens({
    id: user.id,
    email: user.email,
    type: user.type,
  });

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      token: refreshToken,
    },
  });

  const data: UserReturned = {
    id: user.id,
    name: user.name || "",
    email: user.email,
    type: user.type,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    accessToken,
    refreshToken,
  };

  OrchestrationResult.item(res, data, 200);
};

const verifyTwoFA = async (req: Request, res: Response) => {
  let { code, id } = req.body;

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    OrchestrationResult.badRequest(
      res,
      CODES.UNABLE_TO_LOGIN,
      "Unable to login"
    );
    return;
  }

  if (!user?.isActive) {
    OrchestrationResult.badRequest(
      res,
      CODES.ACCOUNT_NOT_ACTIVATED,
      "Activate your account"
    );
    return;
  }

  if (user?.isDeleted) {
    OrchestrationResult.badRequest(
      res,
      CODES.ACCOUNT_DELETED,
      "Your account has been deleted, contact support."
    );
    return;
  }

  if (!user.password) {
    OrchestrationResult.badRequest(
      res,
      CODES.NO_PASSWORD_TO_ACCOUNT,
      "Your account doesn't have a password. Use Google to login or click on forgot password to associate a password to your account."
    );
    return;
  }

  if (!user?.twoFAEnabled) {
    OrchestrationResult.badRequest(
      res,
      CODES.TWO_FACTOR_NOT_YET_ENABLED,
      "Cannot use this route as two factor is not yet already."
    );
    return;
  }

  const secret = user?.twoFASecret;

  const verified = authenticator.check(code, secret as string);

  if (!verified) {
    OrchestrationResult.badRequest(
      res,
      CODES.WRONG_CODE_OR_EXPIRED_CODE,
      "Wrong code or expired code."
    );
    return;
  }

  const { accessToken, refreshToken } = generateTokens({
    id: user.id,
    email: user.email,
    type: user.type,
  });

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      token: refreshToken,
    },
  });

  const data: UserReturned = {
    id: user.id,
    name: user.name || "",
    email: user.email,
    type: user.type,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    accessToken,
    refreshToken,
  };

  OrchestrationResult.item(res, data, 200);
};

const logout = async (req: Request, res: Response) => {
  await prisma.user.update({
    where: {
      id: req.currentUser!.id,
    },
    data: {
      token: null,
    },
  });

  OrchestrationResult.success(res);
};

const getProfile = async (req: Request, res: Response) => {
  const data: UserReturned = {
    id: req.currentUser!.id,
    name: req.currentUser!.name || "",
    email: req.currentUser!.email,
    type: req.currentUser!.type,
    createdAt: req.currentUser!.createdAt,
    updatedAt: req.currentUser!.updatedAt,
  };

  OrchestrationResult.item(res, data, 200);
};

const refreshToken = async (req: Request, res: Response) => {
  const refresh = req.header("Authorization")?.replace("Bearer ", "");

  if (!refresh) {
    OrchestrationResult.unAuthorized(
      res,
      CODES.NO_REFRESH_TOKEN,
      "No refresh token"
    );
    return;
  }

  const foundUser = await prisma.user.findFirst({
    where: {
      token: refresh,
    },
  });

  if (!foundUser) {
    try {
      const decoded: any = jwt.verify(
        refresh,
        process.env.REFRESH_TOKEN_JWT_KEY as string
      );
      console.log("Reuse detection mechanism");

      const hackedUser = await prisma.user.findUnique({
        where: {
          id: decoded.id,
        },
      });

      if (hackedUser) {
        await prisma.user.update({
          where: { id: decoded.id },
          data: {
            token: null,
          },
        });
      }

      OrchestrationResult.unAuthorized(
        res,
        CODES.REUSE_DETECTION,
        "Reuse detection"
      );
      return;
    } catch (error: any) {
      OrchestrationResult.unAuthorized(
        res,
        CODES.CANNOT_DECODE_TOKEN,
        "Cannot decode refresh token"
      );
      return;
    }
  }

  try {
    const decoded: any = jwt.verify(
      refresh,
      process.env.REFRESH_TOKEN_JWT_KEY as string
    );

    if (decoded?.id !== foundUser.id) {
      OrchestrationResult.unAuthorized(
        res,
        CODES.UNAUTHORIZED,
        "Not authorized"
      );
    }

    if (!foundUser?.isActive) {
      OrchestrationResult.unAuthorized(
        res,
        CODES.ACCOUNT_NOT_ACTIVATED,
        "Activate your account"
      );
      return;
    }

    if (foundUser?.isDeleted) {
      OrchestrationResult.unAuthorized(
        res,
        CODES.ACCOUNT_DELETED,
        "Your account has been deleted, contact support."
      );
      return;
    }

    const { accessToken, refreshToken } = generateTokens(foundUser);
    await prisma.user.update({
      where: {
        id: foundUser.id,
      },
      data: {
        token: refreshToken,
      },
    });

    const data: UserReturned = {
      id: foundUser.id,
      name: foundUser.name || "",
      email: foundUser.email,
      type: foundUser.type,
      createdAt: foundUser.createdAt,
      updatedAt: foundUser.updatedAt,

      accessToken,
      refreshToken,
    };
    OrchestrationResult.item(res, data, 200);
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      OrchestrationResult.unAuthorized(
        res,
        CODES.REFRESH_TOKEN_EXPIRED,
        "Refresh token has expired, login again."
      );
      return;
    }

    OrchestrationResult.unAuthorized(
      res,
      CODES.CANNOT_DECODE_TOKEN,
      "Cannot decode refresh token"
    );
    return;
  }
};

const hasPassword = async (req: Request, res: Response) => {
  const data = {
    hasPassword: !!req.currentUser!.password,
  };

  OrchestrationResult.item(res, data, 200);
};

const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    OrchestrationResult.notFound(res, CODES.NOT_FOUND, "User not found");
    return;
  }

  if (!user?.isActive) {
    OrchestrationResult.badRequest(
      res,
      CODES.ACCOUNT_NOT_ACTIVATED,
      "Activate your account"
    );
    return;
  }

  if (user?.isDeleted) {
    OrchestrationResult.badRequest(
      res,
      CODES.ACCOUNT_DELETED,
      "Your account has been deleted, contact support."
    );
    return;
  }

  const { code } = JWTCodes.generate(
    { id: user.id, email: user.email },
    process.env.FORGOT_PASSWORD_JWT_KEY as string
  );

  const awsHelper = new AwsSesHelper();
  await awsHelper.sendResetPasswordEmail(user.email, user.name || "user", code);

  await prisma.user.update({
    where: {
      email,
    },
    data: {
      forgotPasswordToken: code,
    },
  });

  OrchestrationResult.success(res);
};

const resetPassword = async (req: Request, res: Response) => {
  let { code, password } = req.body;

  const { id } = JWTCodes.decode(
    code,
    process.env.FORGOT_PASSWORD_JWT_KEY as string
  );

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    OrchestrationResult.notFound(res, CODES.NOT_FOUND, "User not found");
    return;
  }

  if (!user?.isActive) {
    OrchestrationResult.badRequest(
      res,
      CODES.ACCOUNT_NOT_ACTIVATED,
      "Activate your account"
    );
    return;
  }

  if (user?.isDeleted) {
    OrchestrationResult.badRequest(
      res,
      CODES.ACCOUNT_DELETED,
      "Your account has been deleted, contact support."
    );
    return;
  }

  if (user?.forgotPasswordToken !== code) {
    OrchestrationResult.badRequest(
      res,
      CODES.TOKEN_DOES_NOT_MATCH,
      "Token does not match"
    );
    return;
  }

  password = await PasswordManager.toHash(password);

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      password,
      forgotPasswordToken: null,
    },
  });

  OrchestrationResult.success(res);
};

const updatePassword = async (req: Request, res: Response) => {
  let { oldPassword, newPassword, confirmNewPassword } = req.body;

  if (!req.currentUser!.password) {
    OrchestrationResult.badRequest(
      res,
      CODES.NO_PASSWORD_TO_ACCOUNT,
      "Your account doesn't have a password, use add-password route."
    );
    return;
  }

  const match = await PasswordManager.compare(
    req.currentUser!.password,
    oldPassword
  );
  if (!match) {
    OrchestrationResult.badRequest(
      res,
      CODES.NEW_PASSWORD_DOES_NOT_MATCH_OLD_PASSWORD,
      "The password provided should match the old password"
    );
    return;
  }

  if (newPassword !== confirmNewPassword) {
    OrchestrationResult.badRequest(
      res,
      CODES.PASSWORDS_MUST_BE_THE_SAME,
      "NewPassword and ConfirmNewPassword should be the same"
    );
    return;
  }

  const password = await PasswordManager.toHash(newPassword);

  await prisma.user.update({
    where: {
      id: req.currentUser!.id,
    },
    data: {
      password,
    },
  });

  OrchestrationResult.success(res);
};

const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    OrchestrationResult.badRequest(
      res,
      CODES.VALIDATION_REQUEST_ERROR,
      "Provide an ID"
    );
    return;
  }

  if (id === req.currentUser?.id) {
    OrchestrationResult.badRequest(
      res,
      CODES.CANNOT_DELETE_YOURSELF,
      "Cannot delete yourself"
    );
    return;
  }

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    OrchestrationResult.notFound(res, CODES.NOT_FOUND, "User not found");
    return;
  }

  const deletedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      isDeleted: true,
      token: null,
    },
    select: superUserSeeUserInfo,
  });

  OrchestrationResult.item(res, deletedUser);
};

const restoreUser = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    OrchestrationResult.badRequest(
      res,
      CODES.VALIDATION_REQUEST_ERROR,
      "Provide an ID"
    );
    return;
  }

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    OrchestrationResult.notFound(res, CODES.NOT_FOUND, "User not found");
    return;
  }

  const securedUser = securedUsers.find(
    (securedUser) => securedUser.userType === user.type
  );

  if (securedUser) {
    const type = securedUser.userType;
    let max = securedUser.max;

    const userTypeMaxCount = await prisma.user.count({
      where: {
        type: type,
        isDeleted: false,
      },
    });

    if (userTypeMaxCount + 1 > max) {
      OrchestrationResult.badRequest(
        res,
        CODES.MAX_USERS_IN_SYSTEM,
        `Maximum number of ${type} in the system is ${max}`
      );
      return;
    }
  }

  const restoredUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      isDeleted: false,
    },
    select: superUserSeeUserInfo,
  });

  OrchestrationResult.item(res, restoredUser);
};

const deactivateAccount = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    OrchestrationResult.badRequest(
      res,
      CODES.VALIDATION_REQUEST_ERROR,
      "Provide an ID"
    );
    return;
  }

  if (id === req.currentUser?.id) {
    OrchestrationResult.badRequest(
      res,
      CODES.CANNOT_DEACTIVATE_YOURSELF,
      "Cannot deactivate yourself"
    );
    return;
  }

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    OrchestrationResult.notFound(res, CODES.NOT_FOUND, "User not found");
    return;
  }

  const deactivatedAccount = await prisma.user.update({
    where: { id: user.id },
    data: {
      isActive: false,
      token: null,
    },
    select: superUserSeeUserInfo,
  });

  OrchestrationResult.item(res, deactivatedAccount);
};

const activateAccount = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    OrchestrationResult.badRequest(
      res,
      CODES.VALIDATION_REQUEST_ERROR,
      "Provide an ID"
    );
    return;
  }

  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    OrchestrationResult.notFound(res, CODES.NOT_FOUND, "User not found");
    return;
  }

  const activatedAccount = await prisma.user.update({
    where: { id: user.id },
    data: {
      isActive: true,
    },
    select: superUserSeeUserInfo,
  });

  OrchestrationResult.item(res, activatedAccount);
};

const updateAccount = async (req: Request, res: Response) => {
  let { name } = req.body;

  const updateduser = await prisma.user.update({
    where: {
      id: req.currentUser!.id,
    },
    data: {
      name,
    },
    select: {
      id: true,
      name: true,
      email: true,
      type: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const data: UserReturned = {
    id: updateduser.id,
    name: updateduser.name || "",
    email: updateduser.email,
    createdAt: updateduser.createdAt,
    updatedAt: updateduser.updatedAt,
    type: updateduser.type,
  };

  OrchestrationResult.item(res, data);
};

const addPassword = async (req: Request, res: Response) => {
  let { newPassword, confirmNewPassword } = req.body;

  if (req.currentUser!.password) {
    OrchestrationResult.badRequest(
      res,
      CODES.PASSWORD_EXIST_ALREADY,
      "Password exists already."
    );
    return;
  }

  if (newPassword !== confirmNewPassword) {
    OrchestrationResult.badRequest(
      res,
      CODES.PASSWORDS_MUST_BE_THE_SAME,
      "NewPassword and ConfirmNewPassword should be the same"
    );
    return;
  }

  const password = await PasswordManager.toHash(newPassword);

  await prisma.user.update({
    where: {
      id: req.currentUser!.id,
    },
    data: {
      password,
    },
  });

  OrchestrationResult.success(res);
};

const oauthGoogle = async (req: Request, res: Response) => {
  let { code } = req.body;
  let googleUser;

  try {
    googleUser = await getUserFromGoogle(code);

    if (!googleUser || !googleUser.email || !googleUser.name) {
      OrchestrationResult.serverError(
        res,
        CODES.GOOGLE_AUTH_ERROR,
        "Failed to authenticate with Google"
      );
      return;
    }
  } catch (error) {
    console.error(error);
    OrchestrationResult.serverError(
      res,
      CODES.GOOGLE_AUTH_ERROR,
      "Failed to authenticate with Google"
    );
    return;
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: googleUser.email,
    },
  });

  let user;

  if (existingUser) {
    if (existingUser.type !== UserType.Client) {
      OrchestrationResult.badRequest(
        res,
        CODES.NON_SUPER_USERS_ONLY,
        "Super users are not allowed to use this route"
      );
      return;
    }

    if (!existingUser?.isActive) {
      OrchestrationResult.badRequest(
        res,
        CODES.ACCOUNT_NOT_ACTIVATED,
        "Activate your account"
      );
      return;
    }

    if (existingUser?.isDeleted) {
      OrchestrationResult.badRequest(
        res,
        CODES.ACCOUNT_DELETED,
        "Your account has been deleted, contact support."
      );
      return;
    }

    user = existingUser;
  } else {
    user = await prisma.user.create({
      data: {
        email: googleUser.email,
        name: googleUser.name,
        type: UserType.Client,
        isActive: true,
      },
    });
  }

  const { accessToken, refreshToken } = generateTokens({
    id: user.id,
    email: user.email,
    type: user.type,
  });

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      token: refreshToken,
    },
  });

  const data: UserReturned = {
    id: user.id,
    name: user.name || "",
    email: user.email,
    type: user.type,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    accessToken,
    refreshToken,
  };

  OrchestrationResult.item(res, data, 200);
};

const addUser = async (req: Request, res: Response) => {
  await prisma.user.create({
    data: {
      id: "02c630c6-7615-43a2-8d33-c3da79510e56",
      name: "Test",
      email: "Test@gmail.com",
      password:
        "6ce51af392adc882059eacd406b6f288093a8e4f44bb4a60c07e794dfb7ba378ed46a57f328eff630284e38c07ab52cc77701f8fb237f8530d016fa6bb008d77.9aa237ce7fedf074",
      type: UserType.Admin,
      token:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjAyYzYzMGM2LTc2MTUtNDNhMi04ZDMzLWMzZGE3OTUxMGU1NiIsImlhdCI6MTc0MDM5NzcyMiwiZXhwIjoxNzQxMDAyNTIyfQ.pYGC7vBJW224Syt3dd6O1S8HYvB1pKNciiHSpId_FY8",
      twoFATempSecret: "IZIA6BZAGIZHOT2I",
      twoFASecret: "IZIA6BZAGIZHOT2I",
      isActive: true,
    },
  });

  res.send(200);
};

// import Alpaca from "@alpacahq/alpaca-trade-api";

// // Alpaca() requires the API key and sectret to be set, even for crypto
// const alpaca = new Alpaca({
//   keyId: process.env.ALPACA_API_KEY,
//   secretKey: process.env.ALPACA_SECRET_KEY,
// });

// const testAlpaca = async (req: Request, res: Response) => {
//   let options = {
//     start: "2022-09-01",
//     end: "2022-09-07",
//     timeframe: alpaca.newTimeframe(1, alpaca.timeframeUnit.DAY),
//   };
//   const bars = await alpaca.getCryptoBars(["BTC/USD", "EUR/USD"], options);

//   console.log("bars", bars);

//   res.json(bars.get("BTC/USD"));
// };

export default {
  signUp,
  activateAccount,
  signin,
  setTwoFA,
  verifyTwoFA,
  createsSecuredSuperUser,
  logout,
  getProfile,
  addUser,
  refreshToken,
  hasPassword,
  forgotPassword,
  resetPassword,
  updatePassword,
  deleteUser,
  restoreUser,
  deactivateAccount,
  activateMyAccount,
  updateAccount,
  addPassword,
  oauthGoogle,
};

// I will first use an admin to create another admin and set his temp secret with this : const secret = authenticator.generateSecret();

// It will send an email to the admin to ask him to activate his account.

// When the admin tries to login with his activated account:

/*

  if(admin logs in){

    if(twoFA is disabled) {
      Send the admin a qr code, his user info (basic) and the enabled property. 
      const uri = authenticator.keyuri(admin.id, "Tradez", secret);
      const image = await qrCode.toDataURL(uri);

      On the front end scan it, get the code and enter the code and submit it to the setTwoFa route
      
      Finally, generate the tokens and send him
    }else {
      His user info (basic) and the enabled property. 
      On the front end enter the code and submit it to the verifyTwoFa route

      Finally, generate the tokens and send to the user
    }
  
  }else{
    Generate tokens and send to the user. 
  }

*/
