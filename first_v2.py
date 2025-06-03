import csv
import os
from pymongo import MongoClient
from decimal import Decimal, ROUND_HALF_UP, getcontext
from bson.decimal128 import Decimal128
from datetime import datetime

# Setup
client = MongoClient('mongodb://localhost:27017/')
db = client['theratesapi']
collection = db['currency']
collection.drop()

getcontext().prec = 28
DECIMAL_PLACES = Decimal('0.000001')

def parse_date(date_str):
    """Simple date parser"""
    try:
        return datetime.strptime(date_str.strip(), '%Y-%m-%d').strftime('%Y-%m-%d')
    except ValueError:
        return None

def clean_rates(row):
    """Extract valid currency rates from CSV row"""
    rates = {}
    for key, value in row.items():
        if key == 'Date' or not value or value == 'N/A':
            continue
        try:
            rate = Decimal(value.strip())
            if rate > 0:
                rates[key] = rate
        except:
            continue
    return rates

def to_decimal128(value):
    """Convert to MongoDB Decimal128"""
    return Decimal128(Decimal(str(value)).quantize(DECIMAL_PLACES, rounding=ROUND_HALF_UP))

def create_base_rates(date, base_currency, rates):
    """Create rates document for given base currency"""
    if base_currency not in rates:
        return None
    
    base_rate = rates[base_currency]
    new_rates = {}
    
    # Add EUR rate (only if base is not EUR)
    if base_currency != 'EUR':
        new_rates['EUR'] = to_decimal128(Decimal('1') / base_rate)
    
    # Add other currency rates
    for currency, rate in rates.items():
        if currency != base_currency:
            new_rates[currency] = to_decimal128(rate / base_rate)
    
    # Fix: Don't return empty rates document
    if not new_rates:
        return None
    
    return {
        'date': date,
        'base': base_currency,
        'rates': new_rates
    }

# Main processing
csv_path = '../eurofxref-hist.csv' if os.path.exists('../eurofxref-hist.csv') else './eurofxref-hist.csv'

try:
    # Create unique index to prevent duplicates
    collection.create_index([("date", 1), ("base", 1)], unique=True)
    
    with open(csv_path, 'r') as file:
        reader = csv.DictReader(file)
        batch = []
        processed = 0
        
        for row in reader:
            # Parse date
            date = parse_date(row.get('Date', ''))
            if not date:
                continue
            
            # Clean rates
            rates = clean_rates(row)
            if not rates:
                continue
            
            # Create EUR base document
            eur_doc = {
                'date': date,
                'base': 'EUR',
                'rates': {k: to_decimal128(v) for k, v in rates.items()}
            }
            batch.append(eur_doc)
            
            # Create documents for other base currencies
            for currency in rates:
                doc = create_base_rates(date, currency, rates)
                if doc:
                    batch.append(doc)
            
            # Insert in batches with duplicate handling
            if len(batch) >= 1000:
                try:
                    collection.insert_many(batch, ordered=False)
                    print(f"Inserted batch of {len(batch)} documents")
                except Exception as e:
                    print(f"Batch insert warning (likely duplicates): {e}")
                batch = []
            
            processed += 1
            if processed % 50 == 0:
                print(f"Processed {processed} dates...")
        
        # Insert remaining documents
        if batch:
            try:
                collection.insert_many(batch, ordered=False)
                print(f"Inserted final batch of {len(batch)} documents")
            except Exception as e:
                print(f"Final batch insert warning: {e}")
        
        print(f"Complete! Processed {processed} dates")

except Exception as e:
    print(f"Error: {e}")
finally:
    client.close()

