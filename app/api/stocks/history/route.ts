import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const ticker = request.nextUrl.searchParams
        .get("ticker")
        ?.trim();

    if (!ticker) {
        return NextResponse.json(
            { error: "티커가 필요합니다." },
            { status: 400 }
        );
    }

    try {
        const url =
            `https://query1.finance.yahoo.com/v8/finance/chart/` +
            `${encodeURIComponent(ticker)}` +
            `?interval=1d&range=1y`;

        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0",
            },
            cache: "no-store",
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: "차트 데이터를 가져오지 못했습니다." },
                { status: 500 }
            );
        }

        const data = await response.json();

        const result = data.chart?.result?.[0];

        if (!result) {
            return NextResponse.json(
                { error: "차트 데이터가 없습니다." },
                { status: 404 }
            );
        }

        const timestamps: number[] =
            result.timestamp ?? [];

        const quote =
            result.indicators?.quote?.[0];

        if (!quote) {
            return NextResponse.json(
                { error: "OHLC 데이터가 없습니다." },
                { status: 404 }
            );
        }

        const opens: Array<number | null> =
            quote.open ?? [];

        const highs: Array<number | null> =
            quote.high ?? [];

        const lows: Array<number | null> =
            quote.low ?? [];

        const closes: Array<number | null> =
            quote.close ?? [];

        const volumes: Array<number | null> =
            quote.volume ?? [];

        /*
          조정종가
    
          수익률/이평선 계산용으로 같이 내려준다.
        */
        const adjustedCloses: Array<number | null> =
            result.indicators?.adjclose?.[0]?.adjclose ?? [];

        const history = timestamps
            .map((timestamp, index) => {
                const open = opens[index];
                const high = highs[index];
                const low = lows[index];
                const close = closes[index];
                const volume = volumes[index];

                const adjustedClose =
                    adjustedCloses[index] ?? close;

                if (
                    typeof open !== "number" ||
                    typeof high !== "number" ||
                    typeof low !== "number" ||
                    typeof close !== "number"
                ) {
                    return null;
                }

                return {
                    date: new Date(timestamp * 1000)
                        .toISOString()
                        .slice(0, 10),

                    open,
                    high,
                    low,
                    close,

                    adjustedClose,

                    volume:
                        typeof volume === "number"
                            ? volume
                            : 0,
                };
            })
            .filter(
                (
                    item
                ): item is {
                    date: string;
                    open: number;
                    high: number;
                    low: number;
                    close: number;
                    adjustedClose: number;
                    volume: number;
                } => item !== null
            )
            .slice(-260);



        return NextResponse.json({
            ticker,

            meta: {
                symbol: result.meta?.symbol,
                name:
                    result.meta?.longName ??
                    result.meta?.shortName ??
                    ticker,
                exchange: result.meta?.exchangeName,
                currency: result.meta?.currency,
            },

            history,
        });
    } catch (error) {
        console.error(
            "차트 조회 오류:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "차트 조회 중 오류가 발생했습니다.",
            },
            { status: 500 }
        );
    }
}