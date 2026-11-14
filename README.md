# ⚓ Marstal Navigationsskole – Portal

En lokal webportal (localhost) for Marstal Navigationsskole med en **elevportal** og en **lærerportal**.

## Fag
- Skibsfører / Kystskipper: Navigation · Skibsteknik · Søret · Stabilitet & lastbehandling · Sikkerhed & beredskab · Meteorologi & oceanografi · Maritim engelsk
- Færgenavigatør: Navigation · Sikkerhed & beredskab · Sømandskab · El-drift · Kommunikation, service & turisme

## Funktioner
**Lærebøger** – lærerne skriver og vedligeholder selv bøgerne
- Bøger med kapitler skrevet i markdown (overskrifter, lister, tabeller, formler, billeder, links)
- Editor med værktøjslinje og live forhåndsvisning (Skriv / Forhåndsvis på mobil)
- Kladde eller udgivet for både bog og kapitel – eleverne ser kun det udgivne
- Versionshistorik på hvert kapitel: se og gendan tidligere versioner
- Eleverne markerer kapitler som læst og ser deres fremgang

**Lærerstudio** – lærerens værksted
- Overblik: lærebøger, kapitler, kladder, ord skrevet, materialer, opgaver og lektioner
- Hvor mange elever der er færdige med hver bog
- Redigér fag (navn, kode, farve og beskrivelse)
- Ændringslog over alt, der er oprettet og redigeret

**Som app**
- Bundmenu med ikoner på mobil og en tilpasset topmenu på computer
- Kan installeres på telefonen ("Føj til hjemmeskærm"), når portalen køres fra serveren

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
- Opret, **redigér** og slet opslag, materialer, opgaver og lektioner i egne fag
- Bedøm afleveringer med karakter + feedback
- Elevliste og karakterbog pr. fag

## Demo uden installation
`demo/portal.html` er hele portalen i én fil – dobbeltklik på den, så åbner den i browseren.
Data gemmes kun i den browser, du bruger. Filen bygges fra koden med `npm run demo`.

## Kom i gang
Kræver kun [Node.js](https://nodejs.org) 18 eller nyere – ingen pakker skal installeres.

```bash
npm start          # starter på http://localhost:3000
npm run reset      # nulstiller databasen til demodata
npm test           # kører API-testene
npm run demo       # bygger demo/portal.html
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
- `api.js` – portalens logik: ruter, adgangskontrol (elever/lærere ser kun deres egne fag), sessioner
- `server.js` – Node.js HTTP-server omkring `api.js` med JSON-fil som database
- `build-demo.js` – samler portalen i én HTML-fil, der kører uden server
- `public/` – `app.js` (kerne og sider), `books.js` (lærebøger), `studio.js` (Lærerstudio), `markdown.js`, `icons.js` (Lucide-ikoner, ISC-licens), `sw.js` + `manifest.webmanifest` (installérbar app)
- `seed.js` – fag, brugere og demoindhold
- Data gemmes i `data/db.json` (oprettes automatisk, ikke i git)

Fag, brugere og hold ændres i `seed.js` efterfulgt af `npm run reset`.

> Portalen er lavet til lokal brug. Skal den på nettet, bør den have HTTPS, rigtige adgangskoder og en egentlig database.
