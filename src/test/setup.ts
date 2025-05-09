import { prisma } from "../prisma";

const emptyDB = async () => {
  await prisma.user.deleteMany({});
};

jest.mock("../utils/aws-ses.ts", () => {
  return {
    AwsSesHelper: jest.fn().mockImplementation(() => {
      return {
        sendActivateAccountEmail: jest.fn().mockImplementation(() => {
          return Promise.resolve(true);
        }),
        sendResetPasswordEmail: jest.fn().mockImplementation(() => {
          return Promise.resolve(true);
        }),
      };
    }),
  };
});

jest.mock("otplib", () => {
  const actualLibrary = jest.requireActual("otplib");
  return {
    ...actualLibrary,
    authenticator: {
      // ...actualLibrary.authenticator,
      check: jest.fn().mockReturnValue(true),
      keyuri: jest.fn().mockReturnValue("asdfasdf"),
      generateSecret: jest.fn().mockReturnValue("asdfasdfasdf"),
    },
  };
});

export const mockedEmail = "test@test.com";

jest.mock("../utils/get-user-from-google.ts", () => {
  return {
    getUserFromGoogle: jest.fn().mockImplementation(() => {
      return Promise.resolve({
        id: "asdfasdf",
        email: mockedEmail,
        name: "Tester",
        picture: "asdfasdfasdfasdf",
      });
    }),
  };
});

beforeAll(async () => {
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@localhost:5432/tradez?schema=public";

  process.env.ACCESS_TOKEN_JWT_KEY = "1234";
  process.env.REFRESH_TOKEN_JWT_KEY = "5678";
  process.env.ACCESS_TOKEN_EXPIRATION = "1d";
  process.env.REFRESH_TOKEN_EXPIRATION = "7d";

  process.env.ACTIVATE_ACCOUNT_JWT_KEY = "UDUFHSUDF";
  process.env.FORGOT_PASSWORD_JWT_KEY = "YYSKJGYEYSUEY";

  process.env.TOTAL_ADMINS_IN_SYSTEM = "3";

  try {
    await prisma.$connect();
    console.log("Connected to PostgreSQL successfully");

    process.on("SIGINT", async () => {
      await prisma.$disconnect();
      console.log("Disconnected to postgresql");
      process.exit(0);
    });
  } catch (error) {
    console.error("Database connection error", error);
    process.exit(1);
  }
});

beforeEach(async () => {
  jest.clearAllMocks();

  await emptyDB();
});

afterAll(async () => {
  await emptyDB();
  await prisma.$disconnect();
  console.log("Disconnected to postgresql");
});
