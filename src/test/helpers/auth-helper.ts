import { UserType } from "@prisma/client";
import { prisma } from "../../prisma";
import { JWTCodes } from "../../utils/jwt-codes";
import { generateTokens } from "../../utils/generate-tokens";

function generateRandomString(length = 10) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

type SimpeDataInputType = {
  isActive?: boolean;
  isDeleted?: boolean;
  noPassword?: boolean;
  testEmail?: string;
  type?: UserType;
  twoFAEnabled?: boolean;
  twoFATempSecret?: string | null;
  twoFASecret?: string | null;
};

export const createUser = async (data: SimpeDataInputType = {}) => {
  // Define default values
  const defaults: Required<SimpeDataInputType> = {
    isActive: true,
    isDeleted: false,
    noPassword: false,
    testEmail: "",
    type: UserType.Client,
    twoFAEnabled: false,
    twoFASecret: null,
    twoFATempSecret: null,
  };

  // Merge defaults with provided data
  const mergedData = { ...defaults, ...data };

  const id = `sdfasdfsadf${generateRandomString()}asdfd`;
  const email = mergedData.testEmail
    ? mergedData.testEmail
    : `test${generateRandomString()}@test.com`;
  const password =
    "6452412dff969174dac6450cba84832998a5e130d35ed2cbd825aaea6d22f93af2eebfa930254b32e227491c38259d247f0ea44080c6c435de81044e82d7451c.af8e5695768a797d";
  const name = "test";
  const planTextPassword = "Test1234@gmail.com";

  const { code: activateAccountToken } = JWTCodes.generate(
    { id, email },
    process.env.ACTIVATE_ACCOUNT_JWT_KEY as string
  );

  const createdUser = await prisma.user.create({
    data: {
      id,
      email,
      password: mergedData.noPassword ? null : password,
      name,
      type: mergedData.type,
      isActive: mergedData.isActive,
      isDeleted: mergedData.isDeleted,
      activateAccountToken,
      twoFAEnabled: mergedData.twoFAEnabled,
      twoFASecret: mergedData.twoFASecret,
      twoFATempSecret: mergedData.twoFATempSecret,
    },
  });

  return { createdUser, planTextPassword, password, activateAccountToken };
};

export const loginUser = async (data: SimpeDataInputType = {}) => {
  // Define default values
  const defaults: Required<SimpeDataInputType> = {
    isActive: true,
    isDeleted: false,
    noPassword: false,
    testEmail: "",
    type: UserType.Client,
    twoFAEnabled: false,
    twoFASecret: null,
    twoFATempSecret: null,
  };

  // Merge defaults with provided data
  const mergedData = { ...defaults, ...data };

  const id = `sdfasdfsadf${generateRandomString()}asdfd`;
  const email = mergedData.testEmail
    ? mergedData.testEmail
    : `test${generateRandomString()}@test.com`;
  const password =
    "6452412dff969174dac6450cba84832998a5e130d35ed2cbd825aaea6d22f93af2eebfa930254b32e227491c38259d247f0ea44080c6c435de81044e82d7451c.af8e5695768a797d";
  const name = "test";
  const planTextPassword = "Test1234@gmail.com";

  const { code: activateAccountToken } = JWTCodes.generate(
    { id, email },
    process.env.ACTIVATE_ACCOUNT_JWT_KEY as string
  );

  const createdUser = await prisma.user.create({
    data: {
      id,
      email,
      password: mergedData.noPassword ? null : password,
      name,
      type: mergedData.type,
      isActive: mergedData.isActive,
      isDeleted: mergedData.isDeleted,
      activateAccountToken,
      twoFAEnabled: mergedData.twoFAEnabled,
      twoFASecret: mergedData.twoFASecret,
      twoFATempSecret: mergedData.twoFATempSecret,
    },
  });

  let { accessToken, refreshToken } = generateTokens({
    id: createdUser.id,
    email: createdUser.email,
    type: createdUser.type,
  });

  const user = await prisma.user.update({
    where: {
      id: createdUser.id,
    },
    data: {
      token: refreshToken,
    },
  });

  return {
    planTextPassword,
    password,
    activateAccountToken,
    user,
    accessToken,
    refreshToken,
  };
};
