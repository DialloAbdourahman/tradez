import { app } from "../../../app";
import request from "supertest";
import { CODES } from "../../../enums/codes";
import { prisma } from "../../../prisma";
import { JWTCodes } from "../../../utils/jwt-codes";
import { createUser } from "../../../test/helpers/auth-helper";

it("Should not reset password if data is not provided.", async () => {
  const response = await request(app)
    .patch("/api/auth/v1/reset-password")
    .send();
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.VALIDATION_REQUEST_ERROR);

  const response2 = await request(app)
    .patch("/api/auth/v1/reset-password")
    .send({ code: "asdf" });
  expect(response2.status).toEqual(400);
  expect(response2.body.code).toBe(CODES.VALIDATION_REQUEST_ERROR);

  const response3 = await request(app)
    .patch("/api/auth/v1/reset-password")
    .send({ password: "Test1234@gmail.com" });
  expect(response3.status).toEqual(400);
  expect(response3.body.code).toBe(CODES.VALIDATION_REQUEST_ERROR);

  const response4 = await request(app)
    .patch("/api/auth/v1/reset-password")
    .send({ code: "asdf", password: "Tegmail.com" });
  expect(response4.status).toEqual(400);
  expect(response4.body.code).toBe(CODES.VALIDATION_REQUEST_ERROR);
});

it("Should not reset password of user whose account has not been activated", async () => {
  const { createdUser } = await createUser({
    isActive: false,
  });

  const { code } = JWTCodes.generate(
    { id: createdUser.id, email: createdUser.email },
    process.env.FORGOT_PASSWORD_JWT_KEY as string
  );

  const newPassword = "Test1234@gmail.com";

  const response = await request(app)
    .patch("/api/auth/v1/reset-password")
    .send({ code, password: newPassword });
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.ACCOUNT_NOT_ACTIVATED);
});

it("Should not reset password of a user whose account has been deleted", async () => {
  const { createdUser } = await createUser({
    isDeleted: true,
  });

  const { code } = JWTCodes.generate(
    { id: createdUser.id, email: createdUser.email },
    process.env.FORGOT_PASSWORD_JWT_KEY as string
  );

  const newPassword = "Test1234@gmail.com";

  const response = await request(app)
    .patch("/api/auth/v1/reset-password")
    .send({ code, password: newPassword });
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.ACCOUNT_DELETED);
});

it("Should reset the password all correct data is provided and make sure that the code is delete after use", async () => {
  const { createdUser, password } = await createUser();

  const { code } = JWTCodes.generate(
    { id: createdUser.id, email: createdUser.email },
    process.env.FORGOT_PASSWORD_JWT_KEY as string
  );

  await prisma.user.update({
    where: {
      id: createdUser.id,
    },
    data: {
      forgotPasswordToken: code,
    },
  });

  const newPassword = "Test12345@gmail.com";

  const response = await request(app)
    .patch("/api/auth/v1/reset-password")
    .send({ code, password: newPassword });

  console.log("yoooooooo", response.body);

  expect(response.status).toEqual(200);
  expect(response.body.code).toBe(CODES.SUCCESS);

  const resetedPasswordUser = await prisma.user.findUnique({
    where: {
      id: createdUser.id,
    },
  });
  expect(resetedPasswordUser?.password).not.toBe(password);
  expect(resetedPasswordUser?.forgotPasswordToken).toBe(null);
});
