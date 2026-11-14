// Startdata for portalen. Køres automatisk første gang serveren starter,
// eller med `npm run reset` for at nulstille databasen.
'use strict';

function seed(hashPassword) {
  const now = Date.now();
  const days = (n) => new Date(now + n * 86400000).toISOString();

  const users = [
    { id: 'u1', username: 'lars', name: 'Lars Holm', role: 'teacher', password: hashPassword('laerer123') },
    { id: 'u2', username: 'mette', name: 'Mette Bruun', role: 'teacher', password: hashPassword('laerer123') },
    { id: 'u3', username: 'anna', name: 'Anna Jensen', role: 'student', className: 'Skibsfører 2026A', password: hashPassword('elev123') },
    { id: 'u4', username: 'jonas', name: 'Jonas Madsen', role: 'student', className: 'Skibsfører 2026A', password: hashPassword('elev123') },
    { id: 'u5', username: 'freja', name: 'Freja Nielsen', role: 'student', className: 'Skibsfører 2026A', password: hashPassword('elev123') },
  ];
  const allStudents = ['u3', 'u4', 'u5'];

  const subjects = [
    {
      id: 's-nav', code: 'NAV', name: 'Navigation', color: '#1f5f9e',
      description: 'Terrestrisk og elektronisk navigation, søkort, kurser, tidevand, ECDIS og radar/ARPA.',
      teacherIds: ['u1'], studentIds: allStudents,
    },
    {
      id: 's-tek', code: 'TEK', name: 'Skibsteknik', color: '#a2552a',
      description: 'Skibets konstruktion, maskineri, hjælpesystemer, materialer og vedligehold.',
      teacherIds: ['u2'], studentIds: allStudents,
    },
    {
      id: 's-ret', code: 'RET', name: 'Søret', color: '#5b3f8c',
      description: 'Sølov, søvejsregler (COLREG), internationale konventioner (SOLAS, MARPOL, STCW) og ansvar til søs.',
      teacherIds: ['u1'], studentIds: allStudents,
    },
    {
      id: 's-stab', code: 'STAB', name: 'Stabilitet & lastbehandling', color: '#2a7f62',
      description: 'Tyngdepunkt, metacenter, GZ-kurver, trim, lastplanlægning og surring.',
      teacherIds: ['u2'], studentIds: allStudents,
    },
    {
      id: 's-sik', code: 'SIK', name: 'Sikkerhed & beredskab', color: '#b23a48',
      description: 'Brandbekæmpelse, redningsmidler, førstehjælp, ISM-koden og beredskabsplaner.',
      teacherIds: ['u2'], studentIds: allStudents,
    },
    {
      id: 's-met', code: 'MET', name: 'Meteorologi & oceanografi', color: '#3b7ea1',
      description: 'Vejrsystemer, vejrkort, vind og bølger, strøm og planlægning efter vejret.',
      teacherIds: ['u1'], studentIds: allStudents,
    },
    {
      id: 's-eng', code: 'ENG', name: 'Maritim engelsk', color: '#6b6b2a',
      description: 'SMCP (Standard Marine Communication Phrases), VHF-kommunikation og fagterminologi.',
      teacherIds: ['u1'], studentIds: allStudents,
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

  const assignments = [
    { id: 'a1', subjectId: 's-nav', title: 'Strømtrekant – opgave 1-5', description: 'Løs opgave 1-5 i kompendiet. Vis beregninger og vedhæft eventuelt et billede af din konstruktion (indsæt link).', due: days(5), createdAt: days(-7), authorId: 'u1' },
    { id: 'a2', subjectId: 's-ret', title: 'Case: Kollision i Storebælt', description: 'Analysér casen ud fra COLREG regel 5, 7, 8 og 15. Hvem havde vigepligten, og hvad burde være gjort anderledes?', due: days(9), createdAt: days(-3), authorId: 'u1' },
    { id: 'a3', subjectId: 's-tek', title: 'Brændstofsystemet', description: 'Tegn og beskriv brændstofsystemet fra bunkertank til indsprøjtningsventil.', due: days(-2), createdAt: days(-14), authorId: 'u2' },
    { id: 'a4', subjectId: 's-stab', title: 'GM-beregning efter lastning', description: 'Beregn ny KG og GM efter lastning af de tre partier i bilaget.', due: days(12), createdAt: days(-1), authorId: 'u2' },
  ];

  const submissions = [
    { id: 'sub1', assignmentId: 'a3', studentId: 'u3', text: 'Brændstoffet pumpes fra bunkertanken til bundfældningstanken, derefter separatoren og dagtanken ...', submittedAt: days(-3), grade: '10', feedback: 'Flot og grundig beskrivelse. Husk viskositetsregulatoren.', gradedAt: days(-1) },
    { id: 'sub2', assignmentId: 'a3', studentId: 'u4', text: 'Bunkertank → settling tank → separator → service tank → booster pumpe → motor.', submittedAt: days(-2), grade: null, feedback: '', gradedAt: null },
    { id: 'sub3', assignmentId: 'a1', studentId: 'u3', text: 'Opgave 1: KDV = 087°, FOG = 9,4 kn ...', submittedAt: days(-1), grade: null, feedback: '', gradedAt: null },
  ];

  const announcements = [
    { id: 'n1', subjectId: 's-nav', title: 'Simulatortimer i uge 48', body: 'Vi bruger broens simulator tirsdag og torsdag. Mød op kl. 08:15 i simulatorbygningen.', createdAt: days(-2), authorId: 'u1' },
    { id: 'n2', subjectId: 's-sik', title: 'Brandkursus på Svendborg', body: 'Husk arbejdstøj og sikkerhedssko til den praktiske brandøvelse fredag.', createdAt: days(-1), authorId: 'u2' },
  ];

  return { users, subjects, materials, assignments, submissions, announcements };
}

module.exports = { seed };
