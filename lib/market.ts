// 시장 화면용 주요 종목 목록 (국내/해외). symbol=네이버 reutersCode로 시세/차트 바로 조회.
export interface MarketStock {
  name: string; // 한글 종목명
  ticker: string; // 표시용 (국내 6자리, 미국 티커)
  symbol: string; // 네이버 심볼 (국내=6자리, 미국=NVDA.O 등)
  market: string; // KOSPI/KOSDAQ/NASDAQ/NYSE
  domestic: boolean;
}

// 국내 대표주 (코드=심볼, 국내 시세 직접 조회)
export const KR_STOCKS: MarketStock[] = [
  ["삼성전자", "005930", "KOSPI"],
  ["SK하이닉스", "000660", "KOSPI"],
  ["LG에너지솔루션", "373220", "KOSPI"],
  ["삼성바이오로직스", "207940", "KOSPI"],
  ["현대차", "005380", "KOSPI"],
  ["기아", "000270", "KOSPI"],
  ["셀트리온", "068270", "KOSPI"],
  ["NAVER", "035420", "KOSPI"],
  ["카카오", "035720", "KOSPI"],
  ["POSCO홀딩스", "005490", "KOSPI"],
  ["LG화학", "051910", "KOSPI"],
  ["삼성SDI", "006400", "KOSPI"],
  ["현대모비스", "012330", "KOSPI"],
  ["KB금융", "105560", "KOSPI"],
  ["신한지주", "055550", "KOSPI"],
  ["한화에어로스페이스", "012450", "KOSPI"],
  ["HD현대중공업", "329180", "KOSPI"],
  ["두산에너빌리티", "034020", "KOSPI"],
  ["크래프톤", "259960", "KOSPI"],
  ["알테오젠", "196170", "KOSDAQ"],
  ["에코프로비엠", "247540", "KOSDAQ"],
].map(([name, code, market]) => ({
  name,
  ticker: code,
  symbol: code,
  market,
  domestic: true,
}));

// 해외(미국) 대표주 — symbol은 검증된 네이버 reutersCode
export const US_STOCKS: MarketStock[] = [
  ["엔비디아", "NVDA", "NVDA.O", "NASDAQ"],
  ["애플", "AAPL", "AAPL.O", "NASDAQ"],
  ["마이크로소프트", "MSFT", "MSFT.O", "NASDAQ"],
  ["알파벳", "GOOGL", "GOOGL.O", "NASDAQ"],
  ["아마존", "AMZN", "AMZN.O", "NASDAQ"],
  ["메타", "META", "META.O", "NASDAQ"],
  ["테슬라", "TSLA", "TSLA.O", "NASDAQ"],
  ["브로드컴", "AVGO", "AVGO.O", "NASDAQ"],
  ["TSMC", "TSM", "TSM", "NYSE"],
  ["넷플릭스", "NFLX", "NFLX.O", "NASDAQ"],
  ["AMD", "AMD", "AMD.O", "NASDAQ"],
  ["팔란티어", "PLTR", "PLTR.O", "NASDAQ"],
  ["마이크론", "MU", "MU.O", "NASDAQ"],
  ["코인베이스", "COIN", "COIN.O", "NASDAQ"],
  ["인텔", "INTC", "INTC.O", "NASDAQ"],
  ["퀄컴", "QCOM", "QCOM.O", "NASDAQ"],
  ["마이크로스트래티지", "MSTR", "MSTR.O", "NASDAQ"],
  ["알리바바", "BABA", "BABA.K", "NYSE"],
].map(([name, ticker, symbol, market]) => ({
  name,
  ticker,
  symbol,
  market,
  domestic: false,
}));
