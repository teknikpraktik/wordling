# Wordling

En mobilanpassad engelsk glosapp (PWA) för barn. Veckans glosor övas med flervalsfrågor och skrivna svar, schemalagda med spaced repetition. Genom att öva växer och utvecklas söta figurer som man samlar. All data ligger lokalt på enheten: ingen inloggning, ingen backend, ingen spårning, inga externa anrop.

Allt användargränssnitt är på svenska.

## Teknikstack

React 19 · TypeScript (strict) · Vite · Tailwind CSS 4 · Dexie (IndexedDB) · vite-plugin-pwa/Workbox · Web Speech API · Tesseract.js (lokal OCR, egen hosting av motor och modeller) · Vitest + React Testing Library · Playwright · axe-core.

## Lokal utveckling

```bash
npm install
npm run dev          # http://localhost:5173  (OCR-filer kopieras automatiskt till public/ocr)
npm run dev          # öppna /?gallery för en förhandsvisning av alla figurer (endast dev)
```

## Tester och kvalitet

```bash
npm run lint
npm run typecheck
npm test             # Vitest: enhets-, integrations- och komponenttester
npm run build        # måste köras före e2e (e2e kör mot `vite preview`)
npm run test:e2e     # Playwright (iPhone 13-emulering, Chromium)
```

Se [TESTING.md](TESTING.md) för vad som täcks och vad som *inte* kan testas automatiskt.
Om Playwrights egen Chromium saknas används `/opt/pw-browsers/chromium`, eller sätt `PW_CHROMIUM=<sökväg>`.

## Produktionsbuild

`npm run build` typkontrollerar, kopierar OCR-motor och språkmodeller (svenska + engelska, ca 30 MB) från `node_modules` till `public/ocr` och bygger till `dist/`. OCR-filerna ligger *inte* i precache (appen installeras snabbt) utan cachas vid första användning av kameraimporten och fungerar därefter offline.

## Deployment (Vercel)

Projektet är ett statiskt Vite-bygge; `vercel.json` sätter cache- och säkerhetsheaders.

1. Importera GitHub-repot `teknikpraktik/wordling` i Vercel (Framework: Vite, build `npm run build`, output `dist`) – eller `npx vercel --prod` med en `VERCEL_TOKEN`.
2. Inga miljövariabler behövs.
3. Verifiera: öppna adressen, kontrollera att `/sw.js` och `/manifest.webmanifest` svarar 200 och installera på iPhone (Dela → Lägg till på hemskärmen).

Uppdateringar: en ny version visas som en liten ruta ("En ny version finns – Uppdatera"). IndexedDB berörs aldrig av en uppdatering; databasen har versionerade migreringar (se ARCHITECTURE.md).

## Backup

Inställningar → Säkerhetskopia. *Spara kopia* skapar en JSON-fil (delningsmenyn på iPhone, annars nedladdning). *Hämta kopia* validerar filen, visar vad den innehåller, ber om bekräftelse och ersätter därefter allt i en enda transaktion – en ogiltig eller halvfärdig återställning ändrar aldrig befintliga data. Appen påminner diskret efter fyra importerade listor.

## Kända begränsningar

- Data finns bara på enheten. Rensar användaren webbplatsdata i Safari försvinner den – därför backupen. (iOS kan även rensa PWA-data efter lång inaktivitet i vanlig Safari; en installerad hemskärmsapp är skyddad.)
- OCR: förutsätter engelska ordet först och svenska i kolumnen bredvid (byter automatiskt om det tydligt är tvärtom); alla ord lagras med små bokstäver. Tryckta listor med två kolumner fungerar bra; handskrift är experimentellt. Rader som inte kan paras ihop flaggas och måste rättas innan de kan sparas.
- Uttal sker bara när man trycker på högtalarknappen. Appen väljer helst en kvinnoröst (brittisk, annars amerikansk) med lite höjd tonhöjd; vilka röster som finns beror på systemet; saknas de blir uttalsknappen utan effekt och resten fungerar. Ljud måste startas av en tryckning (iOS-krav).
- Klockskydd: tiden kan aldrig gå bakåt jämfört med senast sedda tidpunkt, men en klocka som ställs *framåt* går inte att skilja från verklig tid utan server. Eftersom belöningar bara ges för glosor som verkligen är förfallna och per pass, ger det ingen oändlig XP.
- Ingen riktig iPhone har använts under utvecklingen; se TESTING.md för manuell checklista.
