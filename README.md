# Confronta Elettronica AI

Sito che consiglia i migliori prodotti elettronici in base a una richiesta in linguaggio naturale: cerca i prodotti reali via eBay Browse API, li fa confrontare e classificare da un'AI gratuita (Groq), e mostra una lista curata con foto, prezzo e link d'acquisto diretto.

## Setup

1. Installa le dipendenze:

   ```bash
   npm install
   ```

2. Copia `.env.local.example` in `.env.local` e compila le chiavi:

   - `GROQ_API_KEY` — gratuita su [console.groq.com/keys](https://console.groq.com/keys)
   - `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` — gratuite su [developer.ebay.com/my/keys](https://developer.ebay.com/my/keys) (usa le chiavi "Production")

3. Avvia il server di sviluppo:

   ```bash
   npm run dev
   ```

4. Apri [http://localhost:3000](http://localhost:3000) e prova una ricerca, es. "cuffie bluetooth economiche".

## Come funziona

- `app/page.tsx` — home page con barra di ricerca; invia la query a `/api/recommend` e mostra i risultati (card prodotto + tabella di confronto)
- `app/api/recommend/route.ts` — orchestrazione: cerca i prodotti su eBay, li invia all'AI per ranking e spiegazione, risponde con la lista ordinata
- `lib/ebay.ts` — client eBay Browse API (OAuth client-credentials, ricerca prodotti, normalizzazione dati)
- `lib/ai.ts` — client Groq (Llama 3.3), prompt di confronto/ranking, parsing dell'output JSON
- `lib/cache.ts` — cache su filesystem con TTL per non rifare chiamate API ad ogni ricerca identica

## Nota su fonti dati e scraping

Il progetto usa **solo l'eBay Browse API ufficiale e gratuita** come fonte prodotti, per restare pienamente conforme ai Termini di Servizio dei rivenditori. Aggiungere altre fonti (es. Amazon) richiede la loro API ufficiale (per Amazon: Product Advertising API, che richiede un account affiliato con vendite) — lo scraping diretto di questi siti violerebbe i loro ToS e non è incluso in questo progetto.

## Deploy

Push su GitHub e importa il repo su [Vercel](https://vercel.com/new): ricordati di impostare le stesse variabili d'ambiente (`GROQ_API_KEY`, `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`) nelle impostazioni del progetto Vercel.
