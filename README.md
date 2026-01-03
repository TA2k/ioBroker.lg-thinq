![Logo](admin/lg-thinq.png)

# ioBroker.lg-thinq

[![NPM version](https://img.shields.io/npm/v/iobroker.lg-thinq.svg)](https://www.npmjs.com/package/iobroker.lg-thinq)
[![Downloads](https://img.shields.io/npm/dm/iobroker.lg-thinq.svg)](https://www.npmjs.com/package/iobroker.lg-thinq)
![Number of Installations (latest)](https://iobroker.live/badges/lg-thinq-installed.svg)
![Number of Installations (stable)](https://iobroker.live/badges/lg-thinq-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.lg-thinq.svg)](https://nodei.co/npm/iobroker.lg-thinq/)

**Tests:** ![Test and Release](https://github.com/TA2k/ioBroker.lg-thinq/workflows/Test%20and%20Release/badge.svg)

## lg-thinq adapter for ioBroker

Adapter for LG ThinQ

## Requirement

- Node >= 20, 22 or 24
- JS-Controller >= 6.0.11
- Admin >= 7.6.17

## Supported devices

**DEVICE**: lg-thinq.0.xxx.deviceType -> e. g. 101</br>
**PLATFORM**: lg-thinq.0.xxx.platformType -> e. g. thinq2

- Device -> 101 Refrigerator -> thinq2 + thinq1
- Device -> 201 Washer + signature -> thinq2 + thinq1
- Device -> 202 Dryer -> thinq2 + thinq1
- Device -> 401 AC -> thinq2 + thinq1
- Device -> 406 Heatpump -> thinq2

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
### 1.1.6 (2025-12-17)

- (Lucky-ESA) Fixed: Address Root-CA certificate has changed

### 1.1.5 (2025-12-15)

- (Lucky-ESA) Fixed adapter crash (thinq1 only)
- (Lucky-ESA) Fixed: Address Root-CA certificate has changed

### 1.1.4 (2025-12-14)

- (Lucky-ESA) Attribute max of object limitMax and limitMin changed (device 401)
- (Lucky-ESA) Fixed deviceType error
- (Lucky-ESA) JSONbig loglevel changed

### 1.1.3 (2025-10-03)

- (Lucky-ESA) Added translate for device 201
- (Lucky-ESA) Delete APP-Login (removed by LG)
- (Lucky-ESA) Added online icon
- (Lucky-ESA) Microwave 302 disabled (thinq1)

### 1.1.2 (2025-08-18)

- (Lucky-ESA) Delete expires check

## License

MIT License

Copyright (c) 2021-2026 TA2k <tombox2020@gmail.com>

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
