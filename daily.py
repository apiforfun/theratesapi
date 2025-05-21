from sys import displayhook
import xml.etree.ElementTree as ET
import urllib.request
import xmltodict
import json

import requests
from bs4 import BeautifulSoup
from pymongo import MongoClient
client = MongoClient('mongodb://localhost:27017/')
db = client['theratesapi']
collection = db['currency']

currencies = ['USD', 'JPY', 'BGN', 'CYP', 'CZK', 'DKK', 'EEK', 'GBP', 'HUF', 'LTL', 'LVL', 'MTL', 'PLN', 'ROL', 'RON', 'SEK', 'SIT', 'SKK', 'CHF', 'ISK', 'NOK', 'HRK', 'RUB', 'TRL', 'TRY', 'AUD', 'BRL', 'CAD', 'CNY', 'HKD', 'IDR', 'ILS', 'INR', 'KRW', 'MXN', 'MYR', 'NZD', 'PHP', 'SGD', 'THB', 'ZAR']

url = 'https://www.ecb.europa.eu/home/html/rss.en.html'
reqs = requests.get(url)
soup = BeautifulSoup(reqs.text, 'html.parser')
 
urls = []
for link in soup.find_all('a'):
    if link.get('href',None) :
        if '/rss/fxref' in link.get('href') and 'eek' not in link.get('href'):
            urls.append('https://www.ecb.europa.eu'+link.get('href'))

record_data = {}
for url in urls:
    response = urllib.request.urlopen(url).read()
    data = xmltodict.parse(response)
    data = dict(data)
    
    for item in data['rdf:RDF']['item'] :
        item = dict(item)
        statstics = dict(item['cb:statistics'])
        exchangeRate= dict(statstics['cb:exchangeRate'])
        cbValue = dict(exchangeRate['cb:value'])
        date = item['dc:date'].split("T")[0]
        cbBase = dict(exchangeRate['cb:baseCurrency'])
        if record_data.get(date,None) is None:
            record_data[date] = {
                'date': date,
                'base': cbBase['#text'],
                'rates': {}
            }
        record_data[date]['rates'][exchangeRate['cb:targetCurrency']] = float(cbValue['#text'])


def calculate_new_base(new_base, new_row):
    new_curr = {
        'date': new_row['date'],
        'base': new_base,
    }
    new_curr['rates']={}
    new_curr['rates']['EUR']=1/float(new_row['rates'][new_base])
    for x in currencies:
        if x in new_row['rates'].keys() and x != new_base:
            new_curr['rates'][x] = float(new_row['rates'][x])/float(new_row['rates'][new_base])
    
    collection.insert_one(new_curr)
    print(new_curr)
    print('baaaaaaaaaaaaaaaaaaaaaaaaaaaaaase', new_base)



for record in record_data.values():
    # if record with the date and base is not found in db: insert that record and all the corresponding base values for the record.
    if not collection.find_one({'date': record['date'], 'base': record['base']}):
        print('not found')
        collection.insert_one(record)
        for k in currencies:
            if k not in ('EUR',) and k in record['rates'].keys():
                calculate_new_base(k, record)
    else:
        print('found')
    print(record)
    print(record['date'], record['base'])