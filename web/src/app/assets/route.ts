import { NextRequest } from "next/server";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();
import { supabase } from "@/lib/services/supabase";

export async function POST(req: NextRequest) {
  let body: { name: string; symbol: string; asset_type: string; yfinance_symbol: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  const { name, symbol, asset_type, yfinance_symbol } = body;
  if (!name || !symbol || !asset_type || !yfinance_symbol) {
    return Response.json({ detail: "Missing required fields" }, { status: 400 });
  }

  const upperSymbol = symbol.toUpperCase();

  // Check duplicate
  const { data: existing } = await supabase
    .from("assets")
    .select("id")
    .eq("symbol", upperSymbol)
    .maybeSingle();

  if (existing) {
    return Response.json(
      { detail: `Asset with symbol '${upperSymbol}' already exists.` },
      { status: 409 }
    );
  }

  // Validate yfinance symbol
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const chart = await yf.chart(yfinance_symbol, {
      period1: start,
      period2: end,
    });
    if (!chart.quotes || chart.quotes.length === 0) {
      return Response.json(
        { detail: `'${yfinance_symbol}' was not recognized by Yahoo Finance.` },
        { status: 422 }
      );
    }
  } catch {
    return Response.json(
      { detail: `'${yfinance_symbol}' was not recognized by Yahoo Finance.` },
      { status: 422 }
    );
  }

  const { data: asset, error } = await supabase
    .from("assets")
    .insert({ name, symbol: upperSymbol, asset_type, yfinance_symbol })
    .select("id, symbol, name")
    .single();

  if (error) return Response.json({ detail: error.message }, { status: 500 });

  return Response.json(asset, { status: 201 });
}
