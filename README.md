![Logo](admin/lg-thinq.png)

# ioBroker.lg-thinq

[![NPM version](https://img.shields.io/npm/v/iobroker.lg-thinq.svg)](https://www.npmjs.com/package/iobroker.lg-thinq)
[![Downloads](https://img.shields.io/npm/dm/iobroker.lg-thinq.svg)](https://www.npmjs.com/package/iobroker.lg-thinq)
![Number of Installations (latest)](https://iobroker.live/badges/lg-thinq-installed.svg)
![Number of Installations (stable)](https://iobroker.live/badges/lg-thinq-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.lg-thinq.png?downloads=true)](https://nodei.co/npm/iobroker.lg-thinq/)

**Tests:** ![Test and Release](https://github.com/TA2k/ioBroker.lg-thinq/workflows/Test%20and%20Release/badge.svg)

## lg-thinq adapter for ioBroker

Adapter for LG ThinQ

## Requirement

* Node >= 18
* JS-Controller >= 5.0.19
* Admin >= 6.13.16

## Supported devices

**DEVICE**: lg-thinq.0.xxx.deviceType -> e. g. 101</br>
**PLATFORM**: lg-thinq.0.xxx.platformType -> e. g. thinq2

* Device -> 101 Refrigerator -> thinq2 + thinq1
* Device -> 201 Washer + signature -> thinq2 + thinq1
* Device -> 202 Dryer -> thinq2 + thinq1
* Device -> 401 AC -> thinq2 + thinq1
* Device -> 406 Heatpump -> thinq2

## Description

🇬🇧 [Description](/docs/en/README.md)</br>
🇩🇪 [Beschreibung](/docs/de/README.md)

## Questions

🇩🇪 [Fragen](https://forum.iobroker.net/topic/46498/test-adapter-lg-thinq-v0-0-1)

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

## Changelog
### 1.0.0 (2024-05-20)

-   (Lucky-ESA) Changed airState.quality.odor max value
-   (Lucky-ESA) Fixed sentry messages
-   (Lucky-ESA) Added jet & airclean for device 401
-   (Lucky-ESA) Added Mqtt wakeup for device 406
-   (Lucky-ESA) Node 18 required
-   (Lucky-ESA) JS-Controller >= 5.0.19 required
-   (Lucky-ESA) Admin >=6.13.16 required

### 0.3.3 (2024-01-14)

-   (Lucky-ESA) Fixed thinq1 crash
-   (Lucky-ESA) Fixed crash when internet fails (refreshToken)
-   (Lucky-ESA) Added weather request
-   (Lucky-ESA) Bugfixe

### 0.3.2 (2024-01-08)

-   (Lucky-ESA) Added data point interval.status_devices
-   (Lucky-ESA) Fixed missing value for fridge
-   (Lucky-ESA) Fixed thinq1 crash
-   (Lucky-ESA) Added save modelJSON local
-   (mcm1957) Node 16 checked

### 0.3.1 (2023-12-20)

-   (Lucky-ESA) Fixed crash thinq1 interval

### 0.3.0 (2023-12-15)

-   (Lucky-ESA) Added device 406 (heat pump)
-   (Lucky-ESA) Added description
-   (Lucky-ESA) Added new thinq1 interval
-   (Lucky-ESA) Added statistic for thinq1 device 401
-   (Lucky-ESA) Bugfixe

### 0.2.0

-   (Lucky-ESA) Added automatic terms acceptance
-   (Lucky-ESA) Added 401 Thinq1 device
-   (Lucky-ESA) Added 101 Thinq1 device
-   (TA2k) Bugfix

### 0.1.4

-   (TA2k) Added warning for not supported devices

### 0.1.1

-   (TA2k) Added AC Device 401 thinq2
-   (TA2k) Bugfix

### 0.1.0

-   (TA2k) Added MQTT connection for live status updates

### 0.0.3

-   (TA2k) initial release

## License

MIT License

Copyright (c) 2021-2024 TA2k <tombox2020@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
