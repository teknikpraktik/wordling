# Inlärningsmotorn

## Tillstånd per glosa

`NEW → LEARNING → REVIEW → MASTERED`, med `RELEARNING` som återvändsgränd efter fel.

| Från | Händelse | Till | Schema |
|---|---|---|---|
| NEW | rätt flerval | LEARNING | skriven fråga senare i passet om plats, annars i morgon |
| NEW | fel flerval | NEW | frågan återkommer i passet |
| LEARNING | rätt skrivet | REVIEW (steg 0) | om 1 dag |
| LEARNING | fel | LEARNING | i morgon; återkommer i passet |
| REVIEW (steg *n*) | rätt skrivet, förfallen | REVIEW (steg *n+1*) | 1 → 3 → 7 → 14 dagar |
| REVIEW (steg 3, 14 d) | rätt skrivet, förfallen | **MASTERED** | om 30 dagar |
| MASTERED | rätt, förfallen | MASTERED | om 30 dagar |
| REVIEW/MASTERED | fel | RELEARNING | genast; `lapses++` |
| RELEARNING | rätt skrivet | REVIEW (steg 0) | om 1 dag |
| valfri | rätt innan förfallodatum | oförändrat schema | ingen belöning |

- Flervalssvar kan aldrig ensamma göra en glosa MASTERED (`applyReview` ignorerar flerval för allt utom NEW → LEARNING).
- Historik raderas aldrig: varje svar är en `ReviewEvent`; räknare (`correctCount`, `wrongCount`, `lapses`) bara ökar.
- `applyReview(progress, mode, correct, now)` är en ren funktion.

## Rättning (`normalize.ts`)

Ignorerar versaler, yttre/upprepade blanksteg, avslutande skiljetecken och typografiska apostrofer. Accepterar alla registrerade alternativ. Inledande *to/a/an/the* ignoreras åt båda håll (*run* = *to run*). Stavning måste vara exakt: ett **stavfel** (Damerau-avstånd ≤1 för 4–7 tecken, ≤2 för ≥8; inget för ≤3) ger verdict `typo`, alltså hjälpsam text ("Nästan! Stava så här: …") men **ingen poäng** och räknas som fel i schemat. Tomt svar ("Jag vet inte") är fel.

## Urval (`selection.ts`)

Prioritet: ominlärning → förfallna → aktuell lista → äldre → nya. Mål ≈ 60 % aktuell lista / 40 % äldre (mjuk kvot, fylls från andra sidan vid brist). Upp till 2 platser reserveras för nya ord så en repetitionsbacklog inte svälter nya glosor; max 5 nya per pass; högst 10 frågor. Ord som inte förfallit tas aldrig med i ett vanligt pass (kortare pass är OK). *Öva extra* är ett separat, uttryckligt val utan belöning.

## Inom passet

- En glosa visas aldrig två gånger i rad (återfrågan sätts in minst två platser fram).
- Fel svar → samma frågetyp återkommer senare (max 2 gånger per glosa och pass, bara om det finns andra frågor kvar).
- Rätt flerval på NEW → skriven uppföljning senare i samma pass om det finns plats.
- Kön har ett tak (16) så passet förblir cirka 10 frågor.
