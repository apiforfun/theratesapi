# the foreign exchange rates by The Rates API

theratesapi is a free API for present and historical foreign exchange rates. We developed this service by reading public data from [European Central Bank](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html).

**Note**: The reference rates are usually updated around 16:00 CET on every working day.

## Usage

* Latest Rates based on EUR
```
URL: https://theratesapi.com/api/latest

{"date":"2021-06-02","base":"EUR","rates":{"USD":"1.2186","JPY":"133.72","BGN":"1.9558","CZK":"25.465","DKK":"7.4365","GBP":"0.86125","HUF":"346.06","PLN":"4.4653","RON":"4.9208","SEK":"10.0898","CHF":"1.0982","ISK":"146.10","NOK":"10.1393","HRK":"7.5043","RUB":"89.5138","TRY":"10.4641","AUD":"1.5756","BRL":"6.2891","CAD":"1.4705","CNY":"7.7812","HKD":"9.4555","IDR":"17391.63","INR":"89.0830","KRW":"1356.11","MXN":"24.3207","MYR":"5.0267","NZD":"1.6843","PHP":"58.312","SGD":"1.6129","THB":"37.959","ZAR":"16.7269"}}
%                       
```

* Latest Rates based on USD
```
URL: https://theratesapi.com/api/latest?base=USD

{"date":"2021-06-02","base":"USD","rates":{"EUR":0.8206138191367143,"JPY":109.73247989496144,"BGN":1.6049565074675858,"CZK":20.89693090431643,"DKK":6.102494666010176,"GBP":0.7067536517314952,"HUF":283.98161825045133,"PLN":3.6642868865911704,"RON":4.038076481207944,"SEK":8.27982931232562,"CHF":0.9011980961759397,"ISK":119.89167897587396,"NOK":8.320449696372888,"HRK":6.158132282947645,"RUB":73.45626128344003,"TRY":8.586985064828493,"AUD":1.292959133431807,"BRL":5.1609223699327105,"CAD":1.2067126210405383,"CNY":6.3853602494666015,"HKD":7.759313966847203,"IDR":14271.811915312655,"INR":73.10274085015593,"KRW":1112.8426062694896,"MXN":19.957902511078288,"MYR":4.124979484654522,"NZD":1.3821598555719679,"PHP":47.851633021500085,"SGD":1.3235680288856064,"THB":31.14967996061054,"ZAR":13.726325291317908}}
```

* Get Rates based on Date
```
URL https://theratesapi.com/api/2008-12-10

{"rates":{"USD":"1.2925","JPY":"119.77","BGN":"1.9558","CZK":"25.9","DKK":"7.4499","EEK":"15.6466","GBP":"0.87325","HUF":"263.75","LTL":"3.4528","LVL":"0.7092","PLN":"3.9566","RON":"3.878","SEK":"10.567","SKK":"30.189","CHF":"1.5587","NOK":"9.1285","HRK":"7.1923","RUB":"36.0941","TRY":"2.028","AUD":"1.9665","BRL":"3.2406","CAD":"1.6295","CNY":"8.8708","HKD":"10.0171","IDR":"14185.19","KRW":"1790.76","MXN":"17.4681","MYR":"4.6724","NZD":"2.3696","PHP":"62.47","SGD":"1.9393","THB":"45.748","ZAR":"13.1916"},"date":"2008-12-10","base":"EUR"}
```

* Get Rates using base and symbol

```
https://theratesapi.com/api/latest?base=USD&symbols=GBP

{"date":"2021-06-02","base":"USD","rates":{"GBP":0.7067536517314952}}
```

# Support and feature requests:

We welcome your feedback and support, raise [github ticket](https://github.com/apiforfun/theratesapi/issues) if you want to report a bug. Need new features? Contact me at apiforfun2@gmail.com
