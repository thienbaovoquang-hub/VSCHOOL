import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNeoPhysics,
  evaluateEventWeatherRisk,
  formatAcademicCitation,
  mergeWorldBankMultiCountry,
  normalizeCrossrefWork,
  normalizeDatamuseList,
  normalizeGutendexBook,
  normalizeNasaApod,
  normalizeNasaMediaItems,
  normalizeNasaNeoFeed,
  normalizeNominatimResults,
  normalizePubChemPropertyRow,
  normalizeRestCountry,
  normalizeWikipediaSummary,
  normalizeWiktionaryEnRest,
  normalizeWiktionaryViExtract,
  normalizeWorldBankResponse,
  parseArxivAtomXml,
} from './externalIntegrations';
import {
  fetchNasaApod,
  lookupLexiconWord,
  lookupWikipediaSummary,
  searchAcademicPapers,
  searchRestCountries,
} from './externalIntegrationsProxy';

test('normalizeNominatimResults parses coordinates, address fields, and bounding box', () => {
  const results = normalizeNominatimResults([
    {
      place_id: 12345,
      lat: '16.0544068',
      lon: '108.2021667',
      display_name: 'Đà Nẵng, Việt Nam',
      name: 'Đà Nẵng',
      type: 'city',
      class: 'boundary',
      address: { city: 'Đà Nẵng', country: 'Việt Nam', country_code: 'vn' },
      boundingbox: ['15.9', '16.2', '107.9', '108.4'],
    },
  ]);

  assert.equal(results.length, 1);
  assert.equal(results[0].name, 'Đà Nẵng');
  assert.equal(results[0].lat, 16.05441);
  assert.equal(results[0].lon, 108.20217);
  assert.equal(results[0].countryCode, 'VN');
  assert.deepEqual(results[0].boundingBox, [15.9, 16.2, 107.9, 108.4]);
});

test('normalizePubChemPropertyRow builds formula, SMILES, exact molar weight, and PNG URL', () => {
  const compound = normalizePubChemPropertyRow(
    {
      CID: 2519,
      MolecularFormula: 'C8H10N4O2',
      MolecularWeight: 194.19,
      IUPACName: '1,3,7-trimethylpurine-2,6-dione',
      CanonicalSMILES: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',
      InChIKey: 'RYYVLZVUVIJVGH-UHFFFAOYSA-N',
      XLogP: -0.1,
      TPSA: 58.4,
      HBondDonorCount: 0,
      HBondAcceptorCount: 3,
    },
    { synonyms: ['Caffeine', '1,3,7-Trimethylxanthine'], queryTitle: 'caffeine' }
  );

  assert.ok(compound);
  assert.equal(compound.cid, 2519);
  assert.equal(compound.title, 'Caffeine');
  assert.equal(compound.molecularFormula, 'C8H10N4O2');
  assert.equal(compound.molecularWeight, 194.19);
  assert.equal(
    compound.imageUrl,
    'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2519/PNG?image_size=large'
  );
});

test('normalizeRestCountry and normalizeWorldBankResponse compute population density and sort time series', () => {
  const vn = normalizeRestCountry({
    cca3: 'VNM',
    cca2: 'VN',
    name: { common: 'Vietnam', official: 'Socialist Republic of Vietnam', nativeName: { vie: { common: 'Việt Nam' } } },
    capital: ['Hanoi'],
    region: 'Asia',
    subregion: 'South-Eastern Asia',
    population: 100000000,
    area: 331212,
    latlng: [16.1667, 107.8333],
    flags: { svg: 'https://flagcdn.com/vn.svg', png: 'https://flagcdn.com/w320/vn.png' },
    languages: { vie: 'Vietnamese' },
    currencies: { VND: { name: 'Vietnamese đồng', symbol: '₫' } },
  });

  assert.ok(vn);
  assert.equal(vn.nativeName, 'Việt Nam');
  assert.equal(vn.capital, 'Hanoi');
  assert.ok(vn.densityPerKm2 > 300);

  const wb = normalizeWorldBankResponse(
    [
      { page: 1 },
      [
        { country: { value: 'Viet Nam' }, indicator: { value: 'GDP per capita' }, date: '2023', value: 4282.1234 },
        { country: { value: 'Viet Nam' }, indicator: { value: 'GDP per capita' }, date: '2021', value: 3756.5 },
        { country: { value: 'Viet Nam' }, indicator: { value: 'GDP per capita' }, date: '2024', value: null },
      ],
    ],
    'VNM',
    'NY.GDP.PCAP.CD'
  );

  assert.equal(wb.points.length, 2);
  assert.equal(wb.points[0].year, 2021);
  assert.equal(wb.latestYear, 2023);
  assert.equal(wb.latestValue, 4282.123);
});

