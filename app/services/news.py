import yfinance as yf


def get_news(ticker: str) -> list[dict]:
    return yf.Ticker(ticker).news
