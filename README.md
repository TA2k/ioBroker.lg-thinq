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

-   Node >= 18
-   JS-Controller >= 5.0.19
-   Admin >= 6.13.16

## Supported devices

**DEVICE**: lg-thinq.0.xxx.deviceType -> e. g. 101</br>
**PLATFORM**: lg-thinq.0.xxx.platformType -> e. g. thinq2

-   Device -> 101 Refrigerator -> thinq2 + thinq1
-   Device -> 201 Washer + signature -> thinq2 + thinq1
-   Device -> 202 Dryer -> thinq2 + thinq1
-   Device -> 401 AC -> thinq2 + thinq1
-   Device -> 406 Heatpump -> thinq2

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
### 1.0.7 (2024-12-08)

-   (Lucky-ESA) Fixed: Connection status does not turn green
-   (Lucky-ESA) Changed: Checkbox to dropdown for login procedure

### 1.0.6 (2024-12-07)

-   (Lucky-ESA) Save session data (prevents the login email)
-   (Lucky-ESA) Fixed invalid jsonConfig
-   (Lucky-ESA) Added choice between old and new login
-   (Lucky-ESA) Bugfixe

### 1.0.5 (2024-12-02)

-   (Lucky-ESA) Migration to ESLint9
-   (Lucky-ESA) Bugfixe

### 1.0.4 (2024-12-01)

-   (TA2k) Login fixed
-   (Lucky-ESA) Added hotwater for device 406 & 401
-   (Lucky-ESA) Dependencies updated

### 1.0.2 (2024-09-10)

-   (Lucky-ESA) Dependencies updated
-   (Lucky-ESA) Changed autoDryRemainTime max value
-   (Lucky-ESA) Added own request for 401 thinq1

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
