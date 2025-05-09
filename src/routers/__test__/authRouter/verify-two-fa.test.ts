import { app } from "../../../app";
import request from "supertest";
import { CODES } from "../../../enums/codes";
import { createUser } from "../../../test/helpers/auth-helper";
import { UserType } from "@prisma/client";

it("Should not set two FA if all information is not entered", async () => {
  const id = "asdf";
  const code = "asdfasdfasdf";

  const response = await request(app)
    .post("/api/auth/v1/verify-2fa")
    .send({ id });
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.VALIDATION_REQUEST_ERROR);

  const response2 = await request(app)
    .post("/api/auth/v1/verify-2fa")
    .send({ code });
  expect(response2.status).toEqual(400);
  expect(response2.body.code).toBe(CODES.VALIDATION_REQUEST_ERROR);

  const response3 = await request(app).post("/api/auth/v1/verify-2fa").send({});
  expect(response3.status).toEqual(400);
  expect(response3.body.code).toBe(CODES.VALIDATION_REQUEST_ERROR);
});

it("Should not set two FA for a user whose account has not been activated", async () => {
  const { createdUser } = await createUser({
    isActive: false,
  });
  const code = "asdfasdfasdf";

  const response = await request(app)
    .post("/api/auth/v1/verify-2fa")
    .send({ id: createdUser.id, code });
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.ACCOUNT_NOT_ACTIVATED);
});

it("Should not set two FA for a user whose account has been deleted", async () => {
  const { createdUser } = await createUser({
    isDeleted: true,
  });
  const code = "asdfasdfasdf";

  const response = await request(app)
    .post("/api/auth/v1/verify-2fa")
    .send({ id: createdUser.id, code });
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.ACCOUNT_DELETED);
});

it("Should not verify two FA for a user who hasn't enabled two fa", async () => {
  const { createdUser } = await createUser({
    twoFAEnabled: false,
    type: UserType.Admin,
  });
  const code = "asdfasdfasdf";

  const response = await request(app)
    .post("/api/auth/v1/verify-2fa")
    .send({ id: createdUser.id, code });
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.TWO_FACTOR_NOT_YET_ENABLED);
});

it("Should verify two FA for a user who has enabled two fa", async () => {
  const { createdUser } = await createUser({
    type: UserType.Admin,
    twoFATempSecret: "asdf",
    twoFAEnabled: true,
    twoFASecret: "asdf",
  });
  const code = "asdfasdfasdf";

  const response = await request(app)
    .post("/api/auth/v1/verify-2fa")
    .send({ id: createdUser.id, code });
  expect(response.status).toEqual(200);
  expect(response.body.code).toBe(CODES.SUCCESS);
  expect(response.body.data.id).toBe(createdUser.id);
  expect(response.body.data.name).toBe(createdUser.name);
  expect(response.body.data.email).toBe(createdUser.email);
  expect(response.body.data.type).toBe(createdUser.type);
  expect(response.body.data.accessToken).toBeDefined();
  expect(response.body.data.refreshToken).toBeDefined();
});
