# ⚓ Marstal Navigationsskole – Portal

En lokal webportal (localhost) for Marstal Navigationsskole med en **elevportal** og en **lærerportal**.

## Fag
- Skibsfører / Kystskipper: Navigation · Skibsteknik · Søret · Stabilitet & lastbehandling · Sikkerhed & beredskab · Meteorologi & oceanografi · Maritim engelsk
- Færgenavigatør: Navigation · Sikkerhed & beredskab · Sømandskab · El-drift · Kommunikation, service & turisme

## Funktioner
**Elever**
- Forside med dagens skema, kommende afleveringer, seneste opslag og ulæste beskeder
- Ugeskema
- Beskeder til egne lærere
- Læs undervisningsmaterialer
- Aflever opgaver (kan rettes indtil de er bedømt)
- Se karakterer (7-trinsskalaen), feedback og gennemsnit

**Lærere**
- Forside med dagens lektioner og afleveringer der venter på bedømmelse
- Ugeskema – lektioner tilføjes/fjernes under fanen *Skema* i hvert fag
- Beskeder med elever i egne fag
- Opret opslag, materialer (med links) og opgaver med frist i egne fag
- Bedøm afleveringer med karakter + feedback
- Elevliste og karakterbog pr. fag

## Kom i gang
Kræver kun [Node.js](https://nodejs.org) 18 eller nyere – ingen pakker skal installeres.

```bash
npm start          # starter på http://localhost:3000
npm run reset      # nulstiller databasen til demodata
npm test           # kører API-testene
```

Port kan ændres: `PORT=8080 npm start`.

### Demo-brugere
| Rolle | Brugernavn | Adgangskode |
|-------|-----------|-------------|
| Lærer | `lars` (Navigation, Søret, Meteorologi, Maritim engelsk) | `laerer123` |
| Lærer | `mette` (Skibsteknik, Stabilitet, Sikkerhed) | `laerer123` |
| Lærer | `peter` (Sømandskab, El-drift, Kommunikation/service/turisme) | `laerer123` |
| Elev  | `anna` (Skibsfører), `jonas` (Kystskipper), `freja` (Færgenavigatør) | `elev123` |

## Teknik
- `server.js` – Node.js HTTP-server med JSON-API, sessions-cookies og adgangskontrol (elever/lærere ser kun deres egne fag)
- `seed.js` – fag, brugere og demoindhold
- `public/` – frontend (HTML/CSS/JS uden frameworks)
- Data gemmes i `data/db.json` (oprettes automatisk, ikke i git)

Fag, brugere og hold ændres i `seed.js` efterfulgt af `npm run reset`.

> Portalen er lavet til lokal brug. Skal den på nettet, bør den have HTTPS, rigtige adgangskoder og en egentlig database.
