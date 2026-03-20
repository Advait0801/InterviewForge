"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.register(email, password, name || undefined);
      setToken(res.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-md">
        <Card className="p-6">
          <h1 className="mb-4 text-2xl font-semibold">Create account</h1>
          <form className="space-y-3" onSubmit={onSubmit}>
            <Input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error ? <p className="text-sm text-error">{error}</p> : null}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Creating..." : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-text-secondary">
            Already have an account?{" "}
            <Link className="text-primary" href="/login">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </PageShell>
  );
}
