const { SITE } = require('../config/site')

// schema.org data as one JSON-LD document; '<' is escaped so the JSON can't close its script tag.
function jsonLd (...items) {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': items }).replace(/</g, '\\u003c')
}

// items: [{ question, answer }] in plain text, the same text the page shows.
function faqPage (items) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map(function (item) {
      return { '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } }
    })
  }
}

// trail: [[name, path], ...] from the home page down to this one.
function breadcrumbs (trail) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(function ([name, path], i) {
      return { '@type': 'ListItem', position: i + 1, name, item: SITE + path }
    })
  }
}

const ORGANIZATION_ID = SITE + '/#organization'

// On every page: who runs the site.
const SITE_DATA = jsonLd(
  {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'The Rates API',
    url: SITE + '/',
    logo: SITE + '/apple-touch-icon.png',
    email: 'apiforfun2@gmail.com',
    sameAs: ['https://github.com/apiforfun/theratesapi']
  },
  { '@type': 'WebSite', '@id': SITE + '/#website', name: 'The Rates API', url: SITE + '/', publisher: { '@id': ORGANIZATION_ID } }
)

// On the home page: the rates themselves, which Google Dataset Search lists.
const DATASET = {
  '@type': 'Dataset',
  name: 'Euro foreign exchange reference rates since 1999',
  description: 'Daily reference rates for about 150 currencies against the euro, as published by the European Central Bank and Banca d\'Italia on every working day since 4 January 1999, with cross-rates for any base currency. Free JSON API, no key needed.',
  url: SITE + '/',
  keywords: ['exchange rates', 'foreign exchange', 'currency', 'euro reference rates', 'European Central Bank', 'Banca d\'Italia'],
  variableMeasured: 'Exchange rate against the euro',
  temporalCoverage: '1999-01-04/..',
  isAccessibleForFree: true,
  creator: [
    { '@type': 'Organization', name: 'European Central Bank', url: 'https://www.ecb.europa.eu/' },
    { '@type': 'Organization', name: 'Banca d\'Italia', url: 'https://www.bancaditalia.it/' }
  ],
  provider: { '@id': ORGANIZATION_ID },
  distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: SITE + '/api/latest' }]
}

// On the docs: the API.
const WEB_API = {
  '@type': 'WebAPI',
  name: 'The Rates API',
  description: 'Free JSON API for daily foreign exchange reference rates of about 150 currencies, with history since 1999. No API key.',
  url: SITE + '/api/latest',
  documentation: SITE + '/documentation/',
  termsOfService: SITE + '/terms-and-conditions/',
  provider: { '@id': ORGANIZATION_ID }
}

module.exports = { jsonLd, faqPage, breadcrumbs, SITE_DATA, DATASET, WEB_API }
