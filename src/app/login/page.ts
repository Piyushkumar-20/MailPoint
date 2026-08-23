import { authClient } from "@/lib/auth-client";
await authClient.signIn.email({
    email: "test@example.com",
    password: "TestPassword123!",
  });