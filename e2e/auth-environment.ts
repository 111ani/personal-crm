export function authEnvironment(baseURL: string, databaseUrl: string) {
  return {
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_URL: baseURL,
    BETTER_AUTH_SECRET: "playwright-fixture-only-72b978f49c3e12acba10",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: process.env.MAILPIT_SMTP_PORT ?? "1025",
    SMTP_USER: "",
    SMTP_PASSWORD: "",
    SMTP_FROM: "noreply@mail.crm.example.test",
  };
}
