import { app } from "../../../app";
import request from "supertest";
import { CODES } from "../../../enums/codes";
import { loginUser } from "../../../test/helpers/auth-helper";
import { prisma } from "../../../prisma";
import { UserType } from "@prisma/client";

it("Should not allow a user to create a super user if he is unauthenticated", async () => {
  const newAdminEmail = "udfhsihdfiuashdf@dsfasfd.com";

  const response = await request(app)
    .post(`/api/auth/v1/secured-super-user`)
    .send({
      name: "test",
      email: "udfhsihdfiuashdf@dsfasfd.com",
      password: "aAdfasdfsadf@adsf1",
      type: UserType.Admin,
    });

  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.NO_ACCESS_TOKEN);

  const createdAdmin = await prisma.user.findUnique({
    where: { email: newAdminEmail },
  });
  expect(createdAdmin).toBe(null);
});

it("Should not allow a normal user to create a super user", async () => {
  const { accessToken } = await loginUser({});
  const newAdminEmail = "udfhsihdfiuashdf@dsfasfd.com";

  const response = await request(app)
    .post(`/api/auth/v1/secured-super-user`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      name: "test",
      email: "udfhsihdfiuashdf@dsfasfd.com",
      password: "aAdfasdfsadf@adsf1",
      type: UserType.Admin,
    });

  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.NOT_ALLOWED);

  const createdAdmin = await prisma.user.findUnique({
    where: { email: newAdminEmail },
  });
  expect(createdAdmin).toBe(null);
});

it("Should not allow an admin to create a super user if the number of to be created super user limit has been reached", async () => {
  const newAdminEmail = "udfhsihdfiuashdf@dsfasfd.com";

  // Normal non-deleted admins
  for (let i = 0; i < Number(process.env.TOTAL_ADMINS_IN_SYSTEM) - 1; i++) {
    await loginUser({ type: UserType.Admin });
  }

  // Admin user to perform action
  const { accessToken } = await loginUser({
    type: UserType.Admin,
  });

  const response = await request(app)
    .post(`/api/auth/v1/secured-super-user`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      name: "test",
      email: "udfhsihdfiuashdf@dsfasfd.com",
      password: "aAdfasdfsadf@adsf1",
      type: UserType.Admin,
    });

  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.MAX_USERS_IN_SYSTEM);

  const createdAdmin = await prisma.user.findUnique({
    where: { email: newAdminEmail },
  });
  expect(createdAdmin).toBe(null);
});

it("Should allow admin to create a super user with incorrect information", async () => {
  const { accessToken } = await loginUser({
    type: UserType.Admin,
  });
  const newAdminEmail = "udfhsihdfiuashdf@dsfasfd.com";

  const response = await request(app)
    .post(`/api/auth/v1/secured-super-user`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      name: "test",
      email: "udfhsihdfiuashdf@dsfasfd.com",
      password: "aAdfasdfsadf",
    });

  console.log(response.body);

  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.VALIDATION_REQUEST_ERROR);
});

it("Should allow admin to create a super user", async () => {
  const { accessToken } = await loginUser({
    type: UserType.Admin,
  });
  const newAdminEmail = "udfhsihdfiuashdf@dsfasfd.com";

  const response = await request(app)
    .post(`/api/auth/v1/secured-super-user`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      name: "test",
      email: "udfhsihdfiuashdf@dsfasfd.com",
      password: "aAdfasdfsadf@adsf1",
      type: UserType.Admin,
    });

  console.log(response.body);

  expect(response.status).toEqual(201);
  expect(response.body.code).toBe(CODES.SUCCESS);

  const createdAdmin = await prisma.user.findUnique({
    where: { email: newAdminEmail },
  });
  expect(createdAdmin).toBeDefined();
  expect(createdAdmin?.email).toBe(newAdminEmail);
  expect(createdAdmin?.type).toBe(UserType.Admin);
  expect(createdAdmin?.isActive).toBe(false);
  expect(createdAdmin?.isDeleted).toBe(false);
  expect(createdAdmin?.twoFAEnabled).toBe(false);
  expect(createdAdmin?.twoFATempSecret).toBeDefined();
});
