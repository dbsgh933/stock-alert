"use client";

import {
    CandlestickSeries,
    ColorType,
    createChart,
    createSeriesMarkers,
    HistogramSeries,
    LineSeries,
    type ISeriesApi,
    type Time,
} from "lightweight-charts";

import {
    useEffect,
    useRef,
    useState,
} from "react";

import {
    useParams,
    useRouter,
    useSearchParams,
} from "next/navigation";

type HistoryPoint = {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    adjustedClose: number;
    volume: number;
};

type HistoryResponse = {
    ticker: string;

    meta: {
        symbol?: string;
        name?: string;
        exchange?: string;
        currency?: string;
    };

    history: HistoryPoint[];
};

type Period = "1M" | "3M" | "6M" | "1Y";

type SelectedInfo = {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    ma5: number | null;
    ma10: number | null;
    ma20: number | null;
    ma60: number | null;
};

function calculateMA(
    data: HistoryPoint[],
    period: number
) {
    return data
        .map((item, index) => {
            if (index < period - 1) {
                return null;
            }

            const values = data
                .slice(index - period + 1, index + 1)
                .map((point) => point.adjustedClose);

            const average =
                values.reduce(
                    (sum, value) => sum + value,
                    0
                ) / period;

            return {
                time: item.date as Time,
                value: average,
            };
        })
        .filter(
            (
                item
            ): item is {
                time: Time;
                value: number;
            } => item !== null
        );
}

