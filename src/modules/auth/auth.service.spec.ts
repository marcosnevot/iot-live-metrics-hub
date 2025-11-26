import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let authService: AuthService;
  let jwtService: JwtService;

  const JWT_ACCESS_TOKEN = "signed-jwt-token";

  beforeEach(async () => {
    // Set environment variables used by AuthService for each test run
    process.env.ADMIN_USERNAME = "admin@local.test";
    process.env.ADMIN_PASSWORD = "replace-with-admin-password";
    process.env.ANALYST_USERNAME = "analyst@local.test";
    process.env.ANALYST_PASSWORD = "replace-with-analyst-password";

    const jwtServiceMock: Partial<JwtService> = {
      signAsync: jest.fn().mockResolvedValue(JWT_ACCESS_TOKEN),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(authService).toBeDefined();
  });

  it("should login successfully with valid admin credentials", async () => {
    const username = process.env.ADMIN_USERNAME as string;
    const password = process.env.ADMIN_PASSWORD as string;

    const result = await authService.login(username, password);

    expect(result).toEqual({ accessToken: JWT_ACCESS_TOKEN });
    expect(jwtService.signAsync).toHaveBeenCalledTimes(1);
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: username,
      role: "admin",
    });
  });

  it("should login successfully with valid analyst credentials", async () => {
    const username = process.env.ANALYST_USERNAME as string;
    const password = process.env.ANALYST_PASSWORD as string;

    const result = await authService.login(username, password);

    expect(result).toEqual({ accessToken: JWT_ACCESS_TOKEN });
    expect(jwtService.signAsync).toHaveBeenCalledTimes(1);
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: username,
      role: "analyst",
    });
  });

  it("should throw UnauthorizedException when credentials are invalid", async () => {
    const invalidUsername = "unknown@test.local";
    const invalidPassword = "wrong-password";

    await expect(
      authService.login(invalidUsername, invalidPassword),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it("should treat correct username with wrong password as invalid credentials", async () => {
    const username = process.env.ADMIN_USERNAME as string;
    const invalidPassword = "not-the-admin-secret";

    await expect(
      authService.login(username, invalidPassword),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it("should treat wrong username with correct password as invalid credentials", async () => {
    const invalidUsername = "not-the-admin@test.local";
    const password = process.env.ADMIN_PASSWORD as string;

    await expect(
      authService.login(invalidUsername, password),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });
});
