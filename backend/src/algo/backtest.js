import { evaluateSignal, generateSignal } from './strategy.js';
import { riskAmount } from './risk-engine.js';
import { resolvePaperExit } from './paper-engine.js';

const money = (value) => Number(Number(value || 0).toFixed(2));

function dayKey(timestamp) {
  if (!timestamp) return 'unknown';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(timestamp));
}

export function runBacktest({ candles, capital, riskPerTrade, riskReward = 2, timeframe = '5m', chargesBps = 0, slippageBps = 0, strategyConfig = {}, lotSize = 1 }) {
  if (!Array.isArray(candles) || candles.length < 30) throw new Error('At least 30 candles are required for a meaningful backtest');
  const settings = { tradingCapital: capital, riskPerTrade, maxTradesPerDay: 3, maxConsecutiveLosses: 2, dailyLossLimit: 0 };
  const indicators = generateSignal(candles, candles.length - 1, { ...strategyConfig, riskReward }).indicators;
  const trades = [];
  let position = null;
  let equity = Number(capital);
  let peakEquity = equity;
  let maxDrawdown = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let consecutiveLosses = 0;
  let dailyLoss = 0;
  let dailyTrades = 0;
  let currentDay = null;

  const closePosition = (exitPrice, timestamp, reason, charges, slippage) => {
    const direction = position.side === 'BUY' ? 1 : -1;
    const pnl = (exitPrice - position.entry) * position.quantity * direction;
    const netPnl = pnl - position.charges - charges - slippage;
    equity += netPnl;
    const trade = { ...position, exit: money(exitPrice), exitTime: timestamp, exitReason: reason, grossPnl: money(pnl), charges: money(position.charges + charges), slippage: money(position.slippage + slippage), pnl: money(netPnl), rMultiple: position.risk > 0 ? money(netPnl / position.risk) : 0 };
    trades.push(trade);
    if (netPnl >= 0) { grossProfit += netPnl; consecutiveLosses = 0; } else { grossLoss += Math.abs(netPnl); consecutiveLosses += 1; dailyLoss += Math.abs(netPnl); }
    peakEquity = Math.max(peakEquity, equity);
    maxDrawdown = Math.max(maxDrawdown, peakEquity - equity);
    position = null;
  };

  for (let index = 1; index < indicators.length; index += 1) {
    const candle = indicators[index];
    const day = dayKey(candle.timestamp);
    if (day !== currentDay) { currentDay = day; dailyTrades = 0; dailyLoss = 0; }
    if (position) {
      const exit = resolvePaperExit({
        side: position.side,
        low: candle.low,
        high: candle.high,
        close: candle.close,
        stopLoss: position.stopLoss,
        target: position.target,
        timestamp: candle.timestamp,
      });
      if (exit) {
        const slippage = exit.exitPrice * (slippageBps / 10000) * position.quantity;
        const charges = exit.exitPrice * position.quantity * (chargesBps / 10000);
        closePosition(exit.exitPrice, candle.timestamp, exit.reason, charges, slippage);
      }
      continue;
    }
    if (dailyTrades >= 3 || consecutiveLosses >= 2 || dailyLoss >= riskAmount(settings) * 2) continue;
    const signal = evaluateSignal(indicators, index, { ...strategyConfig, riskReward });
    if (signal.signal === 'NO_TRADE') continue;
    const distance = Math.abs(signal.price - signal.stopLoss);
    const quantity = Math.max(0, Math.floor((riskAmount(settings) / distance) / lotSize) * lotSize);
    if (!quantity) continue;
    const entrySlippage = signal.price * (slippageBps / 10000) * quantity;
    const entry = signal.signal === 'BUY' ? signal.price + signal.price * slippageBps / 10000 : signal.price - signal.price * slippageBps / 10000;
    position = { side: signal.signal, entry: money(entry), entryTime: candle.timestamp, stopLoss: signal.stopLoss, target: signal.target, quantity, risk: money(distance * quantity), charges: money(entry * quantity * (chargesBps / 10000)), slippage: money(entrySlippage) };
    dailyTrades += 1;
  }
  if (position) {
    const finalCandle = indicators[indicators.length - 1];
    const slippage = finalCandle.close * (slippageBps / 10000) * position.quantity;
    closePosition(finalCandle.close, finalCandle.timestamp, 'END_OF_DATA', finalCandle.close * position.quantity * (chargesBps / 10000), slippage);
  }

  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const netPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const averageWin = wins.length ? wins.reduce((sum, trade) => sum + trade.pnl, 0) / wins.length : 0;
  const averageLoss = losses.length ? losses.reduce((sum, trade) => sum + trade.pnl, 0) / losses.length : 0;
  return {
    inputs: { instrument: 'NIFTY 50', timeframe, capital: Number(capital), riskPerTrade: Number(riskPerTrade), riskReward, chargesBps, slippageBps, candleCount: candles.length },
    trades,
    metrics: {
      totalTrades: trades.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: trades.length ? money((wins.length / trades.length) * 100) : 0,
      grossPnl: money(grossProfit - grossLoss),
      charges: money(trades.reduce((sum, trade) => sum + trade.charges, 0)),
      slippage: money(trades.reduce((sum, trade) => sum + trade.slippage, 0)),
      netPnl: money(netPnl),
      profitFactor: grossLoss ? money(grossProfit / grossLoss) : grossProfit ? null : 0,
      maximumDrawdown: money(maxDrawdown),
      averageWin: money(averageWin),
      averageLoss: money(averageLoss),
      expectancy: trades.length ? money(netPnl / trades.length) : 0,
      rMultiple: trades.length ? money(trades.reduce((sum, trade) => sum + trade.rMultiple, 0) / trades.length) : 0,
      endingCapital: money(equity),
    },
  };
}