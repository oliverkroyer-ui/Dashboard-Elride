# ⚓ Marstal Navigationsskole – intelligent undervisningsportal

Et forfattersystem og en elevportal til maritim undervisning (søret, navigation, skibsteknik).
Målet: **én ændring og én godkendelse** i stedet for timers rettelser i PDF-dokumenter.

📄 **Konceptanalyse, arkitektur, udviklingsplan og forretningsmodel:** [docs/KONCEPTANALYSE.md](docs/KONCEPTANALYSE.md)

## Hvad kan prototypen?

**Underviseren**
- **Undervisningsbøger** med kapitler og underkapitler – editor med live forhåndsvisning
- **Centrale oplysninger** (`{{fakta:…}}`): ret et tal ét sted – opdateres i alle kapitler
- **Formelbibliotek** (`{{formel:…}}`): formler med variabler, enheder, kontroleksempel og advarsler – vises som interaktive beregnere
- **Retskilder** (`{{kilde:…}}`): bestemmelser med ordlyd og gyldighedsdato
- **Lovændringer:** overvågning, automatisk fund af berørt materiale, konkrete forslag, godkendelse ét forslag ad gangen, dokumentation med kilde og dato. AI ændrer aldrig noget selv.
- **Udgivelse:** arbejdskopi → “Udgiv ny version” (hele bogen eller ét kapitel) → eleverne får besked og kan se præcis hvad der er ændret. Alle udgaver bevares.
- **Versionshistorik** på hvert kapitel med sammenligning og gendannelse
- **Import** af PDF, Word og tekst (opdeles automatisk i kapitler) og **eksport til PDF**
- **Assistent:** find alle steder, kontrollér formler, vis ændringer siden sidste udgave, lav regneopgaver med facit, forklar enklere (Claude), frie spørgsmål (Claude)
- **Administration:** brugere, elevgrupper, fag og produkter (forberedt til salg)

**Eleven**
- Bøger i seneste udgave, mobilvenlig læsning, “Ny version – se ændringer”
- Søgning, bogmærker, personlige noter, formelsamling med beregnere, PDF-download (hvis tilladt)
- Skema, opgaver, karakterer og beskeder

## Kom i gang

Kræver [Node.js](https://nodejs.org) 18 eller nyere.

```bash
npm install        # kun nødvendigt for AI (Anthropic SDK)
npm start          # http://localhost:3000
npm run reset      # nulstil til demodata
npm test           # API-test af hele arbejdsgangen
npm run demo       # byg demo/portal.html (kører uden server)
```

**AI (valgfrit):** Sæt `ANTHROPIC_API_KEY`, før portalen startes. Uden nøgle virker alt undtagen “forklar enklere”, “foreslå formulering” og frie spørgsmål.
**Retsinformation (valgfrit):** Sæt `RETSINFORMATION_HARVEST_URL` til Civilstyrelsens API-endepunkt (se `server.js`).

### Demo-brugere
| Rolle | Brugernavn | Adgangskode |
|---|---|---|
| Administrator | `admin` | `admin123` |
| Underviser (Søret, Navigation …) | `lars` | `laerer123` |
| Underviser (Stabilitet, Skibsteknik …) | `mette` | `laerer123` |
| Underviser (Færgenavigatør-fag) | `peter` | `laerer123` |
| Elev (Skibsfører) | `anna` | `elev123` |
| Elev (Kystskipper) | `jonas` | `elev123` |
| Elev (Færgenavigatør) | `freja` | `elev123` |

Lovændringen i demodata (“STCW A-VIII/1 … FIKTIV DEMO”) er opdigtet og kun til afprøvning.

## Opbygning
| Fil/mappe | Indhold |
|---|---|
| `api.js` | Kerne: ruter, sessioner, adgangskontrol (administrator/underviser/elev) og indlæsning af moduler |
| `modules/content.js` | Centrale oplysninger, retskilder, formelbibliotek og henvisninger |
| `modules/books.js` | Bøger, kapitler, revisioner, udgaver, ændringslister, elevlæsning, søgning, bogmærker, noter, notifikationer, import/eksport |
| `modules/legal.js` | Lovovervågning, konsekvensanalyse, forslag, godkendelse og dokumentation |
| `modules/assistant.js` | Assistentkommandoer og prompter til Claude |
| `modules/admin.js` | Brugere, elevgrupper, fag, produkter, persondata |
| `shared/formula.js` | Sikker formelmotor med mellemregninger og kontrol (server + browser) |
| `shared/diff.js` | Sammenligning af tekst mellem versioner (server + browser) |
| `server.js` | HTTP-server, JSON-fil som database, Claude via Anthropic SDK, Retsinformation-adapter |
| `seed.js`, `seed-content.js` | Demodata: fag, brugere, bøger, formler, retskilder og udgavehistorik |
| `public/` | Frontend (PWA): `app.js`, `dashboard.js`, `books.js`, `formulas.js`, `legal.js`, `assistant.js`, `admin.js` m.fl. |
| `build-demo.js` | Samler det hele i én HTML-fil, der kører uden server |

Ikoner: [Lucide](https://lucide.dev) (ISC-licens) via Streamline. PDF/Word-import og PDF-eksport bruger pdf.js, mammoth og jsPDF fra cdnjs, hentet først når funktionen bruges.
