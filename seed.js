// Startdata for portalen. Køres automatisk første gang serveren starter,
// eller med `npm run reset` for at nulstille databasen.
(function (root) {
'use strict';

function seed(hashPassword) {
  const now = Date.now();
  const days = (n) => new Date(now + n * 86400000).toISOString();

  const users = [
    { id: 'u1', username: 'lars', name: 'Lars Holm', role: 'teacher', password: hashPassword('laerer123') },
    { id: 'u2', username: 'mette', name: 'Mette Bruun', role: 'teacher', password: hashPassword('laerer123') },
    { id: 'u6', username: 'peter', name: 'Peter Krogh', role: 'teacher', password: hashPassword('laerer123') },
    { id: 'u3', username: 'anna', name: 'Anna Jensen', role: 'student', className: 'Skibsfører · 2. semester (aug. 2026)', password: hashPassword('elev123') },
    { id: 'u4', username: 'jonas', name: 'Jonas Madsen', role: 'student', className: 'Kystskipper · hold aug. 2026', password: hashPassword('elev123') },
    { id: 'u5', username: 'freja', name: 'Freja Nielsen', role: 'student', className: 'Færgenavigatør · hold 2026-27', password: hashPassword('elev123') },
  ];
  const allStudents = ['u3', 'u4', 'u5'];
  const navigators = ['u3', 'u4']; // Skibsfører + Kystskipper
  const ferry = ['u5'];            // Færgenavigatør

  const subjects = [
    {
      id: 's-nav', code: 'NAV', name: 'Navigation', color: '#1f5f9e',
      description: 'Terrestrisk og elektronisk navigation, søkort, kurser, tidevand, ECDIS og radar/ARPA.',
      teacherIds: ['u1'], studentIds: allStudents,
    },
    {
      id: 's-tek', code: 'TEK', name: 'Skibsteknik', color: '#a2552a',
      description: 'Skibets konstruktion, maskineri, hjælpesystemer, materialer og vedligehold.',
      teacherIds: ['u2'], studentIds: navigators,
    },
    {
      id: 's-ret', code: 'RET', name: 'Søret', color: '#5b3f8c',
      description: 'Sølov, søvejsregler (COLREG), internationale konventioner (SOLAS, MARPOL, STCW) og ansvar til søs.',
      teacherIds: ['u1'], studentIds: navigators,
    },
    {
      id: 's-stab', code: 'STAB', name: 'Stabilitet & lastbehandling', color: '#2a7f62',
      description: 'Tyngdepunkt, metacenter, GZ-kurver, trim, lastplanlægning og surring.',
      teacherIds: ['u2'], studentIds: navigators,
    },
    {
      id: 's-sik', code: 'SIK', name: 'Sikkerhed & beredskab', color: '#b23a48',
      description: 'Brandbekæmpelse, redningsmidler, førstehjælp, ISM-koden og beredskabsplaner.',
      teacherIds: ['u2'], studentIds: allStudents,
    },
    {
      id: 's-met', code: 'MET', name: 'Meteorologi & oceanografi', color: '#3b7ea1',
      description: 'Vejrsystemer, vejrkort, vind og bølger, strøm og planlægning efter vejret.',
      teacherIds: ['u1'], studentIds: navigators,
    },
    {
      id: 's-eng', code: 'ENG', name: 'Maritim engelsk', color: '#6b6b2a',
      description: 'SMCP (Standard Marine Communication Phrases), VHF-kommunikation og fagterminologi.',
      teacherIds: ['u1'], studentIds: navigators,
    },
    {
      id: 's-som', code: 'SØM', name: 'Sømandskab', color: '#1d6f7a',
      description: 'Fortøjning, ankring, knob og splejsninger, dæksarbejde og godt sømandskab om bord på færger.',
      teacherIds: ['u6'], studentIds: ferry,
    },
    {
      id: 's-el', code: 'EL', name: 'El-drift', color: '#c08a1e',
      description: 'Elektriske systemer om bord, batteri-eldrift i færger, ladeanlæg og sikker betjening.',
      teacherIds: ['u6'], studentIds: ferry,
    },
    {
      id: 's-kst', code: 'KST', name: 'Kommunikation, service & turisme', color: '#8a4f7d',
      description: 'Passagerservice, kommunikation med gæster og myndigheder, formidling og turisme i øsamfund.',
      teacherIds: ['u6'], studentIds: ferry,
    },
  ];

  const materials = [
    { id: 'm1', subjectId: 's-nav', title: 'Kompendium: Kursberegning og misvisning', content: 'Gennemgang af rettevisende kurs, misvisning og deviation. Husk huskeremsen: Kompas → Magnetisk → Rettevisende (tilføj østlig, træk vestlig fra).', link: '', createdAt: days(-20), authorId: 'u1' },
    { id: 'm2', subjectId: 's-nav', title: 'Øvelseskort 104 – Det Sydfynske Øhav', content: 'Brug kortet til opgaverne om pejlinger og strømtrekanter. Fysiske kopier ligger i navigationslokalet.', link: '', createdAt: days(-12), authorId: 'u1' },
    { id: 'm3', subjectId: 's-tek', title: 'Totaktsdieselmotoren – opbygning', content: 'Slides og noter fra lektion 3 om krydshovedmotorer, spuleluft og turboladere.', link: '', createdAt: days(-15), authorId: 'u2' },
    { id: 'm4', subjectId: 's-ret', title: 'COLREG – regel 1-19', content: 'Læs reglerne for styring og sejlads. Fokus på regel 13 (overhaling), 14 (modsatte kurser) og 15 (skærende kurser).', link: 'https://www.imo.org/en/About/Conventions/Pages/COLREG.aspx', createdAt: days(-10), authorId: 'u1' },
    { id: 'm5', subjectId: 's-stab', title: 'Formelsamling – stabilitet', content: 'GM = KM − KG. Krængningsvinkel ved små vinkler: tan θ = (w · d) / (Δ · GM).', link: '', createdAt: days(-8), authorId: 'u2' },
    { id: 'm6', subjectId: 's-sik', title: 'Brandtrekanten og slukningsmidler', content: 'Oversigt over brandklasser A–F og hvilke slukningsmidler der bruges om bord.', link: '', createdAt: days(-6), authorId: 'u2' },
    { id: 'm7', subjectId: 's-eng', title: 'SMCP – Distress, urgency & safety', content: 'Øv MAYDAY-, PAN PAN- og SECURITE-meldinger højt i par.', link: '', createdAt: days(-4), authorId: 'u1' },
  ];

  materials.push(
    { id: 'm8', subjectId: 's-el', title: 'Batteri-eldrift i færger – introduktion', content: 'Opbygning af batterisystemer, BMS, ladestrategi i havn og nødprocedurer ved termisk løbskhed.', link: '', createdAt: days(-5), authorId: 'u6' },
    { id: 'm9', subjectId: 's-som', title: 'Fortøjning af små færger', content: 'Gennemgang af fortøjningsplan, snapback-zoner og kommunikation mellem bro og dæk.', link: '', createdAt: days(-9), authorId: 'u6' },
  );

  const assignments = [
    { id: 'a1', subjectId: 's-nav', title: 'Strømtrekant – opgave 1-5', description: 'Løs opgave 1-5 i kompendiet. Vis beregninger og vedhæft eventuelt et billede af din konstruktion (indsæt link).', due: days(5), createdAt: days(-7), authorId: 'u1' },
    { id: 'a2', subjectId: 's-ret', title: 'Case: Kollision i Storebælt', description: 'Analysér casen ud fra COLREG regel 5, 7, 8 og 15. Hvem havde vigepligten, og hvad burde være gjort anderledes?', due: days(9), createdAt: days(-3), authorId: 'u1' },
    { id: 'a3', subjectId: 's-tek', title: 'Brændstofsystemet', description: 'Tegn og beskriv brændstofsystemet fra bunkertank til indsprøjtningsventil.', due: days(-2), createdAt: days(-14), authorId: 'u2' },
    { id: 'a4', subjectId: 's-stab', title: 'GM-beregning efter lastning', description: 'Beregn ny KG og GM efter lastning af de tre partier i bilaget.', due: days(12), createdAt: days(-1), authorId: 'u2' },
  ];

  assignments.push(
    { id: 'a5', subjectId: 's-kst', title: 'Serviceplan for en ø-overfart', description: 'Beskriv hvordan du vil modtage og informere passagerer på en travl sommerdag – herunder sikkerhedsinformation og handicapvenlig service.', due: days(7), createdAt: days(-2), authorId: 'u6' },
  );

  const submissions = [
    { id: 'sub1', assignmentId: 'a3', studentId: 'u3', text: 'Brændstoffet pumpes fra bunkertanken til bundfældningstanken, derefter separatoren og dagtanken ...', submittedAt: days(-3), grade: '10', feedback: 'Flot og grundig beskrivelse. Husk viskositetsregulatoren.', gradedAt: days(-1) },
    { id: 'sub2', assignmentId: 'a3', studentId: 'u4', text: 'Bunkertank → settling tank → separator → service tank → booster pumpe → motor.', submittedAt: days(-2), grade: null, feedback: '', gradedAt: null },
    { id: 'sub3', assignmentId: 'a1', studentId: 'u3', text: 'Opgave 1: KDV = 087°, FOG = 9,4 kn ...', submittedAt: days(-1), grade: null, feedback: '', gradedAt: null },
  ];

  const announcements = [
    { id: 'n1', subjectId: 's-nav', title: 'Simulatortimer i uge 48', body: 'Vi bruger broens simulator tirsdag og torsdag. Mød op kl. 08:15 i simulatorbygningen.', createdAt: days(-2), authorId: 'u1' },
    { id: 'n2', subjectId: 's-sik', title: 'Brandkursus på Svendborg', body: 'Husk arbejdstøj og sikkerhedssko til den praktiske brandøvelse fredag.', createdAt: days(-1), authorId: 'u2' },
    { id: 'n3', subjectId: 's-el', title: 'Praktik på færgen', body: 'Husk at notere alle ladeoperationer i jeres praktikbog – vi gennemgår dem ved næste skoleperiode.', createdAt: days(-1), authorId: 'u6' },
  ];

  // Ugeskema (1 = mandag … 5 = fredag)
  const L = (id, subjectId, weekday, start, end, room, teacherId) => ({ id, subjectId, weekday, start, end, room, teacherId });
  const lessons = [
    L('l1', 's-nav', 1, '08:15', '09:45', 'Navigationslokalet', 'u1'),
    L('l2', 's-ret', 1, '10:00', '11:30', 'Lokale 2', 'u1'),
    L('l3', 's-tek', 1, '12:15', '13:45', 'Maskinværkstedet', 'u2'),
    L('l4', 's-stab', 2, '08:15', '09:45', 'Lokale 3', 'u2'),
    L('l5', 's-nav', 2, '10:00', '13:45', 'Simulatorbygningen', 'u1'),
    L('l6', 's-met', 3, '08:15', '09:45', 'Lokale 2', 'u1'),
    L('l7', 's-sik', 3, '10:00', '11:30', 'Lokale 1', 'u2'),
    L('l8', 's-eng', 3, '12:15', '13:45', 'Lokale 4', 'u1'),
    L('l9', 's-tek', 4, '08:15', '09:45', 'Maskinværkstedet', 'u2'),
    L('l10', 's-ret', 4, '10:00', '11:30', 'Lokale 2', 'u1'),
    L('l11', 's-nav', 5, '08:15', '11:30', 'Simulatorbygningen', 'u1'),
    L('l12', 's-som', 1, '08:15', '11:30', 'Havnen / øvelsesbåd', 'u6'),
    L('l13', 's-el', 2, '08:15', '11:30', 'El-laboratoriet', 'u6'),
    L('l14', 's-kst', 4, '12:15', '13:45', 'Lokale 4', 'u6'),
    L('l15', 's-sik', 5, '12:15', '14:30', 'Lokale 1', 'u2'),
  ];

  const messages = [
    { id: 'msg1', fromId: 'u3', toId: 'u1', body: 'Hej Lars – må jeg aflevere strømtrekant-opgaven som foto af min konstruktion?', createdAt: days(-1), read: true },
    { id: 'msg2', fromId: 'u1', toId: 'u3', body: 'Ja, det er helt fint. Indsæt linket i besvarelsen og skriv dine beregninger med.', createdAt: days(-0.9), read: false },
    { id: 'msg3', fromId: 'u4', toId: 'u2', body: 'Jeg var syg i fredags – er der noter fra timen om brændstofsystemet?', createdAt: days(-0.5), read: false },
  ];

  // ---------- Lærebøger (markdown) ----------
  const books = [
    { id: 'b-nav', subjectId: 's-nav', title: 'Navigation – grundbog', description: 'Søkort, kurser og strøm. Grundbogen til Kystskipper og Skibsfører.', published: true, authorId: 'u1', createdAt: days(-40), updatedAt: days(-2), updatedBy: 'u1' },
    { id: 'b-ret', subjectId: 's-ret', title: 'Søvejsreglerne i praksis', description: 'COLREG forklaret med eksempler fra danske farvande.', published: true, authorId: 'u1', createdAt: days(-30), updatedAt: days(-3), updatedBy: 'u1' },
    { id: 'b-stab', subjectId: 's-stab', title: 'Stabilitet for navigatører', description: 'Fra tyngdepunkt til GZ-kurve.', published: true, authorId: 'u2', createdAt: days(-25), updatedAt: days(-5), updatedBy: 'u2' },
    { id: 'b-el', subjectId: 's-el', title: 'El-drift på færger', description: 'Batteridrift, opladning og sikkerhed om bord.', published: false, authorId: 'u6', createdAt: days(-6), updatedAt: days(-1), updatedBy: 'u6' },
  ];
  const C = (id, bookId, order, title, content, published = true, by = 'u1', ago = -10) =>
    ({ id, bookId, order, title, content, published, createdAt: days(ago - 5), updatedAt: days(ago), updatedBy: by, revisions: [] });
  const chapters = [
    C('c-nav1', 'b-nav', 1, 'Søkortet', `## Hvad viser et søkort?

Søkortet er navigatørens vigtigste værktøj. Det viser **dybder**, **kystlinje**, **afmærkning** og **farer** – og danner grundlaget for al planlægning af en rejse.

### Mercators projektion
De fleste søkort er tegnet i *Mercators projektion*. Fordelen er, at en ret linje på kortet er en **loksodrom** – en kurs, der skærer alle meridianer under samme vinkel. Derfor kan en kurs aflæses direkte med transportør eller kursvinkel.

> Husk: Afstand måles altid på **breddeskalaen** ud for det sted, man måler. 1 bredde-minut = 1 sømil (1852 m).

### Dybder og højder
| Angivelse | Reference |
|---|---|
| Dybder | Kortdatum (typisk laveste astronomiske tidevand) |
| Højder på land | Middelvandstand |
| Frihøjde under broer | Højeste astronomiske tidevand |

### Opgave
1. Find kortets målestok og kortdatum på øvelseskortet.
2. Mål afstanden fra Marstal havn til Ærøskøbing i sømil.
`),
    C('c-nav2', 'b-nav', 2, 'Kurser: misvisning og deviation', `## Fra kompaskurs til rettevisende kurs

Et magnetkompas peger ikke mod den geografiske nordpol. To fejl skal korrigeres:

- **Misvisning (variation)** – forskellen mellem rettevisende nord og magnetisk nord. Står i kortets kompasrose og ændrer sig langsomt år for år.
- **Deviation** – skibets egen påvirkning af kompasset. Aflæses i skibets *deviationstabel* og afhænger af kursen.

### Regnereglen
\`\`\`
Rettevisende kurs = Magnetisk kurs + misvisning
Magnetisk kurs    = Kompaskurs + deviation
(østlig = +, vestlig = −)
\`\`\`

### Eksempel
Kompaskurs 085°, deviation 2° Ø, misvisning 3° V:

1. Magnetisk kurs = 085° + 2° = 087°
2. Rettevisende kurs = 087° − 3° = **084°**

> Huskeregel: *"Fra kompas til kort – læg østlig til."*
`),
    C('c-nav3', 'b-nav', 3, 'Strømtrekanten', `## Kurs gennem vandet og kurs over grunden

Når skibet sejler i strøm, bliver det sat ud af sin kurs. Strømtrekanten bruges til at finde den kurs, der skal styres, for at komme frem til målet.

### Trekantens tre sider
1. **Strømvektoren** – strømmens retning og fart i én time.
2. **Skibets fart gennem vandet** – afsat fra strømvektorens ende til kurslinjen.
3. **Kurs og fart over grunden (KOG/FOG)** – resultatet.

### Fremgangsmåde
1. Tegn kurslinjen fra position til mål.
2. Afsæt strømmen fra startpunktet.
3. Slå en cirkelbue med radius = skibets fart fra strømvektorens ende til kurslinjen.
4. Retningen fra strømvektorens ende til skæringspunktet er den **kurs der skal styres**.
`, false, 'u1', -2),
    C('c-ret1', 'b-ret', 1, 'Udkig, sikker fart og kollisionsfare (regel 5–8)', `## De fire grundregler

- **Regel 5 – Udkig:** Ethvert skib skal altid holde forsvarligt udkig *ved syn og hørelse* og med alle tilgængelige midler.
- **Regel 6 – Sikker fart:** Farten skal altid være så lav, at skibet kan træffe korrekt og effektiv manøvre og stoppe inden for en passende afstand.
- **Regel 7 – Kollisionsfare:** Ændrer et andet skibs kompaspejling sig ikke mærkbart, mens afstanden mindskes, er der kollisionsfare.
- **Regel 8 – Manøvre:** Manøvren skal foretages i god tid, være *tydelig* og stor nok til at blive opdaget af det andet skib.

> Er du i tvivl, om der er kollisionsfare – så **er** der kollisionsfare.
`),
    C('c-ret2', 'b-ret', 2, 'Overhaling, modsatte og skærende kurser (regel 13–15)', `## Hvem skal vige?

| Situation | Regel | Hvem viger |
|---|---|---|
| Overhaling | 13 | Det overhalende skib – altid |
| Modsatte kurser | 14 | Begge drejer til **styrbord** |
| Skærende kurser | 15 | Skibet, der har det andet om **styrbord** |

### Regel 15 i praksis
Ser du et andet maskindrevet skib om styrbord på skærende kurs, er du *vigepligtigt skib*. Undgå så vidt muligt at gå foran om det andet skib.
`),
    C('c-stab1', 'b-stab', 1, 'Tyngdepunkt, opdrift og metacenter', `## De tre vigtige punkter

- **G – tyngdepunktet:** hvor skibets samlede vægt virker nedad.
- **B – opdriftscentret:** tyngdepunktet af det fortrængte vand.
- **M – metacentret:** punktet, opdriften virker igennem ved små krængninger.

### Metacenterhøjden
\`\`\`
GM = KM − KG
\`\`\`
Et positivt GM betyder, at skibet er *stabilt* – det retter sig op efter en krængning. Er GM for stort, bliver skibet "stift" med hurtige, voldsomme rulninger.

> Lastes tungt gods højt i skibet, stiger KG – og GM falder.
`, true, 'u2', -5),
    C('c-el1', 'b-el', 1, 'Batterisystemer om bord', `## Opbygning

Et batterisystem på en elfærge består typisk af:

1. **Battericeller** samlet i moduler og strenge.
2. **BMS** (Battery Management System), der overvåger spænding, temperatur og ladetilstand.
3. **Ladeanlæg** i land, der lader under liggetiden i havn.

### Sikkerhed
- Batterirummet skal have ventilation og brandsikring.
- Kend proceduren ved *termisk løbskhed* – hvem gør hvad?

*Kapitlet er under udarbejdelse.*
`, false, 'u6', -1),
  ];
  const reads = [
    { userId: 'u3', chapterId: 'c-nav1', at: days(-6) },
    { userId: 'u3', chapterId: 'c-nav2', at: days(-3) },
    { userId: 'u4', chapterId: 'c-nav1', at: days(-4) },
  ];
  const activity = [
    { id: 'act1', at: days(-1), userId: 'u6', subjectId: 's-el', text: 'Redigerede kapitlet “Batterisystemer om bord” i “El-drift på færger”', link: '#/rediger-kapitel/c-el1' },
    { id: 'act2', at: days(-2), userId: 'u1', subjectId: 's-nav', text: 'Tilføjede kapitlet “Strømtrekanten” i “Navigation – grundbog”', link: '#/rediger-kapitel/c-nav3' },
    { id: 'act3', at: days(-5), userId: 'u2', subjectId: 's-stab', text: 'Udgav lærebogen “Stabilitet for navigatører”', link: '#/bog/b-stab' },
  ];

  return { users, subjects, materials, assignments, submissions, announcements, lessons, messages, books, chapters, reads, activity };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { seed };
else root.PortalSeed = { seed };
})(this);
