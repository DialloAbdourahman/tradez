import { app } from "../../../app";
import request from "supertest";
import { CODES } from "../../../enums/codes";
import { createUser } from "../../../test/helpers/auth-helper";
import { prisma } from "../../../prisma";
import { UserType } from "@prisma/client";

it("Should not login user if all information is not entered", async () => {
  const email = "test@test.com";
  const password = "test1234";

  const response = await request(app)
    .post("/api/auth/v1/signin")
    .send({ email });
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.VALIDATION_REQUEST_ERROR);

  const response2 = await request(app)
    .post("/api/auth/v1/signin")
    .send({ password });
  expect(response2.status).toEqual(400);
  expect(response2.body.code).toBe(CODES.VALIDATION_REQUEST_ERROR);

  const response3 = await request(app).post("/api/auth/v1/signin").send({});
  expect(response3.status).toEqual(400);
  expect(response3.body.code).toBe(CODES.VALIDATION_REQUEST_ERROR);
});

it("Should not login user whose account has not been activated", async () => {
  const { createdUser, planTextPassword } = await createUser({
    isActive: false,
  });

  const response = await request(app)
    .post("/api/auth/v1/signin")
    .send({ email: createdUser.email, password: planTextPassword });
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.ACCOUNT_NOT_ACTIVATED);
});

it("Should not login user whose account has been deleted", async () => {
  const { createdUser, planTextPassword } = await createUser({
    isDeleted: true,
  });

  const response = await request(app)
    .post("/api/auth/v1/signin")
    .send({ email: createdUser.email, password: planTextPassword });
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.ACCOUNT_DELETED);
});

it("Should not login user with fake email", async () => {
  const response = await request(app)
    .post("/api/auth/v1/signin")
    .send({ email: "asdf@asd.com", password: "testasdfadsf" });
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.UNABLE_TO_LOGIN);
});

it("Should not login user with wrong password", async () => {
  const { createdUser } = await createUser();

  const response = await request(app)
    .post("/api/auth/v1/signin")
    .send({ email: createdUser.email, password: "asdfasdfasdfd" });
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.UNABLE_TO_LOGIN);
});

it("Should not allow a passwordless user to signin using this route", async () => {
  const { createdUser } = await createUser({ noPassword: true });

  const response = await request(app)
    .post("/api/auth/v1/signin")
    .send({ email: createdUser.email, password: "asdfasdfasdfd" });
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.NO_PASSWORD_TO_ACCOUNT);
});

it("Should login a non super user and return the tokens", async () => {
  const { createdUser, planTextPassword } = await createUser();

  const response = await request(app)
    .post("/api/auth/v1/signin")
    .send({ email: createdUser.email, password: planTextPassword });
  expect(response.status).toEqual(200);
  expect(response.body.code).toBe(CODES.SUCCESS);
  expect(response.body.data.id).toBe(createdUser.id);
  expect(response.body.data.name).toBe(createdUser.name);
  expect(response.body.data.email).toBe(createdUser.email);
  expect(response.body.data.type).toBe(createdUser.type);
  expect(response.body.data.accessToken).toBeDefined();
  expect(response.body.data.refreshToken).toBeDefined();

  const user = await prisma.user.findUnique({ where: { id: createdUser.id } });
  expect(user?.token).not.toBe(null);
});

it("Should return a QR code if a super user logs in an his two factor is not enabled", async () => {
  const { createdUser, planTextPassword } = await createUser({
    type: UserType.Admin,
  });

  const response = await request(app)
    .post("/api/auth/v1/signin")
    .send({ email: createdUser.email, password: planTextPassword });
  expect(response.status).toEqual(200);
  expect(response.body.code).toBe(CODES.SUCCESS);
  expect(response.body.data.accessToken).not.toBeDefined();
  expect(response.body.data.refreshToken).not.toBeDefined();
  expect(response.body.data.twoFAEnabled).toBe(false);
  expect(response.body.data.qrCode).toBeDefined();
});

it("Should not return a QR code if a super user logs in an his two factor is enabled", async () => {
  const { createdUser, planTextPassword } = await createUser({
    type: UserType.Admin,
    twoFAEnabled: true,
  });

  const response = await request(app)
    .post("/api/auth/v1/signin")
    .send({ email: createdUser.email, password: planTextPassword });
  expect(response.status).toEqual(200);
  expect(response.body.code).toBe(CODES.SUCCESS);
  expect(response.body.data.accessToken).not.toBeDefined();
  expect(response.body.data.refreshToken).not.toBeDefined();
  expect(response.body.data.twoFAEnabled).toBe(true);
  expect(response.body.data.qrCode).not.toBeDefined();
});
