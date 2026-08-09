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

type StockQuote = {
  ticker: string;
  price: number;

  change: {
    d1: number | null;
    d5: number | null;
    d20: number | null;
    d60: number | null;
  };

  ma: {
    ma5: number | null;
    ma10: number | null;
    ma20: number | null;
    ma60: number | null;
  };

  trendData: {
    ma20Rising: boolean;
    ma60Rising: boolean;
  };

  events: {
    crossedAboveMa20: boolean;
    crossedBelowMa20: boolean;
    crossedBelowMa60: boolean;
  };

  volume: {
    current: number | null;
    avg20: number | null;
    ratio: number | null;
  };

  benchmark: {
    ticker: string;
    d20: number | null;
    d60: number | null;
  };

  relativeStrength: {
    rs20: number | null;
    rs60: number | null;
  };

  currency: string;
  exchange: string;
};

type StockSearchResult = {
  ticker: string;
  name: string;
  exchange: string;
  type: string;
  market: Market;
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

function getTrend(
  ma5: number | null,
  ma10: number | null,
  ma20: number | null,
  ma60: number | null
) {
  if (
    ma5 === null ||
    ma10 === null ||
    ma20 === null ||
    ma60 === null
  ) {
    return "데이터 부족";
  }

  if (ma5 > ma10 && ma10 > ma20 && ma20 > ma60) {
    return "정배열";
  }

  if (ma5 < ma10 && ma10 < ma20 && ma20 < ma60) {
    return "역배열";
  }

  return "혼합";
}

function calculateScore(quote: StockQuote) {
  let score = 0;

  const {
    ma5,
    ma10,
    ma20,
    ma60,
  } = quote.ma;

  /*
    1. 이평선 배열: 최대 30점
  */
  if (
    ma5 !== null &&
    ma10 !== null &&
    ma20 !== null &&
    ma60 !== null
  ) {
    // 완전 정배열
    if (
      ma5 > ma10 &&
      ma10 > ma20 &&
      ma20 > ma60
    ) {
      score += 30;
    } else {
      // 부분 정배열
      if (quote.price > ma20) score += 8;
      if (quote.price > ma60) score += 8;
      if (ma5 >= ma10) score += 5;
      if (ma10 >= ma20) score += 5;
      if (ma20 >= ma60) score += 5;

      // 부분점수 최대 30점
      score = Math.min(score, 30);
    }
  }

  /*
    2. 이평선 기울기: 최대 24점
  */
  if (quote.trendData.ma20Rising) {
    score += 12;
  }

  if (quote.trendData.ma60Rising) {
    score += 12;
  }

  /*
    3. 상대강도: 최대 36점
  */
  const rs20 =
    quote.relativeStrength.rs20;

  const rs60 =
    quote.relativeStrength.rs60;

  if (rs20 !== null) {
    if (rs20 > 0) {
      score += 12;
    }

    if (rs20 >= 5) {
      score += 6;
    }
  }

  if (rs60 !== null) {
    if (rs60 > 0) {
      score += 12;
    }

    if (rs60 >= 10) {
      score += 6;
    }
  }

  /*
  4. 거래량: 최대 10점
*/
  const volumeRatio = quote.volume.ratio;

  if (volumeRatio !== null) {
    if (volumeRatio >= 2) {
      score += 10;
    } else if (volumeRatio >= 1.5) {
      score += 6;
    } else if (volumeRatio <= 0.7) {
      score -= 3;
    }
  }

  /*
    5. 이벤트
  */
  if (quote.events.crossedAboveMa20) {
    score += 8;
  }

  if (quote.events.crossedBelowMa20) {
    score -= 20;
  }

  if (quote.events.crossedBelowMa60) {
    score -= 35;
  }

  /*
    최종점수 0~100
  */
  return Math.max(
    0,
    Math.min(100, score)
  );
}

function getGrade(score: number) {
  if (score >= 80) return "A";
  if (score >= 65) return "B+";
  if (score >= 50) return "B";
  if (score >= 35) return "C";

  return "D";
}

function getTrendRank(quote: StockQuote) {
  const trend = getTrend(
    quote.ma.ma5,
    quote.ma.ma10,
    quote.ma.ma20,
    quote.ma.ma60
  );

  if (trend === "정배열") return 3;
  if (trend === "혼합") return 2;
  if (trend === "역배열") return 1;

  return 0;
}

function getRelativeStrengthRank(quote: StockQuote) {
  const rs20 = quote.relativeStrength.rs20 ?? -999;
  const rs60 = quote.relativeStrength.rs60 ?? -999;

  return rs20 + rs60;
}

function getSlopeRank(quote: StockQuote) {
  let rank = 0;

  if (quote.trendData.ma20Rising) {
    rank += 1;
  }

  if (quote.trendData.ma60Rising) {
    rank += 1;
  }

  return rank;
}

function getRecommendation(
  quote: StockQuote,
  score: number
) {
  /*
    매매 이벤트가 있으면 최우선
  */
  if (quote.events.crossedBelowMa60) {
    return "전량 매도 검토";
  }

  if (quote.events.crossedBelowMa20) {
    return "30% 매도 검토";
  }

  if (quote.events.crossedAboveMa20) {
    return "재매수 후보";
  }

  /*
    이벤트가 없는 평상시에는 점수 기준
  */
  if (score >= 80) {
    return "비중 확대 후보";
  }

  if (score >= 65) {
    return "비중 확대 관찰";
  }

  if (score >= 50) {
    return "관망";
  }

  if (score >= 35) {
    return "비중 축소 관찰";
  }

  return "비중 축소 후보";
}

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] =
    useState<Tab>("US_OWNED");

  const [stocks, setStocks] =
    useState<UserStock[]>([]);

  const [quotes, setQuotes] =
    useState<Record<string, StockQuote>>({});

  const [loading, setLoading] =
    useState(true);

  const [showAdd, setShowAdd] =
    useState(false);

  const [expandedStockId, setExpandedStockId] =
    useState<number | null>(null);

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

  const [searchQuery, setSearchQuery] =
    useState("");

  const [searchResults, setSearchResults] =
    useState<StockSearchResult[]>([]);

  const [searching, setSearching] =
    useState(false);

  async function searchStocks() {
    const query = searchQuery.trim();

    if (!query) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/stocks/search?q=${encodeURIComponent(query)}`
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "종목 검색에 실패했습니다.");
        setSearchResults([]);
        return;
      }

      setSearchResults(data.results ?? []);
    } catch {
      setMessage("종목 검색 중 오류가 발생했습니다.");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function selectStock(stock: StockSearchResult) {
    setTicker(stock.ticker);
    setName(stock.name);
    setMarket(stock.market);
    setSearchResults([]);
  }

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

    const loadedStocks =
      (data ?? []) as UserStock[];

    setStocks(loadedStocks);

    await loadQuotes(loadedStocks);

    setLoading(false);
  }

  async function loadQuotes(stockList: UserStock[]) {
    if (stockList.length === 0) {
      setQuotes({});
      return;
    }

    try {
      const entries = await Promise.all(
        stockList.map(async (stock) => {
          try {
            const response = await fetch(
              `/api/stocks/quote?ticker=${encodeURIComponent(
                stock.ticker
              )}`,
              {
                cache: "no-store",
              }
            );

            if (!response.ok) {
              return [stock.ticker, null] as const;
            }

            const data: StockQuote = await response.json();

            return [stock.ticker, data] as const;
          } catch {
            return [stock.ticker, null] as const;
          }
        })
      );

      const nextQuotes: Record<string, StockQuote> = {};

      for (const [ticker, quote] of entries) {
        if (quote) {
          nextQuotes[ticker] = quote;
        }
      }

      setQuotes(nextQuotes);
    } catch (error) {
      console.error("시세 조회 실패:", error);
    }
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
    setSearchQuery("");
    setSearchResults([]);
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

  const filteredStocks = useMemo(() => {
    const filtered = stocks.filter((stock) => {
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
    });

    return [...filtered].sort((a, b) => {
      const quoteA = quotes[a.ticker];
      const quoteB = quotes[b.ticker];

      // 시세가 없는 종목은 맨 아래
      if (!quoteA && !quoteB) return 0;
      if (!quoteA) return 1;
      if (!quoteB) return -1;

      // 1. 점수
      const scoreA = calculateScore(quoteA);
      const scoreB = calculateScore(quoteB);

      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      // 2. 정배열 → 혼합 → 역배열
      const trendA = getTrendRank(quoteA);
      const trendB = getTrendRank(quoteB);

      if (trendA !== trendB) {
        return trendB - trendA;
      }

      // 3. 상대강도
      const rsA = getRelativeStrengthRank(quoteA);
      const rsB = getRelativeStrengthRank(quoteB);

      if (rsA !== rsB) {
        return rsB - rsA;
      }

      // 4. MA20 / MA60 기울기
      const slopeA = getSlopeRank(quoteA);
      const slopeB = getSlopeRank(quoteB);

      if (slopeA !== slopeB) {
        return slopeB - slopeA;
      }

      // 5. 거래량 배수
      const volumeA = quoteA.volume.ratio ?? -1;
      const volumeB = quoteB.volume.ratio ?? -1;

      return volumeB - volumeA;
    });
  }, [stocks, quotes, activeTab]);

  const recommendationOrder = [
    "비중 확대 후보",
    "재매수 후보",
    "비중 확대 관찰",
    "관망",
    "비중 축소 관찰",
    "30% 매도 검토",
    "비중 축소 후보",
    "전량 매도 검토",
  ];

  const groupedStocks = recommendationOrder
    .map((recommendation) => ({
      recommendation,
      stocks: filteredStocks.filter((stock) => {
        const quote = quotes[stock.ticker];

        if (!quote) {
          return false;
        }

        const score = calculateScore(quote);

        return (
          getRecommendation(quote, score) ===
          recommendation
        );
      }),
    }))
    .filter((group) => group.stocks.length > 0);

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
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm ${activeTab === tab.key
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
              {groupedStocks.map((group) => (
                <div key={group.recommendation} className="mb-6">
                  <div className="mb-2 flex items-center justify-between">
                    <h3
                      className={`text-sm font-semibold ${group.recommendation === "비중 확대 후보"
                        ? "text-green-400"
                        : group.recommendation === "비중 확대 관찰"
                          ? "text-emerald-300"
                          : group.recommendation === "관망"
                            ? "text-zinc-300"
                            : group.recommendation.includes("매도")
                              ? "text-red-400"
                              : "text-yellow-400"
                        }`}
                    >
                      {group.recommendation}
                    </h3>

                    <span className="text-xs text-zinc-600">
                      {group.stocks.length}개
                    </span>
                  </div>

                  {group.stocks.map((stock) => {
                    const quote = quotes[stock.ticker];

                    const trend = quote
                      ? getTrend(
                        quote.ma.ma5,
                        quote.ma.ma10,
                        quote.ma.ma20,
                        quote.ma.ma60
                      )
                      : "데이터 부족";

                    const score = quote
                      ? calculateScore(quote)
                      : null;

                    const grade =
                      score !== null
                        ? getGrade(score)
                        : null;

                    const recommendation =
                      quote && score !== null
                        ? getRecommendation(quote, score)
                        : null;

                    const eventBadge = quote
                      ? quote.events.crossedBelowMa60
                        ? "🚨 60MA 이탈"
                        : quote.events.crossedBelowMa20
                          ? "⚠️ 20MA 이탈"
                          : quote.events.crossedAboveMa20 &&
                            (quote.volume.ratio ?? 0) >= 2
                            ? "🚀 20MA 돌파 + 거래량"
                            : quote.events.crossedAboveMa20
                              ? "⭐ 20MA 돌파"
                              : null
                      : null;

                    const changeColor = (value: number | null) => {
                      if (value === null) return "text-zinc-500";
                      if (value > 0) return "text-red-400";
                      if (value < 0) return "text-blue-400";
                      return "text-zinc-400";
                    };

                    const formatChange = (value: number | null) => {
                      if (value === null) return "-";

                      return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
                    };

                    return (
                      <div
                        key={stock.id}
                        className="border-b border-zinc-800 py-4"
                      >
                        {/* 위쪽: 종목명 / 현재가 / 삭제 */}
                        <div
                          className="flex cursor-pointer items-center gap-3"
                          onClick={() =>
                            setExpandedStockId(
                              expandedStockId === stock.id
                                ? null
                                : stock.id
                            )
                          }
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold">
                            {stock.ticker.slice(0, 2)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              {stock.name}
                            </div>

                            <div className="mt-1 text-xs text-zinc-500">
                              {stock.ticker}
                            </div>

                            {eventBadge && (
                              <div className="mt-1 text-xs font-medium text-yellow-400">
                                {eventBadge}
                              </div>
                            )}
                          </div>

                          <div className="min-w-[80px] text-right">
                            {quote ? (
                              <>
                                <div className="text-sm font-medium text-white">
                                  {stock.market === "US" ? "$" : "₩"}
                                  {quote.price.toLocaleString(
                                    stock.market === "US"
                                      ? "en-US"
                                      : "ko-KR",
                                    {
                                      maximumFractionDigits:
                                        stock.market === "US" ? 2 : 0,
                                    }
                                  )}
                                </div>

                                <div
                                  className={`mt-1 text-xs ${changeColor(
                                    quote.change.d1
                                  )}`}
                                >
                                  {formatChange(quote.change.d1)}
                                </div>
                              </>
                            ) : (
                              <div className="text-xs text-zinc-600">
                                시세 없음
                              </div>
                            )}
                          </div>
                        
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();

                              router.push(
                                `/chart/${encodeURIComponent(
                                  stock.ticker
                                )}?name=${encodeURIComponent(
                                  stock.name
                                )}`
                              );
                            }}
                            className="shrink-0 rounded-lg border border-zinc-700 px-2 py-2 text-xs text-zinc-300"
                          >
                            차트
                          </button>

                          <button
                            onClick={(event) => {
                              event.stopPropagation();

                              void handleDeleteStock(
                                stock.id,
                                stock.name
                              );
                            }}
                            className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300"
                          >
                            삭제
                          </button>
                        </div>

                        {/* 아래쪽: 상세 지표 */}
                        {quote && (
                          <>
                            <div className="ml-14 mt-3 grid grid-cols-3 gap-x-3 gap-y-2 text-xs">
                              <div>
                                <span className="text-zinc-500">5D </span>
                                <span className={changeColor(quote.change.d5)}>
                                  {formatChange(quote.change.d5)}
                                </span>
                              </div>

                              <div>
                                <span className="text-zinc-500">20D </span>
                                <span className={changeColor(quote.change.d20)}>
                                  {formatChange(quote.change.d20)}
                                </span>
                              </div>

                              <div>
                                <span className="text-zinc-500">60D </span>
                                <span className={changeColor(quote.change.d60)}>
                                  {formatChange(quote.change.d60)}
                                </span>
                              </div>

                              <div>
                                <span className="text-zinc-500">MA20 </span>
                                <span
                                  className={
                                    quote.ma.ma20 !== null &&
                                      quote.price >= quote.ma.ma20
                                      ? "text-green-400"
                                      : "text-red-400"
                                  }
                                >
                                  {quote.ma.ma20 === null
                                    ? "-"
                                    : quote.price >= quote.ma.ma20
                                      ? "위"
                                      : "아래"}
                                </span>
                              </div>

                              <div>
                                <span className="text-zinc-500">MA60 </span>
                                <span
                                  className={
                                    quote.ma.ma60 !== null &&
                                      quote.price >= quote.ma.ma60
                                      ? "text-green-400"
                                      : "text-red-400"
                                  }
                                >
                                  {quote.ma.ma60 === null
                                    ? "-"
                                    : quote.price >= quote.ma.ma60
                                      ? "위"
                                      : "아래"}
                                </span>
                              </div>

                              <div>
                                <span className="text-zinc-500">VOL </span>
                                <span className="text-zinc-300">
                                  {quote.volume.ratio !== null
                                    ? `${quote.volume.ratio.toFixed(1)}x`
                                    : "-"}
                                </span>
                              </div>
                            </div>

                            <div className="ml-14 mt-3 flex items-center justify-between">
                              <span
                                className={`rounded-md px-2 py-1 text-xs font-medium ${trend === "정배열"
                                  ? "bg-green-500/10 text-green-400"
                                  : trend === "역배열"
                                    ? "bg-red-500/10 text-red-400"
                                    : trend === "혼합"
                                      ? "bg-yellow-500/10 text-yellow-400"
                                      : "bg-zinc-800 text-zinc-500"
                                  }`}
                              >
                                {trend}
                              </span>

                              {score !== null && grade && (
                                <div className="text-sm font-semibold">
                                  <span className="text-white">
                                    {score}점
                                  </span>

                                  <span className="ml-2 text-zinc-500">
                                    ·
                                  </span>

                                  <span className="ml-2 text-green-400">
                                    {grade}
                                  </span>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
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
                    setSearchQuery("");
                    setSearchResults([]);
                    setTicker("");
                    setName("");
                  }}
                  className="text-xl text-zinc-400"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 space-y-4">

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    티커 검색
                  </label>

                  <div className="flex gap-2">
                    <input
                      value={searchQuery}
                      onChange={(event) =>
                        setSearchQuery(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void searchStocks();
                        }
                      }}
                      placeholder="AVGO, AAPL, 005930.KS..."
                      className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => void searchStocks()}
                      className="rounded-xl bg-zinc-700 px-4 text-sm"
                    >
                      {searching ? "검색 중" : "검색"}
                    </button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950">
                      {searchResults.map((stock) => (
                        <button
                          key={`${stock.ticker}-${stock.exchange}`}
                          type="button"
                          onClick={() => selectStock(stock)}
                          className="flex w-full items-center justify-between border-b border-zinc-800 px-4 py-3 text-left last:border-b-0"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {stock.name}
                            </div>

                            <div className="mt-1 text-xs text-zinc-500">
                              {stock.ticker} · {stock.exchange}
                            </div>
                          </div>

                          <span className="ml-3 text-xs text-zinc-500">
                            {stock.market === "US" ? "해외" : "국내"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {ticker && (
                  <div className="space-y-4 rounded-xl border border-zinc-700 bg-zinc-950 p-4">
                    <div>
                      <div className="text-xs text-zinc-500">
                        선택한 종목
                      </div>

                      <div className="mt-2 text-sm text-zinc-400">
                        {ticker}
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-zinc-400">
                        표시 이름
                      </label>

                      <input
                        value={name}
                        onChange={(event) =>
                          setName(event.target.value)
                        }
                        placeholder="예: 브로드컴"
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none"
                      />
                    </div>

                    <div className="text-xs text-zinc-600">
                      티커는 주가 조회에 사용되므로 변경할 수 없습니다.
                    </div>
                  </div>
                )}

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
                      className={`rounded-xl py-3 text-sm ${market === "US"
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
                      className={`rounded-xl py-3 text-sm ${market === "KR"
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
                      className={`rounded-xl py-3 text-sm ${owned
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
                      className={`rounded-xl py-3 text-sm ${!owned
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