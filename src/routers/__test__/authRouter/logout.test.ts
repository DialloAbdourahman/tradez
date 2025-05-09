import { app } from "../../../app";
import request from "supertest";
import { CODES } from "../../../enums/codes";
import { prisma } from "../../../prisma";
import { loginUser } from "../../../test/helpers/auth-helper";

it("Should not logout user whose account has been deleted", async () => {
  const { accessToken, user: loggedInUser } = await loginUser({
    isDeleted: true,
    isActive: true,
  });

  const response = await request(app)
    .post("/api/auth/v1/logout")
    .set("Authorization", `Bearer ${accessToken}`)
    .send();
  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.ACCOUNT_DELETED);

  const user = await prisma.user.findFirst({
    where: {
      id: loggedInUser.id,
    },
  });
  expect(user?.token).not.toBeNull();
});

it("Should not logout user whose account has been deactivated", async () => {
  const { accessToken, user: loggedInUser } = await loginUser({
    isActive: false,
  });

  const response = await request(app)
    .post("/api/auth/v1/logout")
    .set("Authorization", `Bearer ${accessToken}`)
    .send();
  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.ACCOUNT_NOT_ACTIVATED);

  const user = await prisma.user.findFirst({
    where: {
      id: loggedInUser.id,
    },
  });
  expect(user?.token).not.toBeNull();
});

it("Should not logout an unauthenticated user", async () => {
  const response = await request(app).post("/api/auth/v1/logout").send();

  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.NO_ACCESS_TOKEN);
});

it("Should logout an authenticated user", async () => {
  const { user: loggedInUser, accessToken } = await loginUser();

  const response = await request(app)
    .post("/api/auth/v1/logout")
    .set("Authorization", `Bearer ${accessToken}`)
    .send();

  expect(response.status).toEqual(200);
  expect(response.body.code).toBe(CODES.SUCCESS);

  const user = await prisma.user.findFirst({
    where: {
      id: loggedInUser.id,
    },
  });

  expect(user?.token).toBeNull();
});
