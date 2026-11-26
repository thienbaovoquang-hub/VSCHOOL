import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBookFromExternalResult,
  buildGoogleBooksQuery,
  buildOpenLibrarySearchParams,
  findCatalogDuplicateBook,
  mapSubjectsToBookCategory,
  mergeBookEnrichment,
  mergeExternalBookResults,
  normalizeGoogleBooksVolume,
  normalizeIsbn,
  normalizeOpenLibraryBookData,
  normalizeOpenLibraryDoc,
} from './libraryExternalApis';
import {
  createExternalBookCache,
  enrichBookFromExternalApis,
  lookupExternalBookByIsbn,
  searchExternalBooks,
} from './libraryExternalProxy';
import type { Book } from '../types';

test('normalizeIsbn cleans hyphens/spaces and validates ISBN-10/13 lengths', () => {
  assert.equal(normalizeIsbn('978-0-13-468599-1'), '9780134685991');
  assert.equal(normalizeIsbn('0-306-40615-2'), '0306406152');
  assert.equal(normalizeIsbn('0-8044-2957-x'), '080442957X');
  assert.equal(normalizeIsbn('abc-123'), '');
});

test('normalizeGoogleBooksVolume extracts ISBNs, HTTPS cover, stripped description and mapped category', () => {
  const item = normalizeGoogleBooksVolume({
    id: 'gb-123',
    volumeInfo: {
      title: 'Clean Code',
      subtitle: 'A Handbook of Agile Software Craftsmanship',
      authors: ['Robert C. Martin'],
      publisher: 'Prentice Hall',
      publishedDate: '2008-08-01',
      description: '<p>Even bad code can function.<br/>Learn clean <b>software</b> patterns.</p>',
      industryIdentifiers: [
        { type: 'ISBN_10', identifier: '0132350882' },
        { type: 'ISBN_13', identifier: '9780132350884' },
      ],
      pageCount: 464,
      categories: ['Computers / Programming'],
      averageRating: 4.5,
      ratingsCount: 120,
      language: 'en',
      imageLinks: {
        thumbnail: 'http://books.google.com/books/content?id=gb-123&printsec=frontcover&img=1&zoom=1&edge=curl',
      },
      previewLink: 'http://books.google.com/books?id=gb-123',
      infoLink: 'http://books.google.com/books?id=gb-123&hl=en',
    },
  });

  assert.ok(item);
  assert.equal(item.isbn13, '9780132350884');
  assert.equal(item.isbn10, '0132350882');
  assert.equal(item.publishYear, 2008);
  assert.equal(item.mappedCategory, 'Công nghệ & Tin học');
  assert.equal(item.coverUrl.startsWith('https://'), true);
  assert.equal(item.coverUrl.includes('&edge=curl'), false);
  assert.equal(item.description.includes('<p>'), false);
  assert.equal(item.pageCount, 464);
});

test('normalizeOpenLibraryDoc and normalizeOpenLibraryBookData build Open Library covers and metadata', () => {
  const doc = normalizeOpenLibraryDoc({
    key: '/works/OL45804W',
    title: 'A Brief History of Time',
    author_name: ['Stephen Hawking'],
    first_publish_year: 1988,
    publisher: ['Bantam Books'],
    isbn: ['9780553380163', '0553380168'],
    cover_i: 240727,
    subject: ['Cosmology', 'Physics', 'Astronomy'],
    number_of_pages_median: 256,
    language: ['eng'],
    edition_count: 42,
    ratings_average: 4.4,
    ratings_count: 850,
  });

  assert.ok(doc);
  assert.equal(doc.coverUrl, 'https://covers.openlibrary.org/b/id/240727-L.jpg');
  assert.equal(doc.mappedCategory, 'Khoa học tự nhiên');
  assert.equal(doc.language, 'en');
  assert.equal(doc.infoLink, 'https://openlibrary.org/works/OL45804W');

  const bookData = normalizeOpenLibraryBookData(
    '9780553380163',
    {
      key: '/books/OL7353617M',
      url: 'https://openlibrary.org/books/OL7353617M',
      title: 'A Brief History of Time',
      authors: [{ name: 'Stephen Hawking' }],
      publishers: [{ name: 'Bantam' }],
      publish_date: 'September 1, 1998',
      number_of_pages: 212,
      subjects: [{ name: 'Physics' }],
      cover: { large: 'https://covers.openlibrary.org/b/id/240727-L.jpg' },
    },
    'Landmark book about space, black holes, and the universe.'
  );

  assert.ok(bookData);
  assert.equal(bookData.publishYear, 1998);
  assert.equal(bookData.description, 'Landmark book about space, black holes, and the universe.');
});

test('mergeExternalBookResults deduplicates across Google Books and Open Library by ISBN and title+author', () => {
  const gb = normalizeGoogleBooksVolume({
    id: 'gb-1',
    volumeInfo: {
      title: 'The Great Gatsby',
      authors: ['F. Scott Fitzgerald'],
      publishedDate: '2004',
      description: 'Classic Jazz Age novel about Jay Gatsby and Daisy Buchanan in Long Island.',
      industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780743273565' }],
      categories: ['Fiction / Classics'],
      imageLinks: { thumbnail: 'https://books.google.com/gatsby.jpg' },
    },
  })!;

  const ol = normalizeOpenLibraryDoc({
    key: '/works/OL468431W',
    title: 'The Great Gatsby',
    author_name: ['F. Scott Fitzgerald'],
    first_publish_year: 1925,
    isbn: ['9780743273565'],
    cover_i: 123456,
    number_of_pages_median: 180,
    ratings_average: 4.1,
    ratings_count: 500,
    subject: ['American literature', 'Fiction'],
  })!;

  const merged = mergeExternalBookResults([gb], [ol]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].sources, ['google_books', 'open_library']);
  assert.equal(merged[0].googleBooksId, 'gb-1');
  assert.equal(merged[0].openLibraryKey, '/works/OL468431W');
  assert.equal(merged[0].pageCount, 180);
  assert.equal(merged[0].ratingsAverage, 4.1);
  assert.equal(merged[0].mappedCategory, 'Văn học & Ngữ văn');
});

test('mapSubjectsToBookCategory classifies diverse subjects into valid library categories', () => {
  assert.equal(mapSubjectsToBookCategory(['Vietnamese History', 'World War II']), 'Lịch sử & Xã hội');
  assert.equal(
    mapSubjectsToBookCategory(
      ['World history', 'Civilization', 'Human evolution', 'Technology and civilization'],
      'Sapiens: A Brief History of Humankind'
    ),
    'Lịch sử & Xã hội'
  );
  assert.equal(mapSubjectsToBookCategory(['IELTS Academic Writing', 'English Grammar']), 'Ngoại ngữ');
  assert.equal(mapSubjectsToBookCategory(['Productivity', 'Habits', 'Self-help']), 'Kỹ năng sống');
});

test('buildBookFromExternalResult, findCatalogDuplicateBook, and mergeBookEnrichment work cleanly', () => {
  const external = normalizeGoogleBooksVolume({
    id: 'gb-cosmos',
    volumeInfo: {
      title: 'Cosmos',
      authors: ['Carl Sagan'],
      publisher: 'Random House',
      publishedDate: '1980',
      description: 'An exploration of 15 billion years of cosmic evolution and science.',
      industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780345539434' }],
      pageCount: 384,
      categories: ['Science / Astronomy'],
      language: 'en',
      imageLinks: { thumbnail: 'http://books.google.com/cosmos.jpg' },
      previewLink: 'http://books.google.com/books?id=gb-cosmos',
    },
  })!;

  const createdBook = buildBookFromExternalResult(external, {
    id: 'BOK-TEST-1',
    totalCopies: 3,
    shelfLocation: 'Kệ B2',
  });
  assert.equal(createdBook.id, 'BOK-TEST-1');
  assert.equal(createdBook.totalCopies, 3);
  assert.equal(createdBook.availableCopies, 3);
  assert.equal(createdBook.shelfLocation, 'Kệ B2');
  assert.equal(createdBook.category, 'Khoa học tự nhiên');
  assert.equal(createdBook.externalSource, 'google_books');

  const duplicate = findCatalogDuplicateBook([createdBook], external);
  assert.equal(duplicate?.id, 'BOK-TEST-1');

  const sparseBook: Book = {
    id: 'BOK-SPARSE',
    isbn: '978-0-345-53943-4',
    title: 'Cosmos',
    author: 'Carl Sagan',
    category: 'Khoa học tự nhiên',
    publisher: 'NXB Giáo Dục',
    publishYear: 1980,
    totalCopies: 2,
    availableCopies: 2,
    shelfLocation: 'Kệ A1',
    coverUrl: '',
    description: '',
  };

  const enriched = mergeBookEnrichment(sparseBook, external);
  assert.equal(enriched.coverUrl, 'https://books.google.com/cosmos.jpg');
  assert.equal(enriched.publisher, 'Random House');
  assert.equal(enriched.pageCount, 384);
  assert.equal(enriched.googleBooksId, 'gb-cosmos');
  assert.equal(enriched.totalCopies, 2);
});

test('searchExternalBooks, lookupExternalBookByIsbn, and enrichBookFromExternalApis handle parallel APIs and caching', async () => {
  let calls = 0;
  const mockFetch = (async (input: RequestInfo | URL) => {
    calls++;
    const url = String(input);
    if (url.includes('googleapis.com/books/v1/volumes')) {
      return new Response(
        JSON.stringify({
          items: [
            {
              id: 'gb-py',
              volumeInfo: {
                title: 'Fluent Python',
                authors: ['Luciano Ramalho'],
                publishedDate: '2022',
                description: 'Clear, Concise, and Effective Programming.',
                industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781492056355' }],
                categories: ['Computers'],
                imageLinks: { thumbnail: 'http://books.google.com/py.jpg' },
              },
            },
          ],
        }),
        { status: 200 }
      );
    }
    if (url.includes('openlibrary.org/search.json')) {
      return new Response(
        JSON.stringify({
          docs: [
            {
              key: '/works/OL20001W',
              title: 'Fluent Python',
              author_name: ['Luciano Ramalho'],
              first_publish_year: 2015,
              isbn: ['9781492056355'],
              cover_i: 998877,
              number_of_pages_median: 1012,
              subject: ['Python (Computer program language)'],
            },
          ],
        }),
        { status: 200 }
      );
    }
    if (url.includes('openlibrary.org/api/books')) {
      return new Response(
        JSON.stringify({
          'ISBN:9781492056355': {
            key: '/books/OL321M',
            url: 'https://openlibrary.org/books/OL321M',
            title: 'Fluent Python',
            authors: [{ name: 'Luciano Ramalho' }],
            publishers: [{ name: "O'Reilly Media" }],
            publish_date: '2022',
            number_of_pages: 1012,
            cover: { large: 'https://covers.openlibrary.org/b/id/998877-L.jpg' },
          },
        }),
        { status: 200 }
      );
    }
    if (url.includes('openlibrary.org/isbn/9781492056355.json')) {
      return new Response(
        JSON.stringify({ works: [{ key: '/works/OL20001W' }] }),
        { status: 200 }
      );
    }
    if (url.includes('openlibrary.org/works/OL20001W.json')) {
      return new Response(
        JSON.stringify({ description: { value: 'Deep guide to Python data model and concurrency.' } }),
        { status: 200 }
      );
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  const cache = createExternalBookCache<Awaited<ReturnType<typeof searchExternalBooks>>>();
  const res1 = await searchExternalBooks({ q: 'Fluent Python', source: 'all' }, { fetchImpl: mockFetch, cache });
  assert.equal(res1.totalMerged, 1);
  assert.deepEqual(res1.results[0].sources, ['google_books', 'open_library']);
  assert.equal(res1.results[0].pageCount, 1012);
  const callsAfterFirst = calls;

  const res2 = await searchExternalBooks({ q: 'fluent python', source: 'all' }, { fetchImpl: mockFetch, cache });
  assert.equal(res2.totalMerged, 1);
  assert.equal(calls, callsAfterFirst, 'Cache should avoid redundant network calls');

  const isbnLookup = await lookupExternalBookByIsbn('978-1-492-05635-5', { fetchImpl: mockFetch });
  assert.equal(isbnLookup.found, true);
  assert.deepEqual(isbnLookup.sources, ['google_books', 'open_library']);

  const enriched = await enrichBookFromExternalApis(
    { title: 'Fluent Python', author: 'Luciano Ramalho' },
    { fetchImpl: mockFetch }
  );
  assert.equal(enriched.found, true);
  assert.ok(enriched.match?.coverUrl.startsWith('https://'));

  assert.equal(buildGoogleBooksQuery('9780134685991', 'isbn'), 'isbn:9780134685991');
  const olParams = buildOpenLibrarySearchParams('Dế Mèn', 'title', 'vi', 10);
  assert.equal(olParams.get('title'), 'Dế Mèn');
  assert.equal(olParams.get('language'), 'vie');
});
