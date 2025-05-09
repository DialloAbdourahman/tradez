import { app } from "../../../app";
import request from "supertest";
import { CODES } from "../../../enums/codes";
import { UserType } from "@prisma/client";
import { loginUser } from "../../../test/helpers/auth-helper";

it("Should not get the has password info if the user is not activated", async () => {
  const { accessToken } = await loginUser({
    type: UserType.Client,
    isActive: false,
  });

  const response = await request(app)
    .get("/api/auth/v1/has-password")
    .set("Authorization", `Bearer ${accessToken}`)
    .send();
  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.ACCOUNT_NOT_ACTIVATED);
});

it("Should not get the has password information of a user whose account has been deleted", async () => {
  const { accessToken } = await loginUser({
    type: UserType.Client,
    isDeleted: true,
  });

  const response = await request(app)
    .get("/api/auth/v1/has-password")
    .set("Authorization", `Bearer ${accessToken}`)
    .send();
  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.ACCOUNT_DELETED);
});

it("Should not get the has password info of an unauthenticated user", async () => {
  const response = await request(app).get("/api/auth/v1/has-password").send();

  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.NO_ACCESS_TOKEN);
});

it("Should get the has password info of an authenticated user", async () => {
  const { accessToken: accessTokenOfUserWithPassword } = await loginUser();
  const { accessToken: accessTokenOfUserWithoutPassword } = await loginUser({
    type: UserType.Client,
    noPassword: true,
  });

  const response = await request(app)
    .get("/api/auth/v1/has-password")
    .set("Authorization", `Bearer ${accessTokenOfUserWithPassword}`)
    .send();
  expect(response.status).toEqual(200);
  expect(response.body.code).toBe(CODES.SUCCESS);
  expect(response.body.data.hasPassword).toBe(true);

  const response2 = await request(app)
    .get("/api/auth/v1/has-password")
    .set("Authorization", `Bearer ${accessTokenOfUserWithoutPassword}`)
    .send();
  expect(response2.status).toEqual(200);
  expect(response2.body.code).toBe(CODES.SUCCESS);
  expect(response2.body.data.hasPassword).toBe(false);
});
