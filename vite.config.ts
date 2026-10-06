import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

function netlifyFunctionsDevPlugin() {
  return {
    name: 'netlify-functions-dev',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url?.startsWith('/.netlify/functions/tv-quotes')) {
          try {
            const tvRes = await fetch('https://scanner.tradingview.com/global/scan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                symbols: { tickers: ['OANDA:XAUUSD', 'BINANCE:BTCUSDT'] },
                columns: ['close'],
              }),
            });
            const data = await tvRes.json();
            const xau = data?.data?.find((d: any) => d.s === 'OANDA:XAUUSD')?.d?.[0];
            const btc = data?.data?.find((d: any) => d.s === 'BINANCE:BTCUSDT')?.d?.[0];
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ XAUUSD: xau, BTCUSD: btc }));
            return;
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), netlifyFunctionsDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
