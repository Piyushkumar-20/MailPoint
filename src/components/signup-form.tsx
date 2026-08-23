"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { GoogleIcon } from "@/components/google-icon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordMinimumLength = 8;

type AuthAction = "email" | "google" | null;

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<AuthAction>(null);

  const validateForm = () => {
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      return "Please fill in all fields.";
    }

    if (!emailPattern.test(email)) {
      return "Please enter a valid email address.";
    }

    if (password.length < passwordMinimumLength) {
      return `Password must be at least ${passwordMinimumLength} characters long.`;
    }

    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }

    return "";
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setLoading("email");

    const { error: signUpError } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
    });

    setLoading(null);

    if (signUpError) {
      setError(signUpError.message ?? "Unable to create your account.");
      return;
    }

    router.push("/");
    router.refresh();
  };

  const handleGoogleSignUp = async () => {
    if (loading) {
      return;
    }

    setError("");
    setLoading("google");

    const { error: googleError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });

    if (googleError) {
      setLoading(null);
      setError(googleError.message ?? "Unable to continue with Google.");
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Enter your email below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              {error ? (
                <Field>
                  <FieldError>{error}</FieldError>
                </Field>
              ) : null}
              <Field>
                <FieldLabel htmlFor="name">Full Name</FieldLabel>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={!!loading}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={!!loading}
                  required
                />
              </Field>
              <Field>
                <Field className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={!!loading}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="confirm-password">
                      Confirm Password
                    </FieldLabel>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      disabled={!!loading}
                      required
                    />
                  </Field>
                </Field>
                <FieldDescription>
                  Must be at least 8 characters long.
                </FieldDescription>
              </Field>
              <Field>
                <Button type="submit" disabled={!!loading}>
                  {loading === "email" ? (
                    <Loader2Icon className="animate-spin" />
                  ) : null}
                  Create Account
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleGoogleSignUp}
                  disabled={!!loading}
                >
                  {loading === "google" ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <GoogleIcon className="size-4" />
                  )}
                  Continue with Google
                </Button>
                <FieldDescription className="text-center">
                  Already have an account? <Link href="/login">Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  );
}
