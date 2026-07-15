# Confronta Elettronica AI

Sito che consiglia i migliori prodotti elettronici in base a una richiesta in linguaggio naturale: cerca i prodotti reali su Google Shopping (via SerpApi), li fa confrontare e classificare da un'AI gratuita (Groq), e mostra una lista curata con foto, prezzo e link d'acquisto diretto verso il negozio.

## Setup

1. Installa le dipendenze:

   ```bash
   npm install
   ```

2. Copia `.env.local.example` in `.env.local` e compila le chiavi:

   - `GROQ_API_KEY` — gratuita su [console.groq.com/keys](https://console.groq.com/keys)
   - `SERPAPI_KEY` — gratuita su [serpapi.com/manage-api-key](https://serpapi.com/manage-api-key) (solo email, 100 ricerche/mese gratis)

3. Avvia il server di sviluppo:

   ```bash
   npm run dev
   ```

4. Apri [http://localhost:3000](http://localhost:3000) e prova una ricerca, es. "cuffie bluetooth economiche".

## Come funziona

- `app/page.tsx` — home page con barra di ricerca; invia la query a `/api/recommend` e mostra i risultati (card prodotto + tabella di confronto)
- `app/api/recommend/route.ts` — orchestrazione: cerca i prodotti su Google Shopping, li invia all'AI per ranking e spiegazione, risponde con la lista ordinata
- `lib/serpapi.ts` — client SerpApi (Google Shopping), ricerca prodotti multi-negozio e normalizzazione dati
- `lib/ai.ts` — client Groq (Llama 3.3), prompt di confronto/ranking, parsing dell'output JSON
- `lib/cache.ts` — cache su filesystem con TTL per non rifare chiamate API ad ogni ricerca identica

## Nota su fonti dati e scraping

Il progetto usa **solo SerpApi (Google Shopping)** come fonte prodotti: aggrega automaticamente i risultati di molti negozi diversi tramite un servizio ufficiale pensato apposta per il confronto prezzi, restando pienamente conforme ai Termini di Servizio dei rivenditori. Lo scraping diretto di siti come Amazon o eBay violerebbe i loro ToS (rischio di blocco IP/azioni legali) ed è volutamente escluso da questo progetto.

## Deploy

Push su GitHub e importa il repo su [Vercel](https://vercel.com/new): ricordati di impostare le stesse variabili d'ambiente (`GROQ_API_KEY`, `SERPAPI_KEY`) nelle impostazioni del progetto Vercel.
