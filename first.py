import csv
from pymongo import MongoClient
client = MongoClient('mongodb://localhost:27017/')
db = client['theratesapi']
collection = db['currency']

currencies = ['USD', 'JPY', 'BGN', 'CYP', 'CZK', 'DKK', 'EEK', 'GBP', 'HUF', 'LTL', 'LVL', 'MTL', 'PLN', 'ROL', 'RON', 'SEK', 'SIT', 'SKK', 'CHF', 'ISK', 'NOK', 'HRK', 'RUB', 'TRL', 'TRY', 'AUD', 'BRL', 'CAD', 'CNY', 'HKD', 'IDR', 'ILS', 'INR', 'KRW', 'MXN', 'MYR', 'NZD', 'PHP', 'SGD', 'THB', 'ZAR']

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


with open('../eurofxref-hist.csv', newline='') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        # print(row)
        # break
        orginal_row = row
        # print(orginal_row)
        orginal_row.pop("")
        # print(orginal_row)
        new_row = {}
        new_row['rates'] = {}

        for key in orginal_row.keys():
            if orginal_row[key] != 'N/A':
                if key == 'Date':
                    new_row['date'] = orginal_row[key]
                else:
                    new_row['rates'][key] = orginal_row[key]

        new_row['base'] = 'EUR'

        print(new_row)
        for k in new_row['rates'].keys():
            if k not in ('date', 'base'):
                calculate_new_base(k, new_row)
        
        collection.insert_one(new_row)

        print(new_row)

