# euston.wtf

Real-time train departures from London Euston. Pick a destination, see what's leaving next — with live platform assignments, delay information, and a heads-up when an unconfirmed platform looks suspect.

Live at **[euston.wtf](https://euston.wtf)**.

## Stack

Svelte 5 · TypeScript · Vite · Bulma · [Realtime Trains API](https://www.realtimetrains.co.uk) (via a small proxy at api.euston.wtf)

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run check    # type-check (svelte-check + tsc)
```