function findMA20Events(
    data: HistoryPoint[],
    ma20Data: {
        time: Time;
        value: number;
    }[]
) {
    const maMap = new Map(
        ma20Data.map((item) => [
            String(item.time),
            item.value,
        ])
    );

    const markers: {
        time: Time;
        position: "aboveBar" | "belowBar";
        color: string;
        shape: "arrowUp" | "arrowDown";
        text: string;
    }[] = [];

    for (let i = 1; i < data.length; i++) {
        const previous = data[i - 1];
        const current = data[i];

        const previousMa =
            maMap.get(previous.date);

        const currentMa =
            maMap.get(current.date);

        if (
            previousMa === undefined ||
            currentMa === undefined
        ) {
            continue;
        }

        const crossedAbove =
            previous.close <= previousMa &&
            current.close > currentMa;

        const crossedBelow =
            previous.close >= previousMa &&
            current.close < currentMa;

        if (crossedAbove) {
            markers.push({
                time: current.date as Time,
                position: "belowBar",
                color: "#22c55e",
                shape: "arrowUp",
                text: "20MA 돌파",
            });
        }

        if (crossedBelow) {
            markers.push({
                time: current.date as Time,
                position: "aboveBar",
                color: "#ef4444",
                shape: "arrowDown",
                text: "20MA 이탈",
            });
        }
    }

    return markers;
}
function formatVolume(value: number) {
    if (value >= 1_000_000_000) {
        return `${(value / 1_000_000_000).toFixed(1)}B`;
    }

    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
    }

    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}K`;
    }

    return value.toString();
}

export default function ChartPage() {
    const params =
        useParams<{ ticker: string }>();

    const router = useRouter();

    const [usdKrw, setUsdKrw] =
        useState<number | null>(null);

    const searchParams = useSearchParams();

    const savedName =
        searchParams.get("name")?.trim() ?? "";

    const ticker =
        decodeURIComponent(params.ticker);

    const chartContainerRef =
        useRef<HTMLDivElement | null>(null);

    const chartRef = useRef<
        ReturnType<typeof createChart> | null
    >(null);

    const ma5Ref =
        useRef<ISeriesApi<"Line"> | null>(null);

    const ma10Ref =
        useRef<ISeriesApi<"Line"> | null>(null);

    const ma20Ref =
        useRef<ISeriesApi<"Line"> | null>(null);

    const ma60Ref =
        useRef<ISeriesApi<"Line"> | null>(null);

    const [data, setData] =
        useState<HistoryPoint[]>([]);

    const [stockName, setStockName] =
        useState("");

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [period, setPeriod] =
        useState<Period>("6M");

    const [showMa5, setShowMa5] =
        useState(true);

    const [showMa10, setShowMa10] =
        useState(true);

    const [showMa20, setShowMa20] =
        useState(true);

    const [showMa60, setShowMa60] =
        useState(true);

    const [selectedInfo, setSelectedInfo] =
        useState<SelectedInfo | null>(null);

    useEffect(() => {
        async function loadChart() {
            try {
                setLoading(true);
                setError("");

                const response = await fetch(
                    `/api/stocks/history?ticker=${encodeURIComponent(
                        ticker
                    )}`
                );

                const result:
                    HistoryResponse & {
                        error?: string;
                    } = await response.json();

                if (!response.ok) {
                    setError(
                        result.error ??
                        "차트 조회에 실패했습니다."
                    );

                    return;
                }

                setData(result.history ?? []);
                setStockName(result.meta?.name ?? ticker);
            } catch {
                setError(
                    "차트 조회 중 오류가 발생했습니다."
                );
            } finally {
                setLoading(false);
            }
        }

        void loadChart();
    }, [ticker]);

    useEffect(() => {
        async function loadExchangeRate() {
            try {
                const response = await fetch(
                    "/api/exchange-rate",
                    {
                        cache: "no-store",
                    }
                );

                const result = await response.json();

                if (
                    response.ok &&
                    typeof result.rate === "number"
                ) {
                    setUsdKrw(result.rate);
                }
            } catch (error) {
                console.error(
                    "환율 조회 실패:",
                    error
                );
            }
        }

        void loadExchangeRate();
    }, []);

    useEffect(() => {
        if (
            !chartContainerRef.current ||
            data.length === 0
        ) {
            return;
        }

        const container =
            chartContainerRef.current;

        const chart = createChart(container, {
            width: container.clientWidth,
            height: 480,

            layout: {
                background: {
                    type: ColorType.Solid,
                    color: "#18181b",
                },

                textColor: "#a1a1aa",

                panes: {
                    separatorColor: "#3f3f46",
                    separatorHoverColor: "#52525b",
                    enableResize: true,
                },
            },

            grid: {
                vertLines: {
                    color: "#27272a",
                },

                horzLines: {
                    color: "#27272a",
                },
            },

            rightPriceScale: {
                borderColor: "#3f3f46",
            },

            timeScale: {
                borderColor: "#3f3f46",
            },
        });

        chartRef.current = chart;

        const candleSeries =
            chart.addSeries(
                CandlestickSeries,
                {
                    upColor: "#ef4444",
                    downColor: "#3b82f6",

                    borderUpColor: "#ef4444",
                    borderDownColor: "#3b82f6",

                    wickUpColor: "#ef4444",
                    wickDownColor: "#3b82f6",

                    priceFormat,
                },
                0
            );

        candleSeries.setData(
            data.map((item) => ({
                time: item.date as Time,
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
            }))
        );

        const ma5Data =
            calculateMA(data, 5);

        const ma10Data =
            calculateMA(data, 10);

        const ma20Data =
            calculateMA(data, 20);

        const ma60Data =
            calculateMA(data, 60);

        const ma5Series = chart.addSeries(
            LineSeries,
            {
                color: "#ef4444", // 빨강
                lineWidth: 2,
                priceLineVisible: false,
                lastValueVisible: false,
                visible: showMa5,
                priceFormat,
            },
            0
        );

        const ma10Series = chart.addSeries(
            LineSeries,
            {
                color: "#f97316", // 주황
                lineWidth: 2,
                priceLineVisible: false,
                lastValueVisible: false,
                visible: showMa10,
                priceFormat,
            },
            0
        );

        const ma20Series = chart.addSeries(
            LineSeries,
            {
                color: "#facc15", // 노랑
                lineWidth: 2,
                priceLineVisible: false,
                lastValueVisible: false,
                visible: showMa20,
                priceFormat,
            },
            0
        );

        const ma60Series = chart.addSeries(
            LineSeries,
            {
                color: "#22c55e", // 초록
                lineWidth: 2,
                priceLineVisible: false,
                lastValueVisible: false,
                visible: showMa60,
                priceFormat,
            },
            0
        );

        ma5Series.setData(ma5Data);
        ma10Series.setData(ma10Data);
        ma20Series.setData(ma20Data);
        ma60Series.setData(ma60Data);

        ma5Ref.current = ma5Series;
        ma10Ref.current = ma10Series;
        ma20Ref.current = ma20Series;
        ma60Ref.current = ma60Series;

        /*
          20일선 돌파 / 이탈 마커
        
        const markers =
            findMA20Events(
                data,
                ma20Data
            );

        createSeriesMarkers(
            candleSeries,
            markers
        );
        */

        /*
          거래량 별도 pane
        */
        const volumeSeries = chart.addSeries(
            HistogramSeries,
            {
                priceFormat: {
                    type: "volume",
                },

                priceScaleId: "right",

                lastValueVisible: false,
                priceLineVisible: false,
            },
            1
        );

        volumeSeries.setData(
            data.map((item) => ({
                time: item.date as Time,
                value: item.volume,

                color:
                    item.close >= item.open
                        ? "rgba(239, 68, 68, 0.65)"
                        : "rgba(59, 130, 246, 0.65)",
            }))
        );

        /*
          위: 주가 차트
          아래: 거래량
        */
        requestAnimationFrame(() => {
            const panes = chart.panes();

            if (panes[0]) {
                panes[0].setHeight(365);
            }

            if (panes[1]) {
                panes[1].setHeight(90);
            }
        });

        /*
          pane 높이 지정
        */
        requestAnimationFrame(() => {
            const panes = chart.panes();

            if (panes[0]) {
                panes[0].setHeight(400);
            }

            if (panes[1]) {
                panes[1].setHeight(120);
            }
        });

        volumeSeries.setData(
            data.map((item) => ({
                time: item.date as Time,

                value: item.volume,

                color:
                    item.close >= item.open
                        ? "rgba(239,68,68,0.65)"
                        : "rgba(59,130,246,0.65)",
            }))
        );

        const panes = chart.panes();

        if (panes[0]) {
            panes[0].setHeight(420);
        }

        if (panes[1]) {
            panes[1].setHeight(110);
        }

        /*
          크로스헤어 정보
        */
        chart.subscribeCrosshairMove(
            (param) => {
                if (!param.time) {
                    return;
                }

                const date =
                    String(param.time);

                const source =
                    data.find(
                        (item) =>
                            item.date === date
                    );

                if (!source) {
                    return;
                }

                const ma5 =
                    ma5Data.find(
                        (item) =>
                            String(item.time) === date
                    )?.value ?? null;

                const ma10 =
                    ma10Data.find(
                        (item) =>
                            String(item.time) === date
                    )?.value ?? null;

                const ma20 =
                    ma20Data.find(
                        (item) =>
                            String(item.time) === date
                    )?.value ?? null;

                const ma60 =
                    ma60Data.find(
                        (item) =>
                            String(item.time) === date
                    )?.value ?? null;

                setSelectedInfo({
                    date,
                    open: source.open,
                    high: source.high,
                    low: source.low,
                    close: source.close,
                    volume: source.volume,
                    ma5,
                    ma10,
                    ma20,
                    ma60,
                });
            }
        );

        const resizeObserver =
            new ResizeObserver(() => {
                chart.applyOptions({
                    width:
                        container.clientWidth,
                });
            });

        resizeObserver.observe(
            container
        );

        return () => {
            resizeObserver.disconnect();

            chart.remove();

            chartRef.current = null;
            ma5Ref.current = null;
            ma10Ref.current = null;
            ma20Ref.current = null;
            ma60Ref.current = null;
        };
    }, [data]);

    /*
      기간 버튼
    */
    useEffect(() => {
        const chart = chartRef.current;

        if (
            !chart ||
            data.length === 0
        ) {
            return;
        }

        const count =
            period === "1M"
                ? 22
                : period === "3M"
                    ? 66
                    : period === "6M"
                        ? 132
                        : 260;

        const visible =
            data.slice(-count);

        if (visible.length === 0) {
            return;
        }

        chart
            .timeScale()
            .setVisibleRange({
                from:
                    visible[0]
                        .date as Time,

                to:
                    visible[
                        visible.length - 1
                    ].date as Time,
            });
    }, [period, data]);

    useEffect(() => {
        ma5Ref.current?.applyOptions({
            visible: showMa5,
        });
    }, [showMa5]);

    useEffect(() => {
        ma10Ref.current?.applyOptions({
            visible: showMa10,
        });
    }, [showMa10]);

    useEffect(() => {
        ma20Ref.current?.applyOptions({
            visible: showMa20,
        });
    }, [showMa20]);

    useEffect(() => {
        ma60Ref.current?.applyOptions({
            visible: showMa60,
        });
    }, [showMa60]);

    const latest =
        data[data.length - 1];

    const previous =
        data[data.length - 2];

    const changePercent =
        latest && previous
            ? ((latest.close -
                previous.close) /
                previous.close) *
            100
            : null;

    const changeAmount =
        latest && previous
            ? latest.close - previous.close
            : null;

    const periodCount =
        period === "1M"
            ? 22
            : period === "3M"
                ? 66
                : period === "6M"
                    ? 132
                    : 260;

    const periodStartIndex =
        Math.max(0, data.length - periodCount);

    const periodStart =
        data[periodStartIndex];

    const periodChangePercent =
        latest && periodStart
            ? ((latest.close - periodStart.close) /
                periodStart.close) *
            100
            : null;

    const periodLabel =
        period === "1M"
            ? "1개월"
            : period === "3M"
                ? "3개월"
                : period === "6M"
                    ? "6개월"
                    : "1년";
    const isKoreanStock =
        ticker.endsWith(".KS") ||
        ticker.endsWith(".KQ");

    const priceFormat = isKoreanStock
        ? {
            type: "price" as const,
            precision: 0,
            minMove: 1,
        }
        : {
            type: "price" as const,
            precision: 2,
            minMove: 0.01,
        };

    const currencySymbol =
        isKoreanStock ? "₩" : "$";

    function latestMA(period: number) {
        if (data.length < period) {
            return null;
        }

        const values = data
            .slice(-period)
            .map(
                (item) =>
                    item.adjustedClose
            );

        return (
            values.reduce(
                (sum, value) =>
                    sum + value,
                0
            ) / period
        );
    }

    const displayInfo =
        selectedInfo ?? {
            date: latest?.date ?? "",
            open: latest?.open ?? 0,
            high: latest?.high ?? 0,
            low: latest?.low ?? 0,
            close: latest?.close ?? 0,
            volume: latest?.volume ?? 0,
            ma5: latestMA(5),
            ma10: latestMA(10),
            ma20: latestMA(20),
            ma60: latestMA(60),
        };

    return (
        <main className="min-h-screen bg-[#101014] text-white">
            <div className="mx-auto min-h-screen max-w-2xl px-4 py-5">

                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() =>
                            router.back()
                        }
                        className="rounded-lg border border-zinc-700 px-3 py-2 text-sm"
                    >
                        ← 뒤로
                    </button>

                    <div className="text-right">
                        <div className="text-sm font-medium">
                            차트
                        </div>

                        <div className="text-xs text-zinc-500">
                            일봉
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="py-20 text-center text-sm text-zinc-500">
                        차트 불러오는 중...
                    </div>
                ) : error ? (
                    <div className="py-20 text-center text-sm text-red-400">
                        {error}
                    </div>
                ) : data.length === 0 ? (
                    <div className="py-20 text-center text-sm text-zinc-500">
                        차트 데이터가 없습니다.
                    </div>
                ) : (
                    <>
                        <div className="mt-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-lg font-semibold">
                                        {savedName || stockName}
                                    </div>

                                    <div className="mt-0.5 text-xs text-zinc-500">
                                        {ticker}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <div className="text-2xl font-bold">
                                    {currencySymbol}
                                    {latest.close.toLocaleString(
                                        isKoreanStock ? "ko-KR" : "en-US",
                                        {
                                            maximumFractionDigits:
                                                isKoreanStock ? 0 : 2,
                                        }
                                    )}
                                </div>

                                {!isKoreanStock && usdKrw !== null && (
                                    <div className="text-sm text-zinc-500">
                                        (
                                        ₩
                                        {Math.round(
                                            latest.close * usdKrw
                                        ).toLocaleString("ko-KR")}
                                        )
                                    </div>
                                )}

                                {changePercent !== null && (
                                    <div
                                        className={`text-sm font-semibold ${changePercent > 0
                                                ? "text-red-400"
                                                : changePercent < 0
                                                    ? "text-blue-400"
                                                    : "text-zinc-400"
                                            }`}
                                    >
                                        {changePercent > 0 ? "+" : ""}
                                        {changePercent.toFixed(2)}%
                                    </div>
                                )}

                                {periodChangePercent !== null && (
                                    <>
                                        <span className="text-zinc-600">·</span>

                                        <div
                                            className={`text-sm font-semibold ${periodChangePercent > 0
                                                    ? "text-red-400"
                                                    : periodChangePercent < 0
                                                        ? "text-blue-400"
                                                        : "text-zinc-400"
                                                }`}
                                        >
                                            {periodLabel}{" "}
                                            {periodChangePercent > 0 ? "+" : ""}
                                            {periodChangePercent.toFixed(2)}%
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* 기간 */}
                        <div className="mt-5 grid grid-cols-4 gap-2">
                            {(
                                [
                                    "1M",
                                    "3M",
                                    "6M",
                                    "1Y",
                                ] as Period[]
                            ).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() =>
                                        setPeriod(item)
                                    }
                                    className={`rounded-lg py-2 text-xs ${period === item
                                        ? "bg-white text-black"
                                        : "bg-zinc-800 text-zinc-400"
                                        }`}
                                >
                                    {item === "1M"
                                        ? "1개월"
                                        : item === "3M"
                                            ? "3개월"
                                            : item === "6M"
                                                ? "6개월"
                                                : "1년"}
                                </button>
                            ))}
                        </div>

                        {/* MA */}
                        {/* MA */}
                        <div className="mt-2 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setShowMa5(!showMa5)}
                                className={`rounded-lg px-3 py-2 text-xs font-medium ${showMa5
                                    ? "bg-red-500 text-white"
                                    : "bg-zinc-800 text-zinc-500"
                                    }`}
                            >
                                MA5
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowMa10(!showMa10)}
                                className={`rounded-lg px-3 py-2 text-xs font-medium ${showMa10
                                    ? "bg-orange-500 text-white"
                                    : "bg-zinc-800 text-zinc-500"
                                    }`}
                            >
                                MA10
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowMa20(!showMa20)}
                                className={`rounded-lg px-3 py-2 text-xs font-medium ${showMa20
                                    ? "bg-yellow-400 text-black"
                                    : "bg-zinc-800 text-zinc-500"
                                    }`}
                            >
                                MA20
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowMa60(!showMa60)}
                                className={`rounded-lg px-3 py-2 text-xs font-medium ${showMa60
                                    ? "bg-green-500 text-black"
                                    : "bg-zinc-800 text-zinc-500"
                                    }`}
                            >
                                MA60
                            </button>
                        </div>

                        <div className="relative mt-3 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">

                            {/* 차트 내부 정보 */}
                            <div className="pointer-events-none absolute left-3 top-3 z-10 text-[11px]">
                                <div className="text-zinc-500">
                                    {displayInfo.date}
                                </div>

                                <div className="mt-1 flex flex-wrap gap-x-2">
                                    <span className="text-zinc-300">
                                        시 {displayInfo.open.toFixed(2)}
                                    </span>

                                    <span className="text-red-400">
                                        고 {displayInfo.high.toFixed(2)}
                                    </span>

                                    <span className="text-blue-400">
                                        저 {displayInfo.low.toFixed(2)}
                                    </span>

                                    <span className="text-white">
                                        종 {displayInfo.close.toFixed(2)}
                                    </span>
                                </div>

                                <div className="mt-1 flex flex-wrap gap-x-2">
                                    {showMa5 && (
                                        <span className="text-red-400">
                                            MA5 {displayInfo.ma5?.toFixed(2) ?? "-"}
                                        </span>
                                    )}

                                    {showMa10 && (
                                        <span className="text-orange-400">
                                            MA10 {displayInfo.ma10?.toFixed(2) ?? "-"}
                                        </span>
                                    )}

                                    {showMa20 && (
                                        <span className="text-yellow-400">
                                            MA20 {displayInfo.ma20?.toFixed(2) ?? "-"}
                                        </span>
                                    )}

                                    {showMa60 && (
                                        <span className="text-green-400">
                                            MA60 {displayInfo.ma60?.toFixed(2) ?? "-"}
                                        </span>
                                    )}
                                </div>

                                <div className="mt-1 text-zinc-500">
                                    VOL {formatVolume(displayInfo.volume)}
                                </div>
                            </div>

                            <div
                                ref={chartContainerRef}
                                className="w-full"
                            />
                        </div>

                        <div className="mt-3 text-center text-xs text-zinc-600">
                            휠 확대/축소 · 드래그 이동
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}