test('normalizeWikipediaSummary and normalizeGutendexBook handle valid and incomplete inputs', () => {
  const wiki = normalizeWikipediaSummary(
    {
      title: 'Trần Hưng Đạo',
      description: 'Danh tướng nhà Trần',
      extract: 'Hưng Đạo Đại Vương Trần Quốc Tuấn là một nhà quân sự kiệt xuất.',
      thumbnail: { source: 'https://upload.wikimedia.org/thumb.jpg' },
    },
    'vi'
  );
  assert.ok(wiki);
  assert.equal(wiki.title, 'Trần Hưng Đạo');
  assert.equal(wiki.lang, 'vi');

  const guten = normalizeGutendexBook({
    id: 1342,
    title: 'Pride and Prejudice',
    authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
    languages: ['en'],
    download_count: 50000,
    formats: {
      'image/jpeg': 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
      'text/plain; charset=utf-8': 'http://www.gutenberg.org/ebooks/1342.txt.utf-8',
    },
  });
  assert.ok(guten);
  assert.equal(guten.authorText, 'Austen, Jane');
  assert.equal(guten.textUrl, 'https://www.gutenberg.org/ebooks/1342.txt.utf-8');
});

test('parseArxivAtomXml and normalizeCrossrefWork normalize STEM citations and PDF links', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <feed xmlns="http://www.w3.org/2005/Atom">
    <entry>
      <id>http://arxiv.org/abs/2401.00001v1</id>
      <published>2024-01-02T12:00:00Z</published>
      <title>Quantum Optics in Educational Labs</title>
      <summary>A clear &amp; concise overview of Bell inequalities.</summary>
      <author><name>Nguyen Van A</name></author>
      <category term="quant-ph" />
      <link title="pdf" href="http://arxiv.org/pdf/2401.00001v1" />
    </entry>
  </feed>`;
  const arxiv = parseArxivAtomXml(xml);
  assert.equal(arxiv.length, 1);
  assert.equal(arxiv[0].source, 'arxiv');
  assert.equal(arxiv[0].arxivId, '2401.00001v1');
  assert.equal(arxiv[0].pdfUrl, 'https://arxiv.org/pdf/2401.00001v1');
  assert.equal(arxiv[0].abstract, 'A clear & concise overview of Bell inequalities.');

  const cr = normalizeCrossrefWork({
    DOI: '10.1038/s41586-020-2649-2',
    title: ['Array programming with <i>NumPy</i>'],
    author: [{ given: 'Charles R.', family: 'Harris' }],
    published: { 'date-parts': [[2020, 9, 16]] },
    'container-title': ['Nature'],
    'is-referenced-by-count': 24000,
  });
  assert.ok(cr);
  assert.equal(cr.title, 'Array programming with NumPy');
  assert.equal(cr.publishedDate, '2020-09-16');
  assert.equal(cr.citationCount, 24000);
});

test('NASA normalizers and computeNeoPhysics compute asteroid kinetic energy', () => {
  const physics = computeNeoPhysics(100, 20);
  assert.ok(physics.estimatedMassKg > 1e9);
  assert.ok(physics.kineticEnergyMegatons > 10);

  const apod = normalizeNasaApod({
    date: '2026-05-01',
    title: 'Carina Nebula',
    explanation: 'Deep space pillars.',
    media_type: 'image',
    url: 'https://apod.nasa.gov/apod/image/carina.jpg',
  });
  assert.ok(apod);
  assert.equal(apod.mediaType, 'image');

  const neo = normalizeNasaNeoFeed({
    near_earth_objects: {
      '2026-05-01': [
        {
          id: '99942',
          name: '99942 Apophis',
          is_potentially_hazardous_asteroid: true,
          estimated_diameter: { meters: { estimated_diameter_min: 310, estimated_diameter_max: 370 } },
          close_approach_data: [
            {
              close_approach_date: '2026-05-01',
              relative_velocity: { kilometers_per_second: '12.6' },
              miss_distance: { kilometers: '38000', lunar: '0.1' },
            },
          ],
        },
      ],
    },
  });
  assert.equal(neo.length, 1);
  assert.equal(neo[0].isPotentiallyHazardous, true);
  assert.equal(neo[0].missDistanceKm, 38000);

  const media = normalizeNasaMediaItems({
    collection: {
      items: [
        {
          data: [{ nasa_id: 'JWST-1', title: 'JWST Deep Field', description: 'First deep image' }],
          links: [{ render: 'image', href: 'https://images-assets.nasa.gov/jwst.jpg' }],
        },
      ],
    },
  });
  assert.equal(media.length, 1);
  assert.equal(media[0].nasaId, 'JWST-1');
});

test('Datamuse + Wiktionary normalizers and lookupLexiconWord merge cleanly without dictionaryapi.dev', async () => {
  const wikt = normalizeWiktionaryEnRest({
    en: [
      {
        partOfSpeech: 'Adjective',
        definitions: [
          { definition: 'Able to recover quickly from adversity.', examples: ['Resilient learners adapt fast.'] },
        ],
      },
    ],
  });
  assert.equal(wikt.length, 1);
  assert.equal(wikt[0].partOfSpeech, 'Adjective');

  const dm = normalizeDatamuseList([
    { word: 'tough', score: 900, tags: ['ipa_pron:tʌf'] },
    { word: 'flexible', score: 850 },
  ]);
  assert.equal(dm[0].word, 'tough');

  const wiktVi = normalizeWiktionaryViExtract({
    query: {
      pages: {
        '1': { extract: '=== Danh từ ===\nHọc vấn, kiến thức sách vở.' },
      },
    },
  });
  assert.equal(wiktVi.length, 1);

  const requestedUrls: string[] = [];
  const mockFetch: typeof fetch = async (input) => {
    const u = String(input);
    requestedUrls.push(u);
    if (u.includes('wiktionary.org/api/rest_v1')) {
      return new Response(
        JSON.stringify({
          en: [{ partOfSpeech: 'Adjective', definitions: [{ definition: 'Recovering fast.' }] }],
        }),
        { status: 200 }
      );
    }
    if (u.includes('rel_syn')) {
      return new Response(JSON.stringify([{ word: 'adaptable', score: 1000 }]), { status: 200 });
    }
    if (u.includes('rel_ant')) {
      return new Response(JSON.stringify([{ word: 'fragile', score: 900 }]), { status: 200 });
    }
    if (u.includes('qe=sp')) {
      return new Response(JSON.stringify([{ word: 'resilient', tags: ['ipa_pron:rɪˈzɪliənt'] }]), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };

  const entry = await lookupLexiconWord('resilient', { fetchImpl: mockFetch });
  assert.equal(entry.word, 'resilient');
  assert.equal(entry.ipa, '/rɪˈzɪliənt/');
  assert.deepEqual(entry.synonyms, ['adaptable']);
  assert.deepEqual(entry.antonyms, ['fragile']);
  assert.equal(requestedUrls.some((u) => u.includes('dictionaryapi.dev')), false);
});

test('searchAcademicPapers gracefully degrades when one upstream fails', async () => {
  const mockFetch: typeof fetch = async (input) => {
    const u = String(input);
    if (u.includes('crossref.org')) {
      return new Response('Rate limited', { status: 429 });
    }
    return new Response(
      `<feed><entry><id>https://arxiv.org/abs/2501.12345</id><title>Test Paper</title><summary>Abstract</summary><published>2025-01-10T00:00:00Z</published><author><name>Ada</name></author></entry></feed>`,
      { status: 200 }
    );
  };

  const res = await searchAcademicPapers('test', 'all', { fetchImpl: mockFetch });
  assert.equal(res.results.length, 1);
  assert.equal(res.results[0].source, 'arxiv');
  assert.equal(res.results.length > 0, true);
  assert.equal(res.warnings.length, 1);
});

