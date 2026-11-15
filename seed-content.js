// Startindhold til undervisningsbøger, centrale oplysninger, retskilder og formler.
// Teksterne er korte gengivelser til demonstration – ikke autoritative citater.
// Lovændringen "STCW A-VIII/1 (FIKTIV DEMO)" er opdigtet og kun til afprøvning af arbejdsgangen.
(function (root) {
'use strict';

function content(days) {
  // ---------- Retskilder ----------
  const sources = [
    {
      id: 'src-colreg', short: 'COLREG', title: 'Internationale søvejsregler (COLREG 1972)', kind: 'International konvention', authority: 'IMO',
      url: 'https://www.imo.org/en/About/Conventions/Pages/COLREG.aspx', watch: true,
      provisions: [
        { key: 'colreg-5', ref: 'Regel 5', title: 'Udkig', text: 'Ethvert skib skal altid holde forsvarligt udkig ved syn og hørelse samt ved alle tilgængelige midler, så situationen og risikoen for kollision kan vurderes fuldt ud.', validFrom: '', url: '', history: [] },
        { key: 'colreg-6', ref: 'Regel 6', title: 'Sikker fart', text: 'Ethvert skib skal altid gå med sikker fart, så det kan foretage korrekt og effektiv manøvre for at undgå kollision og kan stoppes inden for en afstand, der passer til forholdene.', validFrom: '', url: '', history: [] },
        { key: 'colreg-7', ref: 'Regel 7', title: 'Kollisionsfare', text: 'Der må antages at være kollisionsfare, hvis kompaspejlingen til et skib, der nærmer sig, ikke ændrer sig mærkbart.', validFrom: '', url: '', history: [] },
        { key: 'colreg-8', ref: 'Regel 8', title: 'Manøvre for at undgå kollision', text: 'Manøvre for at undgå kollision skal foretages i god tid og være tilstrækkelig stor til at kunne opfattes af et andet skib.', validFrom: '', url: '', history: [] },
        { key: 'colreg-13', ref: 'Regel 13', title: 'Overhaling', text: 'Et skib, der overhaler et andet, skal holde af vejen for det skib, der overhales.', validFrom: '', url: '', history: [] },
        { key: 'colreg-14', ref: 'Regel 14', title: 'Modsatte kurser', text: 'Når to maskindrevne skibe mødes på modsatte eller næsten modsatte kurser med kollisionsfare, skal hvert skib dreje til styrbord.', validFrom: '', url: '', history: [] },
        { key: 'colreg-15', ref: 'Regel 15', title: 'Skærende kurser', text: 'Når to maskindrevne skibes kurser skærer hinanden med kollisionsfare, skal det skib, der har det andet om styrbord, holde af vejen og så vidt muligt undgå at gå foran om det.', validFrom: '', url: '', history: [] },
      ],
    },
    {
      id: 'src-stcw', short: 'STCW', title: 'STCW-konventionen og STCW-koden', kind: 'International konvention', authority: 'IMO',
      url: 'https://www.imo.org/en/OurWork/HumanElement/Pages/STCW-Convention.aspx', watch: true,
      provisions: [
        { key: 'stcw-a-viii-1', ref: 'Kode A-VIII/1', title: 'Hviletid for vagtgående personale',
          text: 'Alle personer med vagtfunktioner skal have mindst 10 timers hvile i enhver 24-timers periode og mindst 77 timers hvile i enhver 7-dages periode. Hviletiden må højst deles i to perioder, hvoraf den ene skal være mindst 6 timer.',
          validFrom: '', url: '', history: [] },
      ],
    },
    {
      id: 'src-is', short: 'IS-koden', title: 'International Code on Intact Stability (IS Code 2008)', kind: 'International kode', authority: 'IMO',
      url: 'https://www.imo.org/en/OurWork/Safety/Pages/Stability.aspx', watch: true,
      provisions: [
        { key: 'is-2-2-4', ref: 'Del A, 2.2.4', title: 'Initial metacenterhøjde', text: 'Den initiale metacenterhøjde GM₀ må ikke være mindre end 0,15 m.', validFrom: '', url: '', history: [] },
      ],
    },
    {
      id: 'src-soelov', short: 'Søloven', title: 'Søloven (lovbekendtgørelse)', kind: 'Dansk lov', authority: 'Retsinformation / Erhvervsministeriet',
      url: 'https://www.retsinformation.dk/', watch: true, provisions: [],
    },
  ];

  // ---------- Centrale oplysninger (rettes ét sted) ----------
  const F = (id, key, label, value, unit, sourceKey, note) => ({ id, key, label, value, unit, sourceKey, note, updatedAt: days(-90), updatedBy: 'u1', history: [] });
  const facts = [
    F('f1', 'hvile-24t', 'Minimum hviletid pr. 24 timer', '10', 'timer', 'stcw-a-viii-1', 'Vagtgående personale'),
    F('f2', 'hvile-7d', 'Minimum hviletid pr. 7 døgn', '77', 'timer', 'stcw-a-viii-1', 'Vagtgående personale'),
    F('f3', 'soemil', 'Én sømil', '1852', 'm', '', 'International definition'),
    F('f4', 'rho-salt', 'Massefylde, saltvand', '1,025', 't/m³', '', 'Standardværdi i stabilitetsberegninger'),
    F('f5', 'rho-fersk', 'Massefylde, ferskvand', '1,000', 't/m³', '', ''),
    F('f6', 'gm-min', 'Mindste initiale GM', '0,15', 'm', 'is-2-2-4', 'IS-koden, generelt kriterium'),
  ];
  facts.forEach((f) => { f.updatedBy = f.key.startsWith('gm') || f.key.startsWith('rho') ? 'u2' : 'u1'; });

  // ---------- Formelbibliotek ----------
  const V = (symbol, label, unit, def, extra = {}) => ({ symbol, label, unit, default: def, min: null, max: null, display: '', ...extra });
  const FX = (id, key, name, category, expression, result, variables, test, explanation, warnings = [], by = 'u2') =>
    ({ id, key, name, category, expression, result: { decimals: 2, display: '', label: '', ...result }, variables, test, explanation, warnings, updatedAt: days(-30), updatedBy: by, history: [] });
  const formulas = [
    FX('fx1', 'gm', 'Metacenterhøjde', 'Stabilitet', 'KM - KG', { symbol: 'GM', label: 'metacenterhøjden GM', unit: 'm', decimals: 2 },
      [V('KM', 'Metacentrets højde over kølen', 'm', 9.85, { min: 1, max: 30 }), V('KG', 'Tyngdepunktets højde over kølen', 'm', 7.2, { min: 0.5, max: 25 })],
      { inputs: { KM: 9.85, KG: 7.2 }, expected: 2.65 },
      'GM er afstanden fra tyngdepunktet G op til metacentret M. Et positivt GM betyder, at skibet retter sig op efter en lille krængning.',
      [{ when: 'GM < 0.15', text: 'GM er under IS-kodens minimum på 0,15 m – skibet opfylder ikke kriteriet.' }, { when: 'GM < 0', text: 'Negativt GM: skibet er ustabilt og vil få slagside.' }]),
    FX('fx2', 'kg-efter-lastning', 'Ny KG efter lastning', 'Stabilitet', '(Delta * KG + w * kg) / (Delta + w)', { symbol: 'KG1', display: 'KG₁', label: 'den nye KG', unit: 'm', decimals: 3 },
      [V('Delta', 'Deplacement før lastning', 't', 6000, { display: 'Δ', min: 10 }), V('KG', 'KG før lastning', 'm', 7.2), V('w', 'Lastet vægt', 't', 300), V('kg', 'Lastens tyngdepunkt over kølen', 'm', 11)],
      { inputs: { Delta: 6000, KG: 7.2, w: 300, kg: 11 }, expected: 7.381 },
      'Momentsætningen: det samlede moment om kølen divideret med den samlede vægt. Losning regnes med negativ vægt.'),
    FX('fx3', 'kraengning', 'Krængningsvinkel ved flytning af vægt', 'Stabilitet', 'atan(w * d / (Delta * GM))', { symbol: 'theta', display: 'θ', label: 'krængningsvinklen θ', unit: '°', decimals: 1 },
      [V('w', 'Flyttet vægt', 't', 20), V('d', 'Tværskibs flytning', 'm', 8), V('Delta', 'Deplacement', 't', 5000, { display: 'Δ', min: 10 }), V('GM', 'Metacenterhøjde', 'm', 0.8, { min: 0.01 })],
      { inputs: { w: 20, d: 8, Delta: 5000, GM: 0.8 }, expected: 2.29 },
      'Gælder for små krængningsvinkler (op til ca. 10–15°), hvor metacentret kan regnes som fast.',
      [{ when: 'theta > 12', text: 'Vinklen er over ca. 12°. Formlen for små vinkler er ikke længere præcis – brug GZ-kurven.' }]),
    FX('fx4', 'deplacement', 'Deplacement ud fra blokkoefficient', 'Dybgang og deplacement', 'L * B * T * Cb * rho', { symbol: 'Delta', display: 'Δ', label: 'deplacementet Δ', unit: 't', decimals: 0 },
      [V('L', 'Længde mellem perpendikulærer', 'm', 90), V('B', 'Bredde', 'm', 15), V('T', 'Dybgang', 'm', 5.5), V('Cb', 'Blokkoefficient', '–', 0.72, { min: 0.35, max: 0.9 }), V('rho', 'Vandets massefylde', 't/m³', 1.025, { display: 'ρ', min: 0.99, max: 1.04 })],
      { inputs: { L: 90, B: 15, T: 5.5, Cb: 0.72, rho: 1.025 }, expected: 5479.65 },
      'Volumen af den neddykkede del gange vandets massefylde. Cb beskriver, hvor fyldig skroget er i forhold til en kasse.'),
    FX('fx5', 'tpc', 'Tons pr. centimeter (TPC)', 'Dybgang og deplacement', 'Aw * rho / 100', { symbol: 'TPC', label: 'TPC', unit: 't/cm', decimals: 2 },
      [V('Aw', 'Vandlinjeareal', 'm²', 1200), V('rho', 'Vandets massefylde', 't/m³', 1.025, { display: 'ρ', min: 0.99, max: 1.04 })],
      { inputs: { Aw: 1200, rho: 1.025 }, expected: 12.3 },
      'Den vægt, der skal til for at ændre middeldybgangen 1 cm.'),
    FX('fx6', 'dybgangsaendring', 'Ændring af middeldybgang', 'Dybgang og deplacement', 'w / TPC', { symbol: 'dT', display: 'ΔT', label: 'ændringen i middeldybgang', unit: 'cm', decimals: 1 },
      [V('w', 'Lastet eller losset vægt', 't', 246), V('TPC', 'Tons pr. centimeter', 't/cm', 12.3, { min: 0.1 })],
      { inputs: { w: 246, TPC: 12.3 }, expected: 20 },
      'Gælder, så længe TPC kan regnes konstant (små dybgangsændringer).'),
    FX('fx7', 'trimaendring', 'Trimændring', 'Trim', 'w * d / MCTC', { symbol: 'dTrim', display: 'ΔTrim', label: 'trimændringen', unit: 'cm', decimals: 1 },
      [V('w', 'Vægt', 't', 150), V('d', 'Langskibs afstand fra LCF', 'm', 30), V('MCTC', 'Moment der ændrer trim 1 cm', 't·m/cm', 90, { min: 1 })],
      { inputs: { w: 150, d: 30, MCTC: 90 }, expected: 50 },
      'Trimmomentet divideret med MCTC. Afstanden måles fra flydecentret (LCF).'),
    FX('fx8', 'sejltid', 'Sejltid', 'Navigation', 'dist / v', { symbol: 't', label: 'sejltiden', unit: 'timer', decimals: 2 },
      [V('dist', 'Distance', 'sm', 42), V('v', 'Fart', 'knob', 12, { min: 0.1, max: 45 })],
      { inputs: { dist: 42, v: 12 }, expected: 3.5 }, '1 knob = 1 sømil i timen.', [], 'u1'),
    FX('fx9', 'rettevisende-kurs', 'Fra kompaskurs til rettevisende kurs', 'Navigation', 'KK + dev + mv', { symbol: 'RV', label: 'den rettevisende kurs', unit: '°', decimals: 0 },
      [V('KK', 'Kompaskurs', '°', 85, { min: 0, max: 360 }), V('dev', 'Deviation (østlig +, vestlig −)', '°', 2, { min: -30, max: 30 }), V('mv', 'Misvisning (østlig +, vestlig −)', '°', -3, { min: -40, max: 40 })],
      { inputs: { KK: 85, dev: 2, mv: -3 }, expected: 84 },
      'Østlig deviation og misvisning lægges til, vestlig trækkes fra.',
      [{ when: 'RV >= 360', text: 'Træk 360° fra for at få kursen mellem 0° og 359°.' }, { when: 'RV < 0', text: 'Læg 360° til for at få kursen mellem 0° og 359°.' }], 'u1'),
    // Bevidst fejl, så formelkontrollen har noget at finde i demoen
    FX('fx10', 'kraengning-gammel', 'Krængning – gammel note (bør tjekkes)', 'Stabilitet', 'w * d / (Delta * GM)', { symbol: 'theta', display: 'θ', label: 'krængningsvinklen', unit: '°', decimals: 1 },
      [V('w', 'Flyttet vægt', 't', 20), V('d', 'Flytning', 'm', 8), V('Delta', 'Deplacement', 't', 5000, { display: 'Δ' }), V('GM', 'Metacenterhøjde', 'm', 0.8)],
      { inputs: { w: 20, d: 8, Delta: 5000, GM: 0.8 }, expected: 2.29 },
      'Overført fra en gammel PDF-note.'),
  ];

  // ---------- Bøger og kapitler ----------
  const books = [
    { id: 'b-ret', subjectId: 's-ret', title: 'Søret', description: 'Søvejsregler, hviletid og skibsførerens ansvar. Opdateres løbende, når reglerne ændres.', pdfAllowed: true, hidden: false, authorId: 'u1', createdAt: days(-200), updatedAt: days(-2), updatedBy: 'u1' },
    { id: 'b-nav', subjectId: 's-nav', title: 'Navigation – grundbog', description: 'Søkort, kurser og strøm. Grundbogen til Kystskipper og Skibsfører.', pdfAllowed: true, hidden: false, authorId: 'u1', createdAt: days(-120), updatedAt: days(-3), updatedBy: 'u1' },
    { id: 'b-stab', subjectId: 's-stab', title: 'Stabilitet og trim', description: 'Fra tyngdepunkt og metacenter til trim og dybgang – med beregnere til alle formler.', pdfAllowed: false, hidden: false, authorId: 'u2', createdAt: days(-90), updatedAt: days(-5), updatedBy: 'u2' },
    { id: 'b-el', subjectId: 's-el', title: 'El-drift på færger', description: 'Batteridrift, opladning og sikkerhed om bord.', pdfAllowed: true, hidden: false, authorId: 'u6', createdAt: days(-6), updatedAt: days(-1), updatedBy: 'u6' },
  ];
  const C = (id, bookId, order, title, text, { parentId = null, ready = true, by = 'u1', ago = -100 } = {}) =>
    ({ id, bookId, parentId, order, title, content: text, ready, createdAt: days(ago - 5), updatedAt: days(ago), updatedBy: by, revisions: [] });

  const chapters = [
    // ----- Søret -----
    C('c-ret1', 'b-ret', 1, 'Søvejsreglerne', `Søvejsreglerne (COLREG) gælder for alle skibe på det åbne hav og i farvande, der står i forbindelse med det. Kapitlet gennemgår de regler, der oftest bruges i praksis.

> Er du i tvivl, om der er kollisionsfare, så **er** der kollisionsfare.`),
    C('c-ret1a', 'b-ret', 1, 'Udkig, sikker fart og kollisionsfare', `## De fire grundregler

- **Udkig** {{kilde:colreg-5}} – ved syn, hørelse og alle tilgængelige midler, også radar og AIS.
- **Sikker fart** {{kilde:colreg-6}} – farten skal passe til sigtbarhed, trafik og skibets manøvreegenskaber.
- **Kollisionsfare** {{kilde:colreg-7}} – en pejling, der står, mens afstanden mindskes, betyder kollisionsfare.
- **Manøvre** {{kilde:colreg-8}} – i god tid, tydelig og stor nok til at blive set.

### Øvelse
Du ser et skib 4 streger om styrbord. Pejlingen står i 6 minutter. Hvad gør du?`, { parentId: 'c-ret1' }),
    C('c-ret1b', 'b-ret', 2, 'Overhaling, modsatte og skærende kurser', `## Hvem skal vige?

| Situation | Regel | Hvem viger |
|---|---|---|
| Overhaling | 13 | Det overhalende skib – altid |
| Modsatte kurser | 14 | Begge drejer til **styrbord** |
| Skærende kurser | 15 | Skibet, der har det andet om **styrbord** |

{{kilde:colreg-15}}

Ser du et andet maskindrevet skib om styrbord på skærende kurs, er du *vigepligtigt skib*.`, { parentId: 'c-ret1' }),
    C('c-ret2', 'b-ret', 2, 'Hviletid og vagthold', `## Krav til hviletid

Træthed er en af de hyppigste medvirkende årsager til ulykker til søs. Derfor stiller STCW minimumskrav til hvile for alle med vagtfunktioner {{kilde:stcw-a-viii-1}}.

| Periode | Mindste hviletid |
|---|---|
| Enhver 24-timers periode | {{fakta:hvile-24t}} |
| Enhver 7-dages periode | {{fakta:hvile-7d}} |

Hviletiden må højst deles i to perioder, og den ene skal være mindst 6 timer.

> Skibsføreren har ansvaret for, at vagtplanen overholder kravene – og for at hviletiden registreres.`),
    C('c-ret3', 'b-ret', 3, 'Vagtplanlægning i praksis', `## Eksempel: 6 timer på, 6 timer af

Med en 6-6-vagt får styrmanden 12 timers hvile i døgnet, delt i to perioder på 6 timer. Det opfylder kravet om 10 timers hvile pr. døgn.

Over en uge giver det 84 timers hvile, hvilket er over kravet på 77 timer. Men husk: manøvrer, havneophold og øvelser kan hurtigt spise af hviletiden.

### Opgave
Lav en vagtplan for et skib med to styrmænd og skibsfører, hvor alle overholder kravene – også i en uge med tre havneanløb.`),
    C('c-ret4', 'b-ret', 4, 'Skibsførerens ansvar', `## Skibsføreren som øverste ansvarlige

Søloven pålægger skibsføreren et overordnet ansvar for skibets sikkerhed: at skibet er sødygtigt, forsvarligt bemandet og udrustet, og at lasten er forsvarligt stuvet.

*Kapitlet er under udarbejdelse – mangler afsnit om logbog og søforklaring.*`, { ready: false, ago: -3 }),

    // ----- Navigation -----
    C('c-nav1', 'b-nav', 1, 'Søkortet', `## Hvad viser et søkort?

Søkortet viser **dybder**, **kystlinje**, **afmærkning** og **farer** og er grundlaget for al planlægning af en rejse.

### Mercators projektion
De fleste søkort er tegnet i *Mercators projektion*. En ret linje på kortet er en **loksodrom** – en kurs, der skærer alle meridianer under samme vinkel.

> Afstand måles altid på **breddeskalaen** ud for det sted, man måler. 1 bredde-minut = 1 sømil = {{fakta:soemil}}.

### Opgave
1. Find kortets målestok og kortdatum på øvelseskortet.
2. Mål afstanden fra Marstal havn til Ærøskøbing i sømil.`),
    C('c-nav2', 'b-nav', 2, 'Kurser: misvisning og deviation', `## Fra kompaskurs til rettevisende kurs

Et magnetkompas peger ikke mod den geografiske nordpol. To fejl skal korrigeres:

- **Misvisning** – forskellen mellem rettevisende nord og magnetisk nord. Står i kortets kompasrose.
- **Deviation** – skibets egen påvirkning af kompasset. Aflæses i skibets deviationstabel.

{{formel:rettevisende-kurs}}

> Huskeregel: *"Fra kompas til kort – læg østlig til."*`),
    C('c-nav3', 'b-nav', 3, 'Fart, distance og tid', `## Den vigtigste formel om bord

Planlægning af ankomsttid, brændstof og vagter bygger på sammenhængen mellem fart, distance og tid.

{{formel:sejltid}}

### Opgave
Fra Marstal til Kiel er der ca. 42 sømil. Hvornår skal I afgå med 12 knob for at være fremme kl. 14.00?`),

    // ----- Stabilitet -----
    C('c-stab1', 'b-stab', 1, 'Tyngdepunkt, opdrift og metacenter', `## De tre vigtige punkter

- **G – tyngdepunktet:** hvor skibets samlede vægt virker nedad.
- **B – opdriftscentret:** tyngdepunktet af det fortrængte vand.
- **M – metacentret:** punktet, opdriften virker igennem ved små krængninger.

{{formel:gm}}

Ifølge IS-koden må GM ikke være under {{fakta:gm-min}} {{kilde:is-2-2-4}}.`, { by: 'u2' }),
    C('c-stab2', 'b-stab', 2, 'Lastning og krængning', `## Når vægten flyttes

Lastes der højt i skibet, stiger KG, og GM bliver mindre. Brug formlen nedenfor til at finde den nye KG.

{{formel:kg-efter-lastning}}

Flyttes en vægt tværskibs, krænger skibet:

{{formel:kraengning}}`, { by: 'u2' }),
    C('c-stab3', 'b-stab', 3, 'Dybgang og deplacement', `## Hvor dybt ligger skibet?

Deplacementet er skibets vægt – og lig med vægten af det fortrængte vand. Saltvand regnes normalt med {{fakta:rho-salt}}.

{{formel:deplacement}}

{{formel:tpc}}

{{formel:dybgangsaendring}}`, { by: 'u2' }),
    C('c-stab4', 'b-stab', 4, 'Trim (kladde)', `## Trim

Trim er forskellen mellem dybgangen for og agter.

{{formel:trimaendring}}

Se også den gamle formel: {{formel:trim-gammel}}`, { by: 'u2', ready: false, ago: -2 }),

    // ----- El-drift (ikke udgivet endnu) -----
    C('c-el1', 'b-el', 1, 'Batterisystemer om bord', `## Opbygning

1. **Battericeller** samlet i moduler og strenge.
2. **BMS** (Battery Management System), der overvåger spænding, temperatur og ladetilstand.
3. **Ladeanlæg** i land, der lader under liggetiden i havn.

*Kapitlet er under udarbejdelse.*`, { by: 'u6', ready: false, ago: -1 }),
  ];

  // Ældre versioner af to kapitler – bruges til at bygge en rigtig udgavehistorik
  const older = {
    'c-ret1b': chapters.find((c) => c.id === 'c-ret1b').content.replace('\n\n{{kilde:colreg-15}}', ''),
    'c-ret2': chapters.find((c) => c.id === 'c-ret2').content.replace('Træthed er en af de hyppigste medvirkende årsager til ulykker til søs. Derfor stiller', 'STCW stiller'),
  };
  const finalTexts = { 'c-ret1b': chapters.find((c) => c.id === 'c-ret1b').content, 'c-ret2': chapters.find((c) => c.id === 'c-ret2').content };
  for (const id of Object.keys(older)) chapters.find((c) => c.id === id).content = older[id];

  // Manuskript: Søret 2.2 → (rettelser) → 2.3. Navigation 1.0 → 1.1. Stabilitet 1.0.
  const seedScript = [
    { publish: 'b-ret', by: 'u1', version: '2.2', at: days(-60), notes: 'Opdateret til nyt skoleår.', silent: true },
    { edit: 'c-ret1b', by: 'u1', set: { content: finalTexts['c-ret1b'], ready: true }, at: days(-20), why: 'Tilføjet citat af regel 15' },
    { edit: 'c-ret2', by: 'u1', set: { content: finalTexts['c-ret2'], ready: true }, at: days(-20), why: 'Bedre indledning' },
    { publish: 'b-ret', by: 'u1', version: '2.3', at: days(-14), notes: 'Regel 15 citeres nu direkte. Ny indledning om træthed.' },
    { publish: 'b-nav', by: 'u1', version: '1.0', at: days(-40), notes: 'Første udgave.', silent: true },
    { publish: 'b-stab', by: 'u2', version: '1.0', at: days(-30), notes: 'Første udgave med interaktive beregnere.', silent: true },
  ];

  // ---------- Regelændring (FIKTIV – kun til afprøvning) ----------
  const stcwNew = 'Alle personer med vagtfunktioner skal have mindst 11 timers hvile i enhver 24-timers periode og mindst 80 timers hvile i enhver 7-dages periode. Hviletiden må højst deles i to perioder, hvoraf den ene skal være mindst 6 timer.';
  const legalChanges = [{
    id: 'lc-demo1', demo: true, origin: 'demo', status: 'ny', detectedAt: days(-1), externalId: 'demo-stcw-1',
    title: 'STCW A-VIII/1: skærpede krav til hviletid (FIKTIV DEMO)',
    summary: 'FIKTIV ÆNDRING – kun til afprøvning af arbejdsgangen. Ikke gældende ret. Eksemplet viser, hvad der sker, når minimumshviletiden ændres: 10 → 11 timer pr. døgn og 77 → 80 timer pr. uge.',
    provisionKey: 'stcw-a-viii-1', oldText: sources[1].provisions[0].text, newText: stcwNew, effectiveFrom: '2027-07-01',
    url: 'https://www.imo.org/en/OurWork/HumanElement/Pages/STCW-Convention.aspx',
    factUpdates: [{ key: 'hvile-24t', newValue: '11' }, { key: 'hvile-7d', newValue: '80' }],
    replacements: [{ from: '10 timer', to: '11 timer', factKey: 'hvile-24t' }, { from: '77 timer', to: '80 timer', factKey: 'hvile-7d' }],
  }];

  const reads = [
    { userId: 'u3', chapterId: 'c-ret1', at: days(-10) }, { userId: 'u3', chapterId: 'c-ret1a', at: days(-9) },
    { userId: 'u3', chapterId: 'c-nav1', at: days(-6) }, { userId: 'u3', chapterId: 'c-nav2', at: days(-3) },
    { userId: 'u4', chapterId: 'c-nav1', at: days(-4) },
  ];
  const bookmarks = [{ id: 'bm1', userId: 'u3', bookId: 'b-ret', chapterId: 'c-ret1b', anchor: '', label: 'Tabel over vigepligt', at: days(-8) }];
  const notes = [{ id: 'no1', userId: 'u3', bookId: 'b-ret', chapterId: 'c-ret1a', text: 'Husk: AIS er et hjælpemiddel – ikke en erstatning for udkig!', updatedAt: days(-9) }];
  const groups = [{ id: 'g1', name: 'Skibsfører 2026A', studentIds: ['u3', 'u4'], subjectIds: ['s-nav', 's-ret', 's-stab'], createdBy: 'u1' }];
  const products = [
    { id: 'p1', name: 'Søret – digital bog', kind: 'bog', description: 'Adgang til Søret inkl. alle opdateringer i 12 måneder.', price: 349, interval: 'år', bookIds: ['b-ret'], subjectIds: [], active: false, createdAt: days(-5) },
    { id: 'p2', name: 'Skolelicens – navigationsskole', kind: 'licens', description: 'Alle bøger og beregnere for en hel skole.', price: 24000, interval: 'år', bookIds: [], subjectIds: [], active: false, createdAt: days(-5) },
    { id: 'p3', name: 'Eksamenspakke: stabilitet', kind: 'eksamenspakke', description: 'Interaktive regneopgaver og formelsamling til stabilitetseksamen.', price: 149, interval: 'engang', bookIds: ['b-stab'], subjectIds: [], active: false, createdAt: days(-5) },
  ];
  const activity = [
    { id: 'act1', at: days(-1), userId: 'u6', subjectId: 's-el', text: 'Redigerede “Batterisystemer om bord” i “El-drift på færger”', link: '#/rediger-kapitel/c-el1' },
  ];
  return { books, chapters, sources, facts, formulas, legalChanges, seedScript, reads, bookmarks, notes, groups, products, activity, editions: [], proposals: [], changeLog: [], notifications: [], demoFeed: [] };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { content };
else root.PortalSeedContent = { content };
})(this);
