/** Canonical legal document versions + Creole content for TOUPRE V1. */

export const LEGAL_VERSION = '2026-07-30';

export type LegalDocKey =
  | 'privacy'
  | 'terms'
  | 'vendor-terms'
  | 'classified-policy'
  | 'payment-policy'
  | 'refund-policy';

export type LegalDoc = {
  key: LegalDocKey;
  title: string;
  version: string;
  updatedAt: string;
  summary: string;
  sections: { heading: string; body: string }[];
};

export const LEGAL_DOCS: Record<LegalDocKey, LegalDoc> = {
  privacy: {
    key: 'privacy',
    title: 'Règleman sou Vi Prive',
    version: LEGAL_VERSION,
    updatedAt: '30 Jiyè 2026',
    summary: 'Kijan TOUPRE kolekte, itilize, epi pwoteje done pèsonèl ou.',
    sections: [
      {
        heading: '1. Done nou kolekte',
        body: 'Nou ka kolekte non, imèl, telefòn, adrès, dokiman KYC (pou vandè), istwa kòmand, mesaj, epi idantifyan MonCash ou bay pou peman oswa retrè.',
      },
      {
        heading: '2. Itilizasyon',
        body: 'Done yo sèvi pou kreye kont, trete kòmand, verifye vandè, anpeche fwod, bay sipò, epi amelyore sèvis la. Nou pa vann done pèsonèl ou bay twazyèm pati pou maketing.',
      },
      {
        heading: '3. Pataj',
        body: 'Nou ka pataje done ak founisè teknik (egzanp Supabase, Resend) ak founisè peman (MonCash) selon nesesite pou trete tranzaksyon. Nou ka divilge done si lalwa mande sa.',
      },
      {
        heading: '4. Sekirite ak retansyon',
        body: 'Nou itilize kontwòl aksè (RLS), lyen siyen pou dokiman prive, epi pratik sekirite rezonab. Nou kenbe done pandan kont ou aktif epi selon egzijans legal.',
      },
      {
        heading: '5. Dwa ou',
        body: 'Ou ka mande aksè, koreksyon, oswa efasman done selon sa ki posib legalman. Kontakte: toupreed@gmail.com.',
      },
    ],
  },
  terms: {
    key: 'terms',
    title: 'Tèm ak Kondisyon',
    version: LEGAL_VERSION,
    updatedAt: '30 Jiyè 2026',
    summary: 'Règleman jeneral pou itilize platfòm TOUPRE.',
    sections: [
      {
        heading: '1. Akseptasyon',
        body: 'Lè w kreye yon kont oswa itilize TOUPRE, ou aksepte tèm sa yo epi Règleman sou Vi Prive a.',
      },
      {
        heading: '2. Kont',
        body: 'Ou responsab pou enfòmasyon ou bay yo ak sekirite modpas ou. Yon moun dwe gen omwen 18 an pou vann sou TOUPRE.',
      },
      {
        heading: '3. Marketplace vs Anons',
        body: 'Pwodwi marketplace (manje, rad, elatriye) ka achte nan panye. Anons Kay/Machin se pou kontak vandè sèlman — pa gen achte nan platfòm lan.',
      },
      {
        heading: '4. Konduit',
        body: 'Entèdi: fwod, kontni ilegal, spam, abi itilizatè, oswa vyolasyon dwa lòt moun. TOUPRE ka sispann kont ki vyole règleman yo.',
      },
      {
        heading: '5. Limit responsablite',
        body: 'TOUPRE fasilite koneksyon ant kliyan ak vandè. Pou anons Kay/Machin, tranzaksyon final fèt ant pati yo. Pou kòmand marketplace, responsablite livrezon rete sou vandè a selon règleman lòd yo.',
      },
    ],
  },
  'vendor-terms': {
    key: 'vendor-terms',
    title: 'Tèm Vandè',
    version: LEGAL_VERSION,
    updatedAt: '30 Jiyè 2026',
    summary: 'Obligasyon espesyal pou vandè ki vann oswa pibliye anons sou TOUPRE.',
    sections: [
      {
        heading: '1. KYC',
        body: 'Vandè dwe konplete verifikasyon idantite (KYC) avan yo vann. Dokiman fo oswa enkonplè ka mennen nan rejè oswa sispansyon.',
      },
      {
        heading: '2. Komisyon ak retrè',
        body: 'TOUPRE ka prelve komisyon sou kòmand. Retrè fèt via MonCash selon pwosesis admin. Vandè dwe bay enfòmasyon MonCash ki kòrèk.',
      },
      {
        heading: '3. Kalite ak livrezon',
        body: 'Vandè responsab pou deskripsyon pwodwi, stok, tan livrezon, epi prèv livrezon lè sa nesesè.',
      },
      {
        heading: '4. Anons Kay/Machin',
        body: 'Anons mande frè piblisite. Anons ekspire pa efase; yo ka renouvle. Kontni dwe vre epi legal.',
      },
    ],
  },
  'classified-policy': {
    key: 'classified-policy',
    title: 'Règleman Anons Kay & Machin',
    version: LEGAL_VERSION,
    updatedAt: '30 Jiyè 2026',
    summary: 'Ki jan anons Kay/Machin fonksyone sou TOUPRE.',
    sections: [
      {
        heading: '1. Frè ak dire',
        body: 'Frè anons Kay ak Machin ak dire (pa defo 30 jou) konfigire pa Admin. Frè a se pou piblisite sèlman.',
      },
      {
        heading: '2. Sik lavi',
        body: 'Soumèt → Peye/verifye frè (oswa waive admin) → Apwobasyon → Aktif → Ekspire. Ekspire pa efase; vandè ka renouvle.',
      },
      {
        heading: '3. Contact Seller',
        body: 'Pa gen panye ni checkout pou Kay/Machin. Kliyan kontakte vandè a dirèkteman (mesaj/telefòn).',
      },
      {
        heading: '4. Modération',
        body: 'Admin ka rejte anons ki fo, ilegal, oswa ki pa respekte règleman.',
      },
    ],
  },
  'payment-policy': {
    key: 'payment-policy',
    title: 'Règleman Peman',
    version: LEGAL_VERSION,
    updatedAt: '30 Jiyè 2026',
    summary: 'Kijan peman fonksyone sou TOUPRE (MonCash).',
    sections: [
      {
        heading: '1. Metòd',
        body: 'Peman prensipal se MonCash (HTG). Lòt founisè ka ajoute pita. Sechè yo rete sou sèvè (Edge), pa nan aplikasyon kliyan an.',
      },
      {
        heading: '2. Frè anons',
        body: 'Frè Kay/Machin peye atravè MonCash oswa verifye/waive pa admin. Anons pa piblik jiskaske frè a satisfè epi admin apwouve.',
      },
      {
        heading: '3. Kòmand marketplace',
        body: 'Kòmand ka kreye ak estati unpaid jiskaske peman konfime. TOUPRE verifye tranzaksyon MonCash atravè API ofisyèl + webhook/return.',
      },
      {
        heading: '4. Retrè vandè',
        body: 'Retrè mande admin. Peman retrè fèt selon pwosesis MonCash / operasyon.',
      },
    ],
  },
  'refund-policy': {
    key: 'refund-policy',
    title: 'Rembousman ak Diskisyon',
    version: LEGAL_VERSION,
    updatedAt: '30 Jiyè 2026',
    summary: 'Ki jan rembousman ak diskisyon trete.',
    sections: [
      {
        heading: '1. Marketplace',
        body: 'Si pwodwi pa livre oswa pa koresponn, kliyan ka louvri yon diskisyon ak vandè a epi kontakte sipò TOUPRE (toupreed@gmail.com) ak prèv.',
      },
      {
        heading: '2. Anons Kay/Machin',
        body: 'Frè anons jeneralman pa rembousab apre anons lan apwouve epi pibliye. Ka espesyal (erè teknik, doub chaj) ka revize.',
      },
      {
        heading: '3. MonCash',
        body: 'Rembousman ki depann de MonCash suiv règleman Digicel MonCash epi pwosesis admin TOUPRE.',
      },
      {
        heading: '4. Delè',
        body: 'Rapòte pwoblèm peman oswa livrezon pi vit posib (idealman nan 7 jou apre tranzaksyon an).',
      },
    ],
  },
};

export const LEGAL_NAV: { key: LegalDocKey; path: string; title: string }[] = [
  { key: 'terms', path: '#/legal/terms', title: 'Tèm ak Kondisyon' },
  { key: 'privacy', path: '#/legal/privacy', title: 'Vi Prive' },
  { key: 'vendor-terms', path: '#/legal/vendor-terms', title: 'Tèm Vandè' },
  { key: 'classified-policy', path: '#/legal/classified-policy', title: 'Anons Kay/Machin' },
  { key: 'payment-policy', path: '#/legal/payment-policy', title: 'Peman' },
  { key: 'refund-policy', path: '#/legal/refund-policy', title: 'Rembousman' },
];