test('mergeWorldBankMultiCountry aligns years across multiple country series', () => {
  const vn = normalizeWorldBankResponse(
    [
      {},
      [
        { country: { value: 'Viet Nam' }, date: '2022', value: 4.1 },
        { country: { value: 'Viet Nam' }, date: '2021', value: 3.9 },
      ],
    ],
    'VNM',
    'SE.XPD.TOTL.GD.ZS'
  );
  const jp = normalizeWorldBankResponse(
    [
      {},
      [
        { country: { value: 'Japan' }, date: '2023', value: 3.4 },
        { country: { value: 'Japan' }, date: '2021', value: 3.2 },
      ],
    ],
    'JPN',
    'SE.XPD.TOTL.GD.ZS'
  );
  const merged = mergeWorldBankMultiCountry([vn, jp]);
  assert.equal(merged.indicatorId, 'SE.XPD.TOTL.GD.ZS');
  assert.equal(merged.unit, '% GDP');
  assert.deepEqual(merged.years, [2021, 2022, 2023]);
  assert.equal(merged.rows[1].values.VNM, 4.1);
  assert.equal(merged.rows[1].values.JPN, null);
  assert.equal(merged.rows[2].values.JPN, 3.4);
});

test('formatAcademicCitation formats BibTeX, APA, and IEEE reliably', () => {
  const paper = {
    source: 'crossref' as const,
    title: 'Attention Is All You Need',
    authors: ['Ashish Vaswani', 'Noam Shazeer'],
    authorText: 'Ashish Vaswani, Noam Shazeer',
    publishedYear: 2017,
    venue: 'NeurIPS',
    doi: '10.5555/3295222.3295349',
    url: 'https://doi.org/10.5555/3295222.3295349',
  };
  const bib = formatAcademicCitation(paper, 'bibtex');
  assert.ok(bib.startsWith('@article{'));
  assert.ok(bib.includes('author = {Ashish Vaswani and Noam Shazeer}'));
  assert.ok(bib.includes('doi = {10.5555/3295222.3295349}'));

  const apa = formatAcademicCitation(paper, 'apa');
  assert.ok(apa.includes('Ashish Vaswani, Noam Shazeer (2017). Attention Is All You Need. NeurIPS.'));

  const ieee = formatAcademicCitation(paper, 'ieee');
  assert.ok(ieee.includes('"Attention Is All You Need," NeurIPS, 2017.'));
});

