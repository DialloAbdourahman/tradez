import { app } from "../../../app";
import request from "supertest";
import { CODES } from "../../../enums/codes";
import { prisma } from "../../../prisma";
import { createUser } from "../../../test/helpers/auth-helper";

it("Should not activate account if code is not provided.", async () => {
  const response = await request(app).post("/api/auth/v1/activate").send();
  expect(response.status).toEqual(400);
  expect(response.body.code).toBe(CODES.VALIDATION_REQUEST_ERROR);
});

it("Should activate account if code is provided and make that the code is deleted at the end", async () => {
  const { createdUser, activateAccountToken } = await createUser({
    isActive: false,
  });

  const response = await request(app)
    .post("/api/auth/v1/activate")
    .send({ code: activateAccountToken });
  expect(response.status).toEqual(200);
  expect(response.body.code).toBe(CODES.SUCCESS);

  const activatedUser = await prisma.user.findUnique({
    where: {
      id: createdUser.id,
    },
  });
  expect(activatedUser?.isActive).toBe(true);
  expect(activatedUser?.activateAccountToken).toBe(null);
});
