import { app } from "../../../app";
import request from "supertest";
import { CODES } from "../../../enums/codes";
import { prisma } from "../../../prisma";
import { UserType } from "@prisma/client";
import { loginUser } from "../../../test/helpers/auth-helper";

it("Should not add password with wrong information", async () => {
  const { accessToken } = await loginUser({
    type: UserType.Client,
    noPassword: true,
  });

  const response2 = await request(app)
    .patch("/api/auth/v1/add-password")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      newPassword: "asdfasdfasdf",
    });
  expect(response2.status).toEqual(400);
  expect(response2.body.code).toBe(CODES.VALIDATION_REQUEST_ERROR);

  const response3 = await request(app)
    .patch("/api/auth/v1/add-password")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      confirmNewPassword: "asdfasdfasdf",
    });
  expect(response3.status).toEqual(400);
  expect(response3.body.code).toBe(CODES.VALIDATION_REQUEST_ERROR);

  const response4 = await request(app)
    .patch("/api/auth/v1/add-password")
    .set("Authorization", `Bearer ${accessToken}`)
    .send();
  expect(response4.status).toEqual(400);
  expect(response4.body.code).toBe(CODES.VALIDATION_REQUEST_ERROR);
});

it("Should not add password if the two new passwords don't match", async () => {
  const { accessToken } = await loginUser({
    type: UserType.Client,
    noPassword: true,
  });

  const response = await request(app)
    .patch("/api/auth/v1/add-password")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      newPassword: "Test1234@gmail.com",
      confirmNewPassword: "Test12345@gmail.com",
    });
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.PASSWORDS_MUST_BE_THE_SAME);
});

it("Should not add the password of a user whose account has not been activated", async () => {
  const { accessToken } = await loginUser({
    type: UserType.Client,
    noPassword: true,
    isActive: false,
  });

  const response = await request(app)
    .patch("/api/auth/v1/add-password")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      newPassword: "asdfasdfd",
      confirmNewPassword: "asdfasdfd",
    });
  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.ACCOUNT_NOT_ACTIVATED);
});

it("Should not add the password of a user whose account has been deleted", async () => {
  const { accessToken } = await loginUser({
    type: UserType.Client,
    noPassword: true,
    isDeleted: true,
  });

  const response = await request(app)
    .patch("/api/auth/v1/add-password")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      newPassword: "asdfasdfd",
      confirmNewPassword: "asdfasdfd",
    });
  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.ACCOUNT_DELETED);
});

it("Should not add password of an unauthenticated user", async () => {
  const response = await request(app).patch("/api/auth/v1/add-password").send({
    newPassword: "Test1234@gmail.com",
    confirmNewPassword: "Test1234@gmail.com",
  });
  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.NO_ACCESS_TOKEN);
});

it("Should not allow a user with a password to use this route", async () => {
  const { accessToken } = await loginUser({
    type: UserType.Client,
  });

  const response = await request(app)
    .patch("/api/auth/v1/add-password")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      newPassword: "Test1234@gmail.com",
      confirmNewPassword: "Test1234@gmail.com",
    });
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.PASSWORD_EXIST_ALREADY);
});

it("Should not allow a super user to use this route", async () => {
  const { accessToken } = await loginUser({
    type: UserType.Admin,
  });

  const response = await request(app)
    .patch("/api/auth/v1/add-password")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      newPassword: "Test1234@gmail.com",
      confirmNewPassword: "Test1234@gmail.com",
    });
  expect(response.status).toEqual(401);
  expect(response.body.code).toBe(CODES.NOT_ALLOWED);
});

it("Should add password if all information is provided", async () => {
  const { accessToken, user: createdUser } = await loginUser({
    type: UserType.Client,
    noPassword: true,
  });

  const response = await request(app)
    .patch("/api/auth/v1/add-password")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      newPassword: "Test1234@gmail.com",
      confirmNewPassword: "Test1234@gmail.com",
    });
  expect(response.status).toEqual(200);
  expect(response.body.code).toBe(CODES.SUCCESS);

  const user = await prisma.user.findUnique({
    where: {
      id: createdUser.id,
    },
  });
  expect(user?.password).toBeDefined;
});
