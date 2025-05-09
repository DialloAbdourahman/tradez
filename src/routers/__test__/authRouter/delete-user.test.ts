import { app } from "../../../app";
import request from "supertest";
import { CODES } from "../../../enums/codes";
import { prisma } from "../../../prisma";
import { UserType } from "@prisma/client";
import { loginUser } from "../../../test/helpers/auth-helper";

it("Should not allow a user to delete another user if he is unauthenticated", async () => {
  const { user: createdUser } = await loginUser();

  const response = await request(app)
    .delete(`/api/auth/v1/${createdUser.id}`)
    .send();

  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.NO_ACCESS_TOKEN);

  const deletedUser = await prisma.user.findUnique({
    where: { id: createdUser.id },
  });
  expect(deletedUser?.isDeleted).toBe(false);
});

it("Should not allow a normal user to delete another user", async () => {
  const { accessToken, user: createdUser } = await loginUser();

  const response = await request(app)
    .delete(`/api/auth/v1/${createdUser.id}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send();

  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.NOT_ALLOWED);

  const deletedUser = await prisma.user.findUnique({
    where: { id: createdUser.id },
  });
  expect(deletedUser?.isDeleted).toBe(false);
});

it("Should not allow admin to delete a user that doesn't exist", async () => {
  const { accessToken } = await loginUser({
    type: UserType.Admin,
  });

  const response = await request(app)
    .delete(`/api/auth/v1/11`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send();

  expect(response.status).toEqual(404);
  expect(response.body.code).toBe(CODES.NOT_FOUND);
});

it("Should allow admin to delete a user", async () => {
  const { user: clientUser } = await loginUser();
  const { accessToken } = await loginUser({
    type: UserType.Admin,
  });

  const response = await request(app)
    .delete(`/api/auth/v1/${clientUser.id}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send();

  expect(response.status).toEqual(200);
  expect(response.body.code).toBe(CODES.SUCCESS);

  const deletedUser = await prisma.user.findUnique({
    where: { id: clientUser.id },
  });
  expect(deletedUser?.isDeleted).toBe(true);
  expect(deletedUser?.token).toBe(null);
});
