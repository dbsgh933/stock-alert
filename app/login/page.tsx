"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleSignup() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
  	email,
  	password,
  	options: {
    		emailRedirectTo: `${window.location.origin}/auth/callback`,
  	},
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("회원가입 완료. 이메일 인증 메일을 확인하세요.");
  }

  return (
    <main className="min-h-screen bg-[#101014] text-white">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <div className="w-full">
          <h1 className="text-2xl font-semibold">
            주식 알리미
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            로그인 후 내 종목을 관리할 수 있습니다.
          </p>

          <form
            onSubmit={handleLogin}
            className="mt-8 space-y-4"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm text-zinc-400"
              >
                이메일
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-zinc-500"
                placeholder="email@example.com"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm text-zinc-400"
              >
                비밀번호
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-zinc-500"
                placeholder="비밀번호"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-white py-3 font-medium text-black disabled:opacity-50"
            >
              {loading ? "처리 중..." : "로그인"}
            </button>

            <button
              type="button"
              onClick={handleSignup}
              disabled={loading}
              className="w-full rounded-xl border border-zinc-700 py-3 text-zinc-300 disabled:opacity-50"
            >
              회원가입
            </button>

            {message && (
              <p className="text-sm text-zinc-400">
                {message}
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}