test('evaluateEventWeatherRisk classifies safe, caution, and warning conditions', () => {
  const safe = evaluateEventWeatherRisk({ precipitationProbabilityMax: 10, windSpeedMax: 12, tempMax: 29, weatherCode: 1 });
  assert.equal(safe.level, 'safe');

  const caution = evaluateEventWeatherRisk({ precipitationProbabilityMax: 50, windSpeedMax: 20, tempMax: 31, weatherCode: 61 });
  assert.equal(caution.level, 'caution');

  const warning = evaluateEventWeatherRisk({ precipitationProbabilityMax: 85, windSpeedMax: 48, tempMax: 28, weatherCode: 95 });
  assert.equal(warning.level, 'warning');
});

test('normalizeWiktionaryViExtract groups multiple POS headings when present', () => {
  const meanings = normalizeWiktionaryViExtract({
    query: {
      pages: {
        '42': {
          extract: '== Tiếng Việt ==\n=== Danh từ ===\nVật thể phát sáng.\n=== Động từ ===\nChiếu rọi ánh sáng.',
        },
      },
    },
  });
  assert.equal(meanings.length, 2);
  assert.equal(meanings[0].partOfSpeech, 'Danh từ');
  assert.equal(meanings[1].partOfSpeech, 'Động từ');
});

