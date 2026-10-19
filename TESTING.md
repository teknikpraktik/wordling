# Testning

## Automatiserat

| Nivå | Verktyg | Täcker |
|---|---|---|
| Enhet (`src/domain/*.test.ts`) | Vitest | rättning, stavfel, alternativ, alla SRS-tillstånd och intervall, fel/ominlärning, urval, belöningar och dubbelskydd, äggtrösklar, slumpval utan dubbletter, figurutveckling, importparser, OCR-parsning, prestanda (800 ord) |
| Integration (`src/db/flow.test.ts`) | Vitest + fake-indexeddb | import → träning → repetition över månader, fel → ny chans, XP → ägg → evolution, ändrad översättning → statusnollning, backup → återställning, ogiltig backup, avbruten återställning (rollback), migrering v1 → v2, klockskydd, dubbeltryck/parallella svar |
| Komponent (`src/ui/*.dom.test.tsx`) | React Testing Library | frågeflöde och feedback |
| E2E (`e2e/*.spec.ts`) | Playwright (Chromium, iPhone 13-emulering) | första start, import av tio glosor, träningspass, fel svar, återkomst efter simulerade dagar, äggkläckning, byte av figur, interaktioner, offline, backup/återställning, kamera-OCR på en tryckt bild (även offline), dubbletter, belöningsmanipulation (dubbeltryck + omladdning) |
| Tillgänglighet (`e2e/a11y.spec.ts`) | axe-core | inga WCAG 2.2 A/AA-brister på hem, lista, träna, fråga, feedback, figurer, inställningar; tryckytor ≥ 44 px; tangentbordsnavigering |

Kör: `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`.

## Vad testerna INTE bevisar (simulerat / kräver riktig enhet)

- **Tid** simuleras med `page.clock.setFixedTime` och injicerade `Date`-objekt – inga verkliga dygn har gått.
- **Talsyntes**: Chromium i testmiljön har normalt inga röster; logiken för röstval är enhetstestbar men uttalet är *inte* verifierat på iPhone.
- **Ljudeffekter** (WebAudio) hörs inte i testerna.
- **Kamera**: fotouppladdning testas med en genererad bild, inte med iPhones kamera, ljus, skärpa eller handskrift.
- **Installation, ikon, offline-läge och skärmtangentbord på iOS** är emulerade, inte provade på riktig iPhone.
- **Skärmläsare** (VoiceOver) är inte provad; endast axe och semantiska roller/etiketter.

## Manuell checklista för iPhone

1. Safari → Dela → Lägg till på hemskärmen; appen öppnas utan webbläsarens verktygsfält, ikonen ser rätt ut.
2. Kläck första ägget; hör ljudet (ringsignalen får inte vara avstängd).
3. Fota en riktig tryckt gloslista; kontrollera tabellen, rätta, spara.
4. Träna: skriv svar – tangentbordet täcker inte fältet; autokorrigering/stor bokstav är av.
5. Tryck Lyssna: engelskt uttal (kontrollera brittisk röst). Stäng av uttal/ljud i inställningar.
6. Flygplansläge: träning, matning och glosredigering fungerar.
7. Spara en backup (delningsmenyn), nollställ inte; hämta den igen.
8. VoiceOver: flikar, frågor och svarsknappar läses upp begripligt; testa Störst textstorlek.
9. Låt appen ligga några dagar och kontrollera att förfallna glosor dyker upp.
