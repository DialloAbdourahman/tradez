import { app } from "../../../app";
import request from "supertest";
import { CODES } from "../../../enums/codes";
import { prisma } from "../../../prisma";
import { UserType } from "@prisma/client";
import { loginUser } from "../../../test/helpers/auth-helper";

it("Should not allow a user to restore another user if he is unauthenticated", async () => {
  const { user: createdUser } = await loginUser({
    type: UserType.Client,
    isDeleted: true,
  });

  const response = await request(app)
    .post(`/api/auth/v1/restore/${createdUser.id}`)
    .send();

  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.NO_ACCESS_TOKEN);

  const restoredUser = await prisma.user.findUnique({
    where: { id: createdUser.id },
  });
  expect(restoredUser?.isDeleted).toBe(true);
});

it("Should not allow a normal user to retore another user", async () => {
  const { user: createdUser, accessToken } = await loginUser({
    type: UserType.Client,
  });

  const response = await request(app)
    .post(`/api/auth/v1/restore/${createdUser.id}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send();

  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.NOT_ALLOWED);

  const restoredUser = await prisma.user.findUnique({
    where: { id: createdUser.id },
  });
  expect(restoredUser?.isDeleted).toBe(false);
});

it("Should not allow a non super user to retore another user", async () => {
  const { user: createdUser, accessToken } = await loginUser({
    type: UserType.Client,
  });

  const response = await request(app)
    .post(`/api/auth/v1/restore/${createdUser.id}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send();

  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.NOT_ALLOWED);

  const restoredUser = await prisma.user.findUnique({
    where: { id: createdUser.id },
  });
  expect(restoredUser?.isDeleted).toBe(false);
});

it("Should not allow admin to retore a user that doesn't exist", async () => {
  const { accessToken } = await loginUser({
    type: UserType.Admin,
  });

  const response = await request(app)
    .post(`/api/auth/v1/restore/11`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send();

  expect(response.status).toEqual(404);
  expect(response.body.code).toBe(CODES.NOT_FOUND);
});

it("Should not allow an a super user to restore a user if it will cause the system to exceed the maximum amount of user", async () => {
  // Normal non-deleted admins
  for (let i = 0; i < Number(process.env.TOTAL_ADMINS_IN_SYSTEM) - 1; i++) {
    await loginUser({ type: UserType.Admin });
  }

  // Deleted admin
  const { user: deletedAdmin } = await loginUser({
    type: UserType.Admin,
    isDeleted: true,
  });

  // Admin user to perform action
  const { accessToken } = await loginUser({
    type: UserType.Admin,
  });

  const response = await request(app)
    .post(`/api/auth/v1/restore/${deletedAdmin.id}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send();

  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.MAX_USERS_IN_SYSTEM);

  const restoredUser = await prisma.user.findUnique({
    where: { id: deletedAdmin.id },
  });
  expect(restoredUser?.isDeleted).toBe(true);
});

it("Should allow admin to retore a user", async () => {
  const { user: clientUser } = await loginUser({
    type: UserType.Client,
    isDeleted: true,
  });
  const { accessToken } = await loginUser({
    type: UserType.Admin,
  });

  const response = await request(app)
    .post(`/api/auth/v1/restore/${clientUser.id}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send();

  expect(response.status).toEqual(200);
  expect(response.body.code).toBe(CODES.SUCCESS);

  const restoredUser = await prisma.user.findUnique({
    where: { id: clientUser.id },
  });
  expect(restoredUser?.isDeleted).toBe(false);
});
