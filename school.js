// Skoleoplysninger hentet fra https://www.marnav.dk og https://marnav.nemtilmeld.dk (14. nov. 2026).
// Opdatér her, når skolens hjemmeside ændres.
'use strict';

const SITE = 'https://www.marnav.dk';

module.exports = {
  source: { url: SITE, fetched: '2026-11-14' },
  contact: {
    name: 'Marstal Navigationsskole',
    tagline: 'Maritim uddannelsesinstitution',
    address: 'Ellenet 10, 5960 Marstal',
    phone: '+45 62 53 10 75',
    email: 'marnav@marnav.dk',
    website: SITE,
  },
  practical: [
    'Ingen skolepenge på uddannelserne',
    'Uddannelserne er SU-berettigede',
    'Kollegieværelser formidles gennem Sydfyns Almene Boliger – kan du ikke finde bolig, så skriv til marnav@marnav.dk',
    'Opgaver afleveres i den daglige undervisning via skolens intranet (Itslearning)',
  ],
  educations: [
    {
      id: 'hf-soefart', name: 'HF-Søfart', level: 'Ungdomsuddannelse',
      duration: '3 år (6 semestre) · start i august',
      summary: 'Fuld HF-eksamen kombineret med første modul af skibsofficersuddannelsen og uddannelse som skibsassistent. Udbydes sammen med VUC Fyn Ærø – med skolehjem.',
      requirements: ['Afsluttet 9. klasse med tilfredsstillende resultat', 'Normalt syn og ikke farveblind', 'Lægeundersøgelse til Blå Bog'],
      outcome: ['Fuld HF-eksamen', 'Job som aspirant eller skibsassistent', 'Videre til Kystskipper, Skibsfører, Maskinmester m.fl.'],
      extra: ['Søfartslinjer (3. år): Nautisk offshore · Maskin-teknisk · HF-højniveau og Shipping', 'HF-pakker: Science 1 & 2 · Mental & Physical · Shipping & Business · Sports, Health & Environment'],
      url: `${SITE}/hf-soefart/hf-soefart`,
    },
    {
      id: 'kystskipper', name: 'Kystskipper', level: 'Navigatøruddannelse',
      duration: '1 semester (20 uger) · start januar og august',
      summary: 'Grundlæggende navigatøruddannelse og adgangsvej til Sætteskipper og Skibsfører.',
      requirements: ['Gyldigt helbredsbevis (Blå bog)', '12 måneders sejltid i handelsskibe over 20 BT', 'Vagtholdsbevis', 'Udfyldt uddannelsesbog', 'Søfartsskolebevis'],
      outcome: ['Bevis som styrmand af 4. grad (styrmand i skibe op til 500 BT)', 'Efter 1 år som styrmand: sønæringsbevis som Kystskipper (fører af skibe op til 500 BT i kystfart)'],
      extra: ['Forhåndsmerit: Brandleder, ROC, Duelighedsbevis i motorpasning, Særlige sikringsopgaver, Sundhedskursus B'],
      url: `${SITE}/uddannelserne/kystskipper`,
    },
    {
      id: 'kystskipper-online', name: 'Kystskipper online', level: 'Navigatøruddannelse',
      duration: '1 semester (20 uger) · start januar og august',
      summary: 'Fleksibel, primært online Kystskipper – læs i eget tempo, også mens du sejler. Personlig vejleder og studiegruppe.',
      requirements: ['Samme som Kystskipper'],
      outcome: ['Samme beviser som Kystskipper'],
      extra: ['Obligatorisk fremmøde: Sundhed B (5 dage, Fanø) · Brandledelse (2 dage, Svendborg) · Simulatorsejlads (4 dage, Marstal) · Radar/ARPA og ECDIS (4 dage, Marstal) · Eksamen (3 dage, Marstal)'],
      url: `${SITE}/uddannelserne/kystskipper-online`,
    },
    {
      id: 'faergenavigatoer', name: 'Færgenavigatør', level: 'Navigatøruddannelse',
      duration: '14 måneder · næste hold 10. maj 2027 – juni 2028',
      summary: 'Danmarks eneste godkendte færgenavigatøruddannelse – til små lokal-, ø- og genvejsfærger under 500 BT. Skole og lønnet praktik på færge.',
      requirements: ['Underskrevet praktikaftale med et dansk færgerederi', 'Min. 2 års relevant eller 5 års generel erhvervserfaring', 'Helbredsbevis og udkigsegnethed fra søfartslæge', 'Min. 2,0 i snit i dansk og matematik fra 9./10. klasse'],
      outcome: ['Sønæringsbevis som færgenavigatør (Søfartsstyrelsen)'],
      extra: ['Forløb: 4 ugers skole → 6 måneders praktik → 20 ugers skole med eksamen', 'Fag: Sømandskab · Sikkerhed · Navigation · El-drift · Kommunikation, service og turisme', 'Røgdykkerkursus i Svendborg og ROC-kursus på skolen'],
      url: `${SITE}/uddannelserne/faergenavigatoer`,
    },
    {
      id: 'saetteskipper', name: 'Sætteskipper', level: 'Navigatøruddannelse',
      duration: 'De første 2 semestre af Skibsføreruddannelsen',
      summary: 'Lederuddannelse med ansvar for skibets drift. Du indskrives på Skibsføreruddannelsen og får Sætteskipper-eksamen efter 2 semestre.',
      requirements: ['Indskrivning på Skibsføreruddannelsen'],
      outcome: ['Bevis som styrmand af 3. grad', 'Efter 1 år som styrmand: styrmand af 1. grad', 'Efter 24 måneders sejltid: Sætteskipper – fører af skibe op til 3.000 BT'],
      extra: [],
      url: `${SITE}/uddannelserne/saetteskipper`,
    },
    {
      id: 'skibsfoerer', name: 'Skibsfører', level: 'Navigatøruddannelse',
      duration: '2 år (4 semestre) · start januar og august',
      summary: 'Lederuddannelse med verden som arbejdsplads: navigation, havneoperationer, besætningsledelse, sikkerhed, skibsregnskab og lastpapirer.',
      requirements: ['Bestået Kystskipperuddannelsen', '12 måneders sejltid, heraf 6 måneder i skibe over 500 BT uden for kystfart'],
      outcome: ['Bevis som styrmand af 2. grad – styrmand i skibe af enhver størrelse', 'Sætteskipper-bevis efter 2 semestre', 'Med sejltid: styrmand af 1. grad og sønæringsbevis som skibsfører – fører af alle skibe i alle farvande'],
      extra: ['Forhåndsmerit: GOC, SSO, §16-kursus, Sundhedskursus A', 'Job: danske og udenlandske skibe, lods, offshore – og senere i land'],
      url: `${SITE}/uddannelserne/skibsfoerer`,
    },
    {
      id: 'aspirant', name: 'Aspirant', level: 'Fleksibelt forløb',
      duration: 'Under praktiktiden til søs',
      summary: 'Læs 1. semester af Skibsføreruddannelsen under din praktik. Du får en mentor blandt skolens lærere og adgang til intranettet med eksamensmodulerne.',
      requirements: ['Aspirant- eller praktikplads i et rederi', 'Bestået optagelsesprøve før start på Skibsfører'],
      outcome: ['Består du optagelsesprøven, forkortes Skibsfører fra 2½ til 2 år'],
      extra: [],
      url: `${SITE}/uddannelserne/aspirant`,
    },
    {
      id: 'laes-mens-du-sejler', name: 'Læs mens du sejler', level: 'Fleksibelt forløb',
      duration: 'Sidste 2 semestre af Skibsfører · skal afsluttes inden for 2 år',
      summary: 'Tjen penge mens du læser: den sidste del af Skibsfører tages fleksibelt uden fast fremmøde. Afleveringer via Itslearning og planlagt vejledning i hjemmeperioder.',
      requirements: ['Optaget på Skibsføreruddannelsen'],
      outcome: ['Samme eksamen som Skibsfører – eksamener i juni og december'],
      extra: [],
      url: `${SITE}/uddannelserne/laes-mens-du-sejler`,
    },
    {
      id: 'generhvervelse', name: 'Generhvervelse', level: 'Efteruddannelse',
      duration: '–', summary: 'Generhvervelse af beviser. Se detaljer på skolens hjemmeside.',
      requirements: [], outcome: [], extra: [],
      url: `${SITE}/uddannelserne/generhvervelse`,
    },
  ],
};
