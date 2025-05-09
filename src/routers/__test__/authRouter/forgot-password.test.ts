import { app } from "../../../app";
import request from "supertest";
import { CODES } from "../../../enums/codes";
import { UserType } from "@prisma/client";
import { createUser, loginUser } from "../../../test/helpers/auth-helper";
import { prisma } from "../../../prisma";

it("Should not generate code if account has not been activated", async () => {
  const { user: createdUser } = await loginUser({
    type: UserType.Client,
    isActive: false,
  });

  const response = await request(app)
    .post("/api/auth/v1/forgot-password")
    .send({
      email: createdUser.email,
    });
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.ACCOUNT_NOT_ACTIVATED);
});

it("Should not generate code if account has been deleted", async () => {
  const { user: createdUser } = await loginUser({
    type: UserType.Client,
    isDeleted: true,
  });

  const response = await request(app)
    .post("/api/auth/v1/forgot-password")
    .send({
      email: createdUser.email,
    });
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.ACCOUNT_DELETED);
});

it("Should not get the profile of a user that doesn't exist", async () => {
  const response = await request(app)
    .post("/api/auth/v1/forgot-password")
    .send({
      email: "asdfasfd@dsfas.com",
    });
  expect(response.status).toEqual(404);
  expect(response.body.code).toBe(CODES.NOT_FOUND);
});

it("Should generate a code for a forgot password request", async () => {
  const { user: createdUser } = await loginUser();

  const response = await request(app)
    .post("/api/auth/v1/forgot-password")
    .send({
      email: createdUser.email,
    });

  expect(response.status).toEqual(200);
  expect(response.body.code).toBe(CODES.SUCCESS);

  const user = await prisma.user.findUnique({
    where: {
      id: createdUser.id,
    },
  });
  expect(user?.forgotPasswordToken).not.toBeNull();
});
