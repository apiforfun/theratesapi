# the foreign exchange rates by The Rates API

theratesapi is a free API for present and historical foreign exchange rates. We developed this service by reading public data from [European Central Bank](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html).

**Note**: The reference rates are usually updated around 16:00 CET on every working day.

## Usage

* Latest Rates based on EUR
```
URL: https://theratesapi.com/api/latest

{"date":"2025-06-02","base":"EUR","rates":{"USD":1.1419,"JPY":162.98,"BGN":1.9558,"CZK":24.899,"DKK":7.4606,"GBP":0.8434,"HUF":402.83,"PLN":4.2578,"RON":5.0547,"SEK":10.8535,"CHF":0.9336,"ISK":144.4,"NOK":11.51,"TRY":44.7505,"AUD":1.7606,"BRL":6.5015,"CAD":1.5643,"CNY":8.2214,"HKD":8.9576,"IDR":18584.37,"ILS":4.0134,"INR":97.4995,"KRW":1572.2,"MXN":22.0066,"MYR":4.8605,"NZD":1.8972,"PHP":63.553,"SGD":1.4686,"THB":37.163,"ZAR":20.4734}}
%                       
```

* Latest Rates based on USD
```
URL: https://theratesapi.com/api/latest?base=USD

{"date":"2025-06-02","base":"USD","rates":{"EUR":0.875733,"JPY":142.727034,"BGN":1.712759,"CZK":21.804887,"DKK":6.533497,"GBP":0.738594,"HUF":352.771696,"PLN":3.728698,"RON":4.42657,"SEK":9.504773,"CHF":0.817585,"ISK":126.455907,"NOK":10.079692,"TRY":39.189509,"AUD":1.541816,"BRL":5.693581,"CAD":1.36991,"CNY":7.199755,"HKD":7.84447,"IDR":16274.954024,"ILS":3.514669,"INR":85.383571,"KRW":1376.828094,"MXN":19.271915,"MYR":4.256502,"NZD":1.661441,"PHP":55.655486,"SGD":1.286102,"THB":32.544881,"ZAR":17.929241}}
```

* Get Rates based on Date
```
URL https://theratesapi.com/api/2025-06-02

{"date":"2025-06-02","base":"EUR","rates":{"USD":1.1419,"JPY":162.98,"BGN":1.9558,"CZK":24.899,"DKK":7.4606,"GBP":0.8434,"HUF":402.83,"PLN":4.2578,"RON":5.0547,"SEK":10.8535,"CHF":0.9336,"ISK":144.4,"NOK":11.51,"TRY":44.7505,"AUD":1.7606,"BRL":6.5015,"CAD":1.5643,"CNY":8.2214,"HKD":8.9576,"IDR":18584.37,"ILS":4.0134,"INR":97.4995,"KRW":1572.2,"MXN":22.0066,"MYR":4.8605,"NZD":1.8972,"PHP":63.553,"SGD":1.4686,"THB":37.163,"ZAR":20.4734}}
```

* Get Rates using base and symbol

```
https://theratesapi.com/api/latest?base=USD&symbols=GBP

{"date":"2025-06-02","base":"USD","rates":{"GBP":0.738594}}
```

# Support and feature requests:

We welcome your feedback and support, raise [github ticket](https://github.com/apiforfun/theratesapi/issues) if you want to report a bug. Need new features? Contact me at apiforfun2@gmail.com
