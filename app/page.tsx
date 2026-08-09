"use client";

import { useMemo, useState } from "react";

type Market = "US" | "KR";

type Stock = {
  ticker: string;
  name: string;
  market: Market;
  owned: boolean;
  price: string;
  change: number;
  score: number;
  grade: "A" | "B+" | "B" | "C" | "D";
  recommendation: string;
  ma5: number;
  ma10: number;
  ma20: number;
  ma60: number;
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

const stocks: Stock[] = [
  {
    ticker: "AVGO",
    name: "브로드컴",
    market: "US",
    owned: true,
    price: "$420.30",
    change: 2.31,
    score: 92,
    grade: "A",
    recommendation: "비중 확대 후보",
    ma5: 414.2,
    ma10: 408.5,
    ma20: 396.4,
    ma60: 350.2,
  },
  {
    ticker: "AMD",
    name: "AMD",
    market: "US",
    owned: true,
    price: "$176.20",
    change: 1.12,
    score: 84,
    grade: "A",
    recommendation: "비중 확대 후보",
    ma5: 172.4,
    ma10: 169.1,
    ma20: 163.5,
    ma60: 151.2,
  },
  {
    ticker: "SNOW",
    name: "스노우플레이크",
    market: "US",
    owned: false,
    price: "$157.80",
    change: -3.6,
    score: 58,
    grade: "B",
    recommendation: "관망",
    ma5: 160.4,
    ma10: 162.1,
    ma20: 165.7,
    ma60: 150.9,
  },
  {
    ticker: "MU",
    name: "마이크론",
    market: "US",
    owned: false,
    price: "$189.40",
    change: -2.21,
    score: 28,
    grade: "D",
    recommendation: "비중 축소 검토",
    ma5: 193.2,
    ma10: 198.5,
    ma20: 202.3,
    ma60: 210.8,
  },
  {
    ticker: "000660.KS",
    name: "SK하이닉스",
    market: "KR",
    owned: true,
    price: "₩188,300",
    change: 1.13,
    score: 95,
    grade: "A",
    recommendation: "비중 확대 후보",
    ma5: 185000,
    ma10: 181000,
    ma20: 176000,
    ma60: 159000,
  },
  {
    ticker: "298040.KS",
    name: "효성중공업",
    market: "KR",
    owned: false,
    price: "₩2,145,000",
    change: -0.92,
    score: 79,
    grade: "B+",
    recommendation: "비중 확대 관찰",
    ma5: 2100000,
    ma10: 2050000,
    ma20: 1980000,
    ma60: 1750000,
  },
];

export default function Home() {
  const [activeTab, setActiveTab] =
    useState<Tab>("US_OWNED");

  const [expandedTicker, setExpandedTicker] =
    useState<string | null>(null);

  const filteredStocks = useMemo(() => {
    return stocks
      .filter((stock) => {
        if (activeTab === "US_OWNED") {
          return stock.market === "US" && stock.owned;
        }

        if (activeTab === "US_WATCH") {
          return stock.market === "US" && !stock.owned;
        }

        if (activeTab === "KR_OWNED") {
          return stock.market === "KR" && stock.owned;
        }

        return stock.market === "KR" && !stock.owned;
      })
      .sort((a, b) => b.score - a.score);
  }, [activeTab]);

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

            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-2xl"
              aria-label="종목 추가"
            >
              +
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto px-3 pb-3">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setExpandedTicker(null);
                }}
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
          <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="text-xs text-zinc-500">
              추세 상위
            </div>

            {filteredStocks[0] ? (
              <>
                <div className="mt-2 flex items-end justify-between">
                  <div>
                    <div className="text-xl font-semibold">
                      {filteredStocks[0].name}
                    </div>

                    <div className="mt-1 text-sm text-zinc-500">
                      {filteredStocks[0].ticker}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {filteredStocks[0].score}
                    </div>

                    <div className="text-sm text-zinc-400">
                      {filteredStocks[0].grade}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-sm text-zinc-300">
                  {filteredStocks[0].recommendation}
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm text-zinc-500">
                등록된 종목이 없습니다.
              </div>
            )}
          </div>

          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">
              종목 목록
            </h2>

            <span className="text-xs text-zinc-500">
              점수 높은 순
            </span>
          </div>

          <div>
            {filteredStocks.map((stock) => {
              const expanded =
                expandedTicker === stock.ticker;

              return (
                <article
                  key={stock.ticker}
                  className="border-b border-zinc-800"
                >
                  <div className="flex items-center gap-3 py-4">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTicker(
                          expanded
                            ? null
                            : stock.ticker
                        )
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold">
                        {stock.ticker.slice(0, 2)}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {stock.name}
                        </div>

                        <div className="mt-1 text-xs text-zinc-500">
                          {stock.ticker}
                        </div>
                      </div>
                    </button>

                    <div className="text-right">
                      <div className="text-sm">
                        {stock.price}
                      </div>

                      <div
                        className={`mt-1 text-sm ${
                          stock.change >= 0
                            ? "text-red-400"
                            : "text-blue-400"
                        }`}
                      >
                        {stock.change >= 0 ? "+" : ""}
                        {stock.change.toFixed(2)}%
                      </div>
                    </div>

                    <div className="w-10 text-center">
                      <div className="text-sm font-semibold">
                        {stock.score}
                      </div>

                      <div className="text-xs text-zinc-500">
                        {stock.grade}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700"
                      aria-label={`${stock.name} 차트 보기`}
                    >
                      📈
                    </button>
                  </div>

                  {expanded && (
                    <div className="pb-4">
                      <div className="grid grid-cols-4 overflow-hidden rounded-xl border border-zinc-800">
                        <MABox
                          title="5일"
                          value={stock.ma5}
                          currentPrice={stock.price}
                        />

                        <MABox
                          title="10일"
                          value={stock.ma10}
                          currentPrice={stock.price}
                        />

                        <MABox
                          title="20일"
                          value={stock.ma20}
                          currentPrice={stock.price}
                        />

                        <MABox
                          title="60일"
                          value={stock.ma60}
                          currentPrice={stock.price}
                        />
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="text-zinc-400">
                          {stock.recommendation}
                        </span>

                        <span className="text-zinc-500">
                          {stock.score}점 · {stock.grade}
                        </span>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function MABox({
  title,
  value,
}: {
  title: string;
  value: number;
  currentPrice: string;
}) {
  return (
    <div className="border-r border-zinc-800 px-2 py-3 text-center last:border-r-0">
      <div className="text-xs text-zinc-500">
        {title}
      </div>

      <div className="mt-2 truncate text-xs">
        {value.toLocaleString()}
      </div>

      <div className="mt-2 text-[11px] text-red-400">
        현재가 위
      </div>
    </div>
  );
}