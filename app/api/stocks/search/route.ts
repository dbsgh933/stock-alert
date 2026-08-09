import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url =
      `https://query2.finance.yahoo.com/v1/finance/search` +
      `?q=${encodeURIComponent(query)}` +
      `&quotesCount=10&newsCount=0`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "종목 검색에 실패했습니다." },
        { status: 500 }
      );
    }

    const data = await response.json();

    const results = (data.quotes ?? [])
      .filter(
        (item: any) =>
          item.symbol &&
          (item.quoteType === "EQUITY" ||
            item.quoteType === "ETF")
      )
      .map((item: any) => ({
        ticker: item.symbol,
        name:
          item.longname ||
          item.shortname ||
          item.symbol,
        exchange: item.exchange || "",
        type: item.quoteType,
        market:
          item.symbol.endsWith(".KS") ||
          item.symbol.endsWith(".KQ")
            ? "KR"
            : "US",
      }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "종목 검색 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}