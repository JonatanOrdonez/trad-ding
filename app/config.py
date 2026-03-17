SYMBOL_TO_YFINANCE: dict[str, str] = {
    "BTCUSD": "BTC-USD",
    "ETHUSD": "ETH-USD",
}


def get_yfinance_symbol(symbol: str) -> str:
    return SYMBOL_TO_YFINANCE.get(symbol, symbol)
