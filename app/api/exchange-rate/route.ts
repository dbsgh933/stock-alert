import { NextResponse } from "next/server";

export async function GET() {
  try {
    const url =
      "https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?interval=1d&range=5d";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "환율 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    const data = await response.json();

    const result = data.chart?.result?.[0];

    const rate =
      result?.meta?.regularMarketPrice ??
      result?.indicators?.quote?.[0]?.close
        ?.filter((value: number | null) => typeof value === "number")
        ?.at(-1);

    if (typeof rate !== "number") {
      return NextResponse.json(
        { error: "환율 데이터가 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      rate,
    });
  } catch (error) {
    console.error("환율 조회 오류:", error);

    return NextResponse.json(
      { error: "환율 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}