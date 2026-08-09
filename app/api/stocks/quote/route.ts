import { NextRequest, NextResponse } from "next/server";

type ChartResult = {
    indicators?: {
        quote?: Array<{
            close?: Array<number | null>;
            volume?: Array<number | null>;
        }>;

        adjclose?: Array<{
            adjclose?: Array<number | null>;
        }>;
    };

    meta?: {
        regularMarketPrice?: number;
        currency?: string;
        exchangeName?: string;
    };
};

type ChartData = {
    result: ChartResult;
    closes: number[];
    volumes: Array<number | null>;
    price: number;
};

function average(values: number[]): number | null {
    if (values.length === 0) {
        return null;
    }

    return (
        values.reduce((sum, value) => sum + value, 0) /
        values.length
    );
}

function percentChange(
    current: number,
    previous: number | undefined
): number | null {
    if (
        typeof previous !== "number" ||
        previous === 0
    ) {
        return null;
    }

    return ((current - previous) / previous) * 100;
}

function calculateMAAt(
    closes: number[],
    days: number,
    endOffset = 0
): number | null {
    const end = closes.length - endOffset;

    if (end < days) {
        return null;
    }

    return average(
        closes.slice(end - days, end)
    );
}

function getPreviousClose(
    closes: number[],
    days: number
): number | undefined {
    const index =
        closes.length - 1 - days;

    if (index < 0) {
        return undefined;
    }

    return closes[index];
}

async function fetchChart(
    ticker: string
): Promise<ChartData | null> {
    const url =
        `https://query1.finance.yahoo.com/v8/finance/chart/` +
        `${encodeURIComponent(ticker)}` +
        `?interval=1d&range=6mo`;

    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0",
        },
        cache: "no-store",
    });

    if (!response.ok) {
        return null;
    }

    const data = await response.json();

    const result: ChartResult | undefined =
        data.chart?.result?.[0];

    if (!result) {
        return null;
    }

    const quote =
        result.indicators?.quote?.[0];

    const adjustedCloses =
        result.indicators?.adjclose?.[0]?.adjclose;
    if (!quote) {
        return null;
    }

    const priceSeries =
        adjustedCloses && adjustedCloses.length > 0
            ? adjustedCloses
            : quote.close ?? [];

    const rows = priceSeries
        .map((close, index) => ({
            close,
            volume:
                quote.volume?.[index] ?? null,
        }))
        .filter(
            (
                row
            ): row is {
                close: number;
                volume: number | null;
            } =>
                typeof row.close === "number"
        );

    if (rows.length < 2) {
        return null;
    }

    const closes = rows.map(
        (row) => row.close
    );

    const volumes = rows.map(
        (row) => row.volume
    );

    const latestClose =
        closes[closes.length - 1];

    const price =
        result.meta?.regularMarketPrice ??
        latestClose;

    return {
        result,
        closes,
        volumes,
        price,
    };
}

export async function GET(
    request: NextRequest
) {
    const ticker =
        request.nextUrl.searchParams
            .get("ticker")
            ?.trim()
            .toUpperCase();

    if (!ticker) {
        return NextResponse.json(
            {
                error: "티커가 필요합니다.",
            },
            {
                status: 400,
            }
        );
    }

    try {
        /*
          한국주식이면 KOSPI,
          그 외에는 QQQ를 기준시장으로 사용
        */
        const isKorean =
            ticker.endsWith(".KS") ||
            ticker.endsWith(".KQ");

        const benchmarkTicker =
            isKorean ? "^KS11" : "QQQ";

        /*
          종목 + 기준시장 데이터를
          동시에 가져온다.
        */
        const [
            stockData,
            benchmarkData,
        ] = await Promise.all([
            fetchChart(ticker),
            fetchChart(benchmarkTicker),
        ]);

        if (!stockData) {
            return NextResponse.json(
                {
                    error:
                        "주가 데이터가 없습니다.",
                },
                {
                    status: 404,
                }
            );
        }

        const {
            result,
            closes,
            volumes,
            price,
        } = stockData;

        /*
          종목 수익률
        */
        const change1D = percentChange(
            price,
            getPreviousClose(closes, 1)
        );

        const change5D = percentChange(
            price,
            getPreviousClose(closes, 5)
        );

        const change10D = percentChange(
            price,
            getPreviousClose(closes, 10)
        );

        const change20D = percentChange(
            price,
            getPreviousClose(closes, 20)
        );

        const change60D = percentChange(
            price,
            getPreviousClose(closes, 60)
        );

        /*
          이동평균선
        */
        const ma5 =
            calculateMAAt(closes, 5);

        const ma10 =
            calculateMAAt(closes, 10);

        const ma20 =
            calculateMAAt(closes, 20);

        const ma60 =
            calculateMAAt(closes, 60);

        /*
          직전 거래일 MA
          → 기울기 판정
        */
        const previousMa20 =
            calculateMAAt(
                closes,
                20,
                1
            );

        const previousMa60 =
            calculateMAAt(
                closes,
                60,
                1
            );

        const ma20Rising =
            ma20 !== null &&
            previousMa20 !== null &&
            ma20 > previousMa20;

        const ma60Rising =
            ma60 !== null &&
            previousMa60 !== null &&
            ma60 > previousMa60;

        /*
          돌파 / 이탈
        */
        const previousClose =
            getPreviousClose(closes, 1);

        const crossedAboveMa20 =
            previousClose !== undefined &&
            previousMa20 !== null &&
            ma20 !== null &&
            previousClose <= previousMa20 &&
            price > ma20;

        const crossedBelowMa20 =
            previousClose !== undefined &&
            previousMa20 !== null &&
            ma20 !== null &&
            previousClose >= previousMa20 &&
            price < ma20;

        const crossedBelowMa60 =
            previousClose !== undefined &&
            previousMa60 !== null &&
            ma60 !== null &&
            previousClose >= previousMa60 &&
            price < ma60;

        /*
          거래량
        */
        const currentVolume =
            volumes[volumes.length - 1] ??
            null;

        const previousVolumes = volumes
            .slice(-21, -1)
            .filter(
                (volume): volume is number =>
                    typeof volume === "number" &&
                    volume > 0
            );

        const avgVolume20 =
            average(previousVolumes);

        const volumeRatio =
            typeof currentVolume ===
                "number" &&
                avgVolume20 !== null &&
                avgVolume20 > 0
                ? currentVolume /
                avgVolume20
                : null;

        /*
          기준시장 수익률
        */
        let benchmark20D: number | null =
            null;

        let benchmark60D: number | null =
            null;

        if (benchmarkData) {
            benchmark20D = percentChange(
                benchmarkData.price,
                getPreviousClose(
                    benchmarkData.closes,
                    20
                )
            );

            benchmark60D = percentChange(
                benchmarkData.price,
                getPreviousClose(
                    benchmarkData.closes,
                    60
                )
            );
        }

        /*
          상대강도
    
          예:
          종목 +10%
          시장 +4%
          → RS = +6%p
        */
        const rs20 =
            change20D !== null &&
                benchmark20D !== null
                ? change20D - benchmark20D
                : null;

        const rs60 =
            change60D !== null &&
                benchmark60D !== null
                ? change60D - benchmark60D
                : null;

        return NextResponse.json({
            ticker,

            price,

            change: {
                d1: change1D,
                d5: change5D,
                d10: change10D,
                d20: change20D,
                d60: change60D,
            },

            ma: {
                ma5,
                ma10,
                ma20,
                ma60,
            },

            trendData: {
                ma20Rising,
                ma60Rising,
            },

            events: {
                crossedAboveMa20,
                crossedBelowMa20,
                crossedBelowMa60,
            },

            volume: {
                current: currentVolume,
                avg20: avgVolume20,
                ratio: volumeRatio,
            },

            benchmark: {
                ticker: benchmarkTicker,
                d20: benchmark20D,
                d60: benchmark60D,
            },

            relativeStrength: {
                rs20,
                rs60,
            },

            currency:
                result.meta?.currency ?? "",

            exchange:
                result.meta?.exchangeName ?? "",
        });
    } catch (error) {
        console.error(
            "주가 조회 오류:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "주가 조회 중 오류가 발생했습니다.",
            },
            {
                status: 500,
            }
        );
    }
}