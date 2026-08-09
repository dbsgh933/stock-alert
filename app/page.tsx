"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Market = "US" | "KR";

type UserStock = {
  id: number;
  ticker: string;
  name: string;
  market: Market;
  owned: boolean;
};

type Tab =
  | "US_OWNED"
  | "US_WATCH"
  | "KR_OWNED"
  | "KR_WATCH";

const tabs: { key: Tab; label: string }[] = [
  { key: "US_OWNED", label: "해외주식 소유" },
  { key: "US_WATCH", label: "해외주식" },
  { key: "KR_OWNED", label: "국내주식 소유" },
  { key: "KR_WATCH", label: "국내주식" },
];

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] =
    useState<Tab>("US_OWNED");

  const [stocks, setStocks] =
    useState<UserStock[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [showAdd, setShowAdd] =
    useState(false);

  const [ticker, setTicker] =
    useState("");

  const [name, setName] =
    useState("");

  const [market, setMarket] =
    useState<Market>("US");

  const [owned, setOwned] =
    useState(true);

  const [message, setMessage] =
    useState("");

  async function loadStocks() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("user_stocks")
      .select("id, ticker, name, market, owned")
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      setMessage(
        `종목 조회 실패: ${error.message}`
      );
      setLoading(false);
      return;
    }

    setStocks((data ?? []) as UserStock[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadStocks();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();

    router.push("/login");
    router.refresh();
  }

  async function handleAddStock() {
    setMessage("");

    const normalizedTicker =
      ticker.trim().toUpperCase();

    const normalizedName =
      name.trim();

    if (!normalizedTicker) {
      setMessage("티커를 입력하세요.");
      return;
    }

    if (!normalizedName) {
      setMessage("종목명을 입력하세요.");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("로그인이 필요합니다.");
      return;
    }

    const { error } = await supabase
      .from("user_stocks")
      .insert({
        user_id: user.id,
        ticker: normalizedTicker,
        name: normalizedName,
        market,
        owned,
      });

    if (error) {
      if (error.code === "23505") {
        setMessage(
          "이미 등록된 종목입니다."
        );
      } else {
        setMessage(
          `종목 추가 실패: ${error.message}`
        );
      }

      return;
    }

    setTicker("");
    setName("");
    setMarket("US");
    setOwned(true);
    setShowAdd(false);

    await loadStocks();
  }

  async function handleDeleteStock(
    id: number,
    stockName: string
  ) {
    const confirmed =
      window.confirm(
        `${stockName} 종목을 삭제할까요?`
      );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("user_stocks")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(
        `삭제 실패: ${error.message}`
      );
      return;
    }

    await loadStocks();
  }

  const filteredStocks =
    useMemo(() => {
      return stocks.filter((stock) => {
        if (
          activeTab === "US_OWNED"
        ) {
          return (
            stock.market === "US" &&
            stock.owned
          );
        }

        if (
          activeTab === "US_WATCH"
        ) {
          return (
            stock.market === "US" &&
            !stock.owned
          );
        }

        if (
          activeTab === "KR_OWNED"
        ) {
          return (
            stock.market === "KR" &&
            stock.owned
          );
        }

        return (
          stock.market === "KR" &&
          !stock.owned
        );
      });
    }, [stocks, activeTab]);

  return (
    <main className="min-h-screen bg-[#101014] text-white">
      <div className="mx-auto min-h-screen max-w-md bg-[#101014]">

        <header className="sticky top-0 z-20 border-b border-zinc-900 bg-[#101014]">

          <div className="flex items-center justify-between px-4 pb-3 pt-5">
            <div>
              <h1 className="text-xl font-semibold">
                주식 알리미
              </h1>

              <p className="mt-1 text-xs text-zinc-500">
                추세 기반 종목 관리
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-300"
              >
                로그아웃
              </button>

              <button
                type="button"
                onClick={() =>
                  setShowAdd(true)
                }
                className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-2xl"
                aria-label="종목 추가"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto px-3 pb-3">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() =>
                  setActiveTab(tab.key)
                }
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm ${
                  activeTab === tab.key
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <section className="px-4 py-4">

          {message && (
            <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
              {message}
            </div>
          )}

          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">
              종목 목록
            </h2>

            <span className="text-xs text-zinc-500">
              {filteredStocks.length}개
            </span>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-zinc-500">
              불러오는 중...
            </div>
          ) : filteredStocks.length === 0 ? (
            <div className="py-14 text-center">
              <div className="text-sm text-zinc-500">
                등록된 종목이 없습니다.
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAdd(true)
                }
                className="mt-4 rounded-xl bg-zinc-800 px-4 py-2 text-sm"
              >
                종목 추가
              </button>
            </div>
          ) : (
            <div>
              {filteredStocks.map(
                (stock) => (
                  <article
                    key={stock.id}
                    className="border-b border-zinc-800"
                  >
                    <div className="flex items-center gap-3 py-4">

                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold">
                        {stock.ticker
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {stock.name}
                        </div>

                        <div className="mt-1 text-xs text-zinc-500">
                          {stock.ticker}
                        </div>
                      </div>

                      <div className="text-right text-xs text-zinc-500">
                        {stock.market === "US"
                          ? "해외"
                          : "국내"}

                        <div className="mt-1">
                          {stock.owned
                            ? "보유"
                            : "관심"}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteStock(
                            stock.id,
                            stock.name
                          )
                        }
                        className="rounded-lg border border-zinc-700 px-2 py-2 text-xs text-zinc-400"
                      >
                        삭제
                      </button>

                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>

        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70">

            <div className="w-full max-w-md rounded-t-3xl bg-zinc-900 p-5">

              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  종목 추가
                </h2>

                <button
                  type="button"
                  onClick={() => {
                    setShowAdd(false);
                    setMessage("");
                  }}
                  className="text-xl text-zinc-400"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 space-y-4">

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    티커
                  </label>

                  <input
                    value={ticker}
                    onChange={(event) =>
                      setTicker(
                        event.target.value
                      )
                    }
                    placeholder="AVGO 또는 000660.KS"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    종목명
                  </label>

                  <input
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target.value
                      )
                    }
                    placeholder="브로드컴"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    시장
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setMarket("US")
                      }
                      className={`rounded-xl py-3 text-sm ${
                        market === "US"
                          ? "bg-white text-black"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      해외주식
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setMarket("KR")
                      }
                      className={`rounded-xl py-3 text-sm ${
                        market === "KR"
                          ? "bg-white text-black"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      국내주식
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    구분
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setOwned(true)
                      }
                      className={`rounded-xl py-3 text-sm ${
                        owned
                          ? "bg-white text-black"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      소유
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setOwned(false)
                      }
                      className={`rounded-xl py-3 text-sm ${
                        !owned
                          ? "bg-white text-black"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      관심
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddStock}
                  className="w-full rounded-xl bg-white py-3 font-medium text-black"
                >
                  추가
                </button>

              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}