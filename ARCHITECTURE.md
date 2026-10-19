# Arkitektur

```
src/
  domain/     Rena TypeScript-funktioner, inga beroenden på DOM/DB/klocka. Enhetstestade.
    normalize  rättning, stavfelsdetektion (Damerau), "väsentlig ändring"
    srs        repetitionsschema (Spaced Repetition Scheduler)
    selection  urval till träningspass (Session Engine, del 1)
    distractors flervalsalternativ
    rewards    belöningstabell, idempotent tilldelning (Reward Engine)
    creatures  arter, stadier, äggtrösklar, slumpval utan dubbletter (Creature Engine)
    importParser, ocrParse  inklistring och OCR → ordpar (Vocabulary Import)
  db/         Persistence: Dexie-schema + migreringar, actions (transaktioner), backup
  audio/      speech.ts (Web Speech), sfx.ts (WebAudio-syntetiserade ljud)
  ocr/        OcrEngine-gränssnitt + Tesseract.js-implementation (utbytbar)
  ui/         React-skärmar, figur-SVG (ui/creatures)
e2e/          Playwright
```

Beroenderiktning: `ui → db → domain`. `domain` importerar aldrig något ovanför sig.

## Viktiga beslut

- **Tid injiceras.** Alla domänfunktioner och actions tar `now: Date`. Testerna simulerar veckor utan systemklockan. Appen använder `effectiveNow = max(riktig tid, senast sedda tid)` så att en bakåtställd klocka inte gör ord förfallna i förtid.
- **Förfallodatum ligger på lokal midnatt** (`dueDate`). "Om 1 dag" betyder "i morgon", inte "24 timmar efter att jag svarade".
- **Allt som hänger ihop skrivs i en Dexie-transaktion.** `submitAnswer` uppdaterar WordProgress, ReviewEvents, RewardEvents, GameState, OwnedCreatures och Sessions atomärt.
- **Idempotens på tre nivåer.** (1) Varje fråga har ett `qid`; ett andra svar på samma `qid` (dubbeltryck, omladdning) returnerar det sparade resultatet utan effekt. (2) RewardEvent har deterministisk primärnyckel (`typed:<pass>:<glosa>`), så en belöning kan inte skrivas två gånger. (3) Passbonus har nyckeln `session:<pass>`.
- **Passet är persistent.** Kön, alternativen och svaren sparas i `Sessions`; ett avbrutet pass återupptas exakt där det var (knappen FORTSÄTT).
- **Kläckning sparas före animation** (`hatchEgg` är en transaktion; UI spelar bara upp resultatet).
- **Figurer är SVG-kod** (`ui/creatures`), parametriserade per art och stadium, med CSS-animationer. Inga emojis, inga binära tillgångar, inga bildgenererings-API:er.
- **OCR bakom `OcrEngine`.** Tesseract.js körs i Web Worker; worker, WASM-kärna och språkmodeller serveras från `/ocr` (egen origin). Bilden skickas aldrig någonstans. Tolkningen av OCR-text till ordpar (`ocrParse`) är ren logik och separat testad; osäkra rader flaggas, aldrig gissas tyst.
- **Migreringar.** `db.ts` har version 1 (första schemat) och 2 (index `[wordId+at]`, fältet `eggsHatched`, backfill av inställningar). Migrationen är testad mot en riktig v1-databas.
- **Backup** har formatet `{format, version, exportedAt, data}` med strikt validering (typer, dubblettnycklar, referensintegritet) *före* transaktionen.
- **PWA.** `registerType: 'prompt'` – användaren väljer när ny version aktiveras. App-skalet precachas; `/ocr/*` cachas runtime (CacheFirst).
- **Inga nya beroenden i onödan:** ingen router (flikar + överlägg i tillstånd), ingen state-bibliotek (Dexie `useLiveQuery`).