test('normalizeRestCountry supports APICountries v2-extended shape and searchRestCountries resolves Vietnamese aliases', async () => {
  const apiCountry = normalizeRestCountry({
    name: 'Vietnam',
    alpha2Code: 'VN',
    alpha3Code: 'VNM',
    capital: 'Hanoi',
    region: 'Asia',
    subregion: 'South-Eastern Asia',
    population: 100300000,
    area: 331212,
    populationDensity: 302.8,
    latlng: [16.1666, 107.8333],
    nativeName: 'Việt Nam',
    flags: { svg: 'https://flagcdn.com/vn.svg', png: 'https://flagcdn.com/w320/vn.png' },
    languages: [{ name: 'Vietnamese', nativeName: 'Tiếng Việt' }],
    currencies: [{ code: 'VND', name: 'Vietnamese đồng', symbol: '₫' }],
    borders: ['KHM', 'CHN', 'LAO'],
  });
  assert.ok(apiCountry);
  assert.equal(apiCountry.cca3, 'VNM');
  assert.equal(apiCountry.nativeName, 'Việt Nam');
  assert.equal(apiCountry.capital, 'Hanoi');
  assert.deepEqual(apiCountry.languages, ['Vietnamese']);
  assert.deepEqual(apiCountry.currencies, ['VND - Vietnamese đồng (₫)']);

  let seenUrl = '';
  const mockFetch: typeof fetch = async (input) => {
    seenUrl = String(input);
    return new Response(
      JSON.stringify([
        {
          name: 'Vietnam',
          alpha2Code: 'VN',
          alpha3Code: 'VNM',
          capital: 'Hanoi',
          region: 'Asia',
          population: 100300000,
          area: 331212,
          flags: { png: 'https://flagcdn.com/w320/vn.png' },
        },
      ]),
      { status: 200 }
    );
  };
  const found = await searchRestCountries('Việt Nam', '', { fetchImpl: mockFetch });
  assert.equal(found.length, 1);
  assert.equal(found[0].cca3, 'VNM');
  assert.ok(seenUrl.includes('apicountries.com/name/vietnam'));
});

test('fetchNasaApod gracefully falls back when api.nasa.gov returns 429 DEMO_KEY limit', async () => {
  const mockFetch: typeof fetch = async (input) => {
    const u = String(input);
    if (u.includes('api.nasa.gov/planetary/apod')) {
      return new Response(JSON.stringify({ error: { code: 'OVER_RATE_LIMIT' } }), { status: 429 });
    }
    if (u.includes('science.nasa.gov/apod')) {
      return new Response(
        '<html><head><meta property="og:title" content="APOD: Carina Nebula"><meta property="og:image" content="https://assets.science.nasa.gov/carina.jpg"><meta property="og:description" content="Cosmic cliffs"></head></html>',
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ collection: { items: [] } }), { status: 200 });
  };

  const apod = await fetchNasaApod('', { fetchImpl: mockFetch });
  assert.ok(apod);
  assert.equal(apod.title, 'Carina Nebula');
  assert.equal(apod.url, 'https://assets.science.nasa.gov/carina.jpg');
});

test('lookupWikipediaSummary prefers domain-matched article when context=literature or context=history', async () => {
  const mockFetch: typeof fetch = async (input) => {
    const u = String(input);
    if (u.includes('Quang_D%C5%A9ng_(nh%C3%A0_th%C6%A1)')) {
      return new Response(
        JSON.stringify({
          title: 'Quang Dũng (nhà thơ)',
          description: 'Nhà thơ Việt Nam',
          extract: 'Quang Dũng là tác giả bài thơ Tây Tiến.',
        }),
        { status: 200 }
      );
    }
    if (u.endsWith('/api/rest_v1/page/summary/Quang_D%C5%A9ng')) {
      return new Response(JSON.stringify({ type: 'disambiguation', title: 'Quang Dũng' }), { status: 200 });
    }
    if (u.includes('w/api.php')) {
      return new Response(
        JSON.stringify({
          query: {
            search: [
              { title: 'Quang Dũng (ca sĩ)', snippet: 'Là một ca sĩ nhạc nhẹ nổi tiếng' },
              { title: 'Quang Dũng (nhà thơ)', snippet: 'Là một nhà thơ Việt Nam tác giả bài thơ Tây Tiến' },
            ],
          },
        }),
        { status: 200 }
      );
    }
    return new Response('{}', { status: 404 });
  };

  const summary = await lookupWikipediaSummary('Quang Dũng', 'vi', {
    fetchImpl: mockFetch,
    context: 'literature',
  });
  assert.ok(summary);
  assert.equal(summary.title, 'Quang Dũng (nhà thơ)');
});

