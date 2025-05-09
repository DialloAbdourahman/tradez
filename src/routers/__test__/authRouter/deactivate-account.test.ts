import { app } from "../../../app";
import request from "supertest";
import { CODES } from "../../../enums/codes";
import { prisma } from "../../../prisma";
import { UserType } from "@prisma/client";
import { loginUser } from "../../../test/helpers/auth-helper";

it("Should not allow a user to deactivate another user's account if he is unauthenticated", async () => {
  const { user: createdUser } = await loginUser({
    type: UserType.Client,
  });

  const response = await request(app)
    .post(`/api/auth/v1/deactivate-account/${createdUser.id}`)
    .send();

  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.NO_ACCESS_TOKEN);

  const deactivatedUser = await prisma.user.findUnique({
    where: { id: createdUser.id },
  });
  expect(deactivatedUser?.isActive).toBe(true);
});

it("Should not allow a normal user to deactivate an account", async () => {
  const { user: createdUser, accessToken } = await loginUser({
    type: UserType.Client,
  });

  const response = await request(app)
    .post(`/api/auth/v1/deactivate-account/${createdUser.id}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send();

  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.NOT_ALLOWED);

  const deactivatedUser = await prisma.user.findUnique({
    where: { id: createdUser.id },
  });
  expect(deactivatedUser?.isActive).toBe(true);
});

it("Should not allow an admin to deactivate the account of a non existing user ", async () => {
  const { accessToken } = await loginUser({
    type: UserType.Admin,
  });

  const response = await request(app)
    .post(`/api/auth/v1/deactivate-account/asdf`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send();

  expect(response.status).toEqual(404);
  expect(response.body.code).toBe(CODES.NOT_FOUND);
});

it("Should allow admin to deactivate an account", async () => {
  const { user: createdUser } = await loginUser({
    type: UserType.Client,
  });
  const { accessToken } = await loginUser({
    type: UserType.Admin,
  });

  const response = await request(app)
    .post(`/api/auth/v1/deactivate-account/${createdUser.id}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send();

  expect(response.status).toEqual(200);
  expect(response.body.code).toBe(CODES.SUCCESS);

  const deactivatedUser = await prisma.user.findUnique({
    where: { id: createdUser.id },
  });
  expect(deactivatedUser?.isActive).toBe(false);
});
