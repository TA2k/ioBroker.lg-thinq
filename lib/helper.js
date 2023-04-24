const constants = require("./constants");
module.exports = {
    async setDryerBlindStates(path) {
        const dryerDP = ["washingIndex", "dnn_washingIndex", "dnn_temp", "dnn_precipitationProbability", "dnn_humidity"];
        for (const stateName of dryerDP) {
            const commons = {
                name: stateName,
                type: "number",
                role: "info",
                write: false,
                read: true,
                min: -5,
                max: 500,
                def: 0,
            };
            await this.createDataPoint(path + stateName, commons, "state");
        }
        const com = {
            name: "dnn_dust",
            type: "string",
            role: "info",
            write: false,
            read: true,
            def: "-",
        };
        await this.createDataPoint(path + "dnn_dust", com, "state");
    },
    async createFridge(device, deviceModel) {
        await this.setObjectNotExistsAsync(device.deviceId + ".remote.fridgeTemp", {
            type: "state",
            common: {
                name: "fridgeTemp_C",
                type: "number",
                write: true,
                read: true,
                role: "level",
                desc: "Nur Celsius",
                min: 1,
                max: 7,
                unit: "",
                def: 1,
                states: {
                    1: "7",
                    2: "6",
                    3: "5",
                    4: "4",
                    5: "3",
                    6: "2",
                    7: "1",
                },
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(device.deviceId + ".remote.freezerTemp", {
            type: "state",
            common: {
                name: "freezerTemp_C",
                type: "number",
                write: true,
                read: true,
                role: "level",
                desc: "Nur Celsius",
                min: -25,
                max: 11,
                unit: "",
                def: 1,
                states: {
                    1: "-14",
                    2: "-15",
                    3: "-16",
                    4: "-17",
                    5: "-18",
                    6: "-19",
                    7: "-20",
                    8: "-21",
                    9: "-22",
                    10: "-23",
                    11: "-24",
                },
            },
            native: {},
        });
        if (
            device.snapshot != null &&
            device.snapshot.refState != null &&
            device.snapshot.refState.expressMode != null
        ) {
            const commons = {
                name: "expressMode",
                type: "string",
                write: true,
                read: true,
                role: "value",
                desc: "Expressmode",
                def: "OFF",
                states: {
                    "OFF": "0",
                    "EXPRESS_ON": "1",
                    "RAPID_ON": "2",
                    "IGNORE": "255",
                },
            };
            await this.createDataPoint(device.deviceId + ".remote.expressMode", commons, "state");
        }
        if (
            device.snapshot != null &&
            device.snapshot.refState != null &&
            device.snapshot.refState.ecoFriendly != null
        ) {
            await this.setObjectNotExistsAsync(device.deviceId + ".remote.ecoFriendly", {
                type: "state",
                common: {
                    name: "ecoFriendly",
                    type: "string",
                    write: true,
                    read: true,
                    role: "state",
                    desc: "Umweltfreundlich. Nicht für alle verfügbar",
                    def: "OFF",
                    states: {
                        "OFF": 0,
                        "ON": 1,
                        "IGNORE": 255
                    },
                },
                native: {},
            });
        }
        if (
            deviceModel &&
            deviceModel.Value != null &&
            deviceModel.Value.IcePlus != null
        ) {
            const commons = {
                name: "expressMode",
                type: "number",
                write: true,
                read: true,
                role: "value",
                desc: "Expressmode",
                def: 1,
                states: {
                    "1": "OFF",
                    "2": "ON"
                },
            };
            await this.createDataPoint(device.deviceId + ".remote.expressMode", commons, "state");
        }
    },
    async createStatistic(device, model) {
        if (device.platformType === "thinq1") {
            return;
        }
        const devicedp = device.deviceId;
        try {
            await this.setObjectNotExists(devicedp + ".remote.Statistic", {
                type: "channel",
                common: {
                    name: constants[this.lang + "Translation"]["STATISTIC"],
                    role: "state",
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            this.setObjectNotExists(devicedp + ".remote.Statistic.jsonResult", {
                type: "state",
                common: {
                    name: constants[this.lang + "Translation"]["JSONRESULT"],
                    type: "string",
                    role: "value",
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            this.setObjectNotExists(devicedp + ".remote.Statistic.sendRequest", {
                type: "state",
                common: {
                    name: constants[this.lang + "Translation"]["SENDREQUEST"],
                    type: "boolean",
                    role: "button",
                    write: true,
                    read: true,
                    def: false,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            if (model === 101) {
                /*
                if (device.platformType === "thinq1") {
                    this.setObjectNotExists(devicedp + ".remote.Statistic.command", {
                        type: "state",
                        common: {
                            name: constants[this.lang + "Translation"]["NAMEFRIDGE"],
                            type: "number",
                            role: "value",
                            write: true,
                            read: true,
                            def: 0,
                            states: {
                                "0": constants[this.lang + "Translation"]["F_DOOR_MONTH"],
                                "1": constants[this.lang + "Translation"]["F_DOOR_DAY"],
                                "2": constants[this.lang + "Translation"]["F_ENERGY_MONTH"],
                                "3": constants[this.lang + "Translation"]["F_ENERGY_DAY"],
                                "4": constants[this.lang + "Translation"]["F_WATER"],
                                "5": constants[this.lang + "Translation"]["F_ACTIVE"],
                                "6": constants[this.lang + "Translation"]["F_SMARTACTIVE"],
                            },
                        },
                        native: {},
                    }).catch((error) => {
                        this.log.error(error);
                    });
                    return;
                }
                */
                this.setObjectNotExists(devicedp + ".remote.Statistic.command", {
                    type: "state",
                    common: {
                        name: constants[this.lang + "Translation"]["NAMEFRIDGE"],
                        type: "number",
                        role: "value",
                        write: true,
                        read: true,
                        def: 0,
                        states: {
                            "0": constants[this.lang + "Translation"]["F_DOOR"],
                            "1": constants[this.lang + "Translation"]["F_ENERGY"],
                            "2": constants[this.lang + "Translation"]["F_WATER"],
                            "3": constants[this.lang + "Translation"]["F_ACTIVE"],
                            "4": constants[this.lang + "Translation"]["F_FRIDGE"],
                            "5": constants[this.lang + "Translation"]["F_SELFCARE"],
                        },
                    },
                    native: {},
                }).catch((error) => {
                    this.log.error(error);
                });
            }

            if (model === 401) {
                this.setObjectNotExists(devicedp + ".remote.Statistic.command", {
                    type: "state",
                    common: {
                        name: constants[this.lang + "Translation"]["NAMEAIR"],
                        type: "number",
                        role: "value",
                        write: true,
                        read: true,
                        def: 0,
                        states: {
                            "0": constants[this.lang + "Translation"]["AIR_ENERGY"],
                            "1": constants[this.lang + "Translation"]["AIR_POLLUTION"],
                        },
                    },
                    native: {},
                }).catch((error) => {
                    this.log.error(error);
                });
            }

            const commons = {
                name: constants[this.lang + "Translation"]["PERIOD"],
                type: "number",
                role: "value",
                write: true,
                read: true,
                def: 0,
                states: {
                    "0": constants[this.lang + "Translation"]["HOURLY"],
                    "1": constants[this.lang + "Translation"]["DAILY"],
                    "2": constants[this.lang + "Translation"]["MONTHLY"],
                },
            };
            await this.createDataPoint(devicedp + ".remote.Statistic.period", commons, "state");

            this.setObjectNotExists(devicedp + ".remote.Statistic.startDate", {
                type: "state",
                common: {
                    name: constants[this.lang + "Translation"]["STARTDATE"],
                    type: "string",
                    role: "value",
                    write: true,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });

            this.setObjectNotExists(devicedp + ".remote.Statistic.endDate", {
                type: "state",
                common: {
                    name: constants[this.lang + "Translation"]["ENDDATE"],
                    type: "string",
                    role: "value",
                    write: true,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
        } catch (e) {
            this.log.error("Error in createStatistic: " + e);
        }
    },
    async createremote(devicedp, control, course) {
        try {
            let states = {};
            let dev    = "";
            this.courseJson[devicedp] = {};
            this.courseactual[devicedp] = {};
            await this.setObjectNotExistsAsync(devicedp + ".remote.sendJSON", {
                type: "state",
                common: {
                    name: "sendJSON",
                    type: "string",
                    write: true,
                    read: true,
                    role: "json",
                    desc: "sendJSON",
                    def: "",
                },
                native: {},
            });
            if (control === "WMDownload") {
                this.lastDeviceCourse(devicedp);
                let common = {};
                common = {
                    name: "WMDownload Select",
                    type: "string",
                    role: "value",
                    write: true,
                    read: true,
                };
                Object.keys(course["Course"]).forEach( async (value) => {
                    states[value] = (constants[this.lang + "Translation"][value] != null)
                        ? constants[this.lang + "Translation"][value] + " - STD"
                        : value + " - STD";
                });
                Object.keys(course["SmartCourse"]).forEach( async (value) => {
                    states[value] = (constants[this.lang + "Translation"][value] != null)
                        ? constants[this.lang + "Translation"][value] + " - DL"
                        : value + " - DL";
                });
                if (Object.keys(states).length > 0) common["states"] = states;
                common["states"]["NOT_SELECTED"] = "NOT_SELECTED";
                await this.createDataPoint(devicedp + ".remote.WMDownload_Select", common, "state");
                await this.setStateAsync(devicedp + ".remote.WMDownload_Select", {
                    val: "NOT_SELECTED",
                    ack: true
                });
                await this.setObjectNotExistsAsync(devicedp + ".remote.Course", {
                    type: "channel",
                    common: {
                        name: constants[this.lang + "Translation"]["SEL_PROGRAM"],
                        role: "state",
                    },
                    native: {},
                }).catch((error) => {
                    this.log.error(error);
                });

                this.createStatistic(devicedp);

                this.setObjectNotExists(devicedp + ".remote.Favorite", {
                    type: "state",
                    common: {
                        name: constants[this.lang + "Translation"]["FAVORITE"],
                        type: "boolean",
                        role: "button",
                        write: true,
                        read: true,
                        def: false
                    },
                    native: {},
                }).catch((error) => {
                    this.log.error(error);
                });

                dev = Object.keys(this.deviceControls[devicedp]["WMDownload"]["data"])[0];
                dev = this.deviceControls[devicedp]["WMDownload"]["data"][dev];
                this.coursedownload[devicedp] = false;
                Object.keys(dev).forEach( async (value) => {
                    try {
                        states = {};
                        common = {
                            name: "unbekannt",
                            type: "string",
                            role: "value",
                            write: true,
                            read: true,
                        };
                        states = {};
                        if (course["MonitoringValue"][value] != null) {
                            Object.keys(course["MonitoringValue"][value]["valueMapping"]).forEach((map) => {
                                try {
                                    if (map === "min") {
                                        common[map] = (
                                            course["MonitoringValue"][value]["valueMapping"][map] !== 3 &&
                                            course["MonitoringValue"][value]["valueMapping"][map] !== 30
                                        )
                                            ? course["MonitoringValue"][value]["valueMapping"][map]
                                            : 0;
                                        common["type"] = "number";
                                        common["def"] = 0;
                                    } else if (map === "max") {
                                        const valueDefault = course["MonitoringValue"][value]["default"]
                                            ? course["MonitoringValue"][value]["default"]
                                            : null;
                                        if (value === "moreLessTime") {
                                            common[map] = 200;
                                        } else if (value === "timeSetting") {
                                            common[map] = 360;
                                        } else if (this.modelInfos[devicedp]["signature"] &&
                                            (
                                                value === "reserveTimeMinute" ||
                                                value === "remainTimeMinute" ||
                                                value === "initialTimeMinute"
                                            )
                                        ) {
                                            common[map] = 1000;
                                        } else {
                                            if (
                                                valueDefault != null &&
                                                valueDefault > course["MonitoringValue"][value]["valueMapping"][map]
                                            ) {
                                                common[map] = valueDefault;
                                            } else {
                                                common[map] = (course["MonitoringValue"][value]["valueMapping"][map] != null)
                                                    ? course["MonitoringValue"][value]["valueMapping"][map]
                                                    : 0;
                                            }
                                        }
                                        common["type"] = "number";
                                        common["def"] = 0;
                                    } else {
                                        states[map] = (constants[this.lang + "Translation"][map] != null)
                                            ? constants[this.lang + "Translation"][map]
                                            : course["MonitoringValue"][value]["valueMapping"][map]["label"];
                                        if (constants[this.lang + "Translation"][map] == null) {
                                            this.log.warn("Please create an issue on https://github.com/TA2k/ioBroker.lg-thinq/issues with: missing " + map);
                                        }
                                    }

                                } catch (e) {
                                    this.log.error("Foreach valueMapping: " + e + " - " + value + " - " + devicedp);
                                }
                            });
                            common["name"] = (constants[this.lang + "Translation"][value] != null)
                                ? constants[this.lang + "Translation"][value]
                                : value;
                            if (Object.keys(states).length > 0) common["states"] = states;
                            this.courseJson[devicedp][value] = dev[value];
                            this.courseactual[devicedp][value] = dev[value];
                            await this.createDataPoint(devicedp + ".remote.Course." + value, common, "state");
                        } else {
                            this.log.debug("missing: " + dev[value] + " - " + value);
                            if (value === "course") {
                                this.coursedownload[devicedp] = true;
                            }
                            if (value === "rinseSpin") {
                                common = {
                                    name: value,
                                    type: "string",
                                    role: "value",
                                    write: true,
                                    read: true,
                                    states: {
                                        RINSE_SPIN_OFF: constants[this.lang + "Translation"]["RINSE_SPIN_OFF"],
                                        RINSE_SPIN_ON: constants[this.lang + "Translation"]["RINSE_SPIN_ON"]
                                    }
                                };
                                this.courseJson[devicedp][value] = dev[value];
                                this.courseactual[devicedp][value] = dev[value];
                                await this.createDataPoint(devicedp + ".remote.Course." + value, common, "state");
                            }
                            if (value === "ecoHybrid") {
                                common = {
                                    name: value,
                                    type: "string",
                                    role: "value",
                                    write: true,
                                    read: true,
                                    states: {
                                        ECOHYBRID_OFF: constants[this.lang + "Translation"]["ECOHYBRID_OFF"],
                                        ECOHYBRID_ON: constants[this.lang + "Translation"]["ECOHYBRID_ON"]
                                    }
                                };
                                this.courseJson[devicedp][value] = dev[value];
                                this.courseactual[devicedp][value] = dev[value];
                                await this.createDataPoint(devicedp + ".remote.Course." + value, common, "state");
                            }
                        }
                    } catch (e) {
                        this.log.error("Foreach dev: " + e + " - " + value + " - " + devicedp);
                    }
                });
            }
        } catch (e) {
            this.log.error("Error in valueinfolder: " + e);
        }
    },
    async createDataPoint(ident, common, types, native) {
        try {
            const nativvalue = !native ? { native: {} } : { native: native };
            const obj = await this.getObjectAsync(ident);
            if (!obj) {
                await this.setObjectNotExistsAsync(ident, {
                    type: types,
                    common: common,
                    ...nativvalue,
                }).catch((error) => {
                    this.log.warn(`createDataPoint: ${error}`);
                });
            } else {
                let ischange = false;
                if (JSON.stringify(obj.common) != JSON.stringify(common)) ischange = true;
                else if (JSON.stringify(obj.type) != JSON.stringify(types)) ischange = true;
                if (native) {
                    if (JSON.stringify(obj.native) != JSON.stringify(nativvalue.native)) {
                        ischange = true;
                        delete obj["native"];
                        obj["native"] = native;
                    }
                }
                if (ischange) {
                    this.log.debug(`Change common: ${ident}`);
                    delete obj["common"];
                    obj["common"] = common;
                    obj["type"] = types;
                    await this.setObjectAsync(ident, obj);
                }
            }
        } catch (e) {
            this.log.warn(`createDataPoint: ${e}`);
        }
    },
    async lastDeviceCourse(devId) {
        try {
            const devtype = await this.getStateAsync(devId + ".deviceType");
            const datacourse = await this.getDeviceEnergy(
                "service/laundry/"
                + devId
                + "/energy-history?type=count&count=10&washerType="
                + devtype.val
                + "&sorting=Y");
            if (datacourse === 400) {
                this.log.info("lastDeviceCourse: Bad Request");
                return;
            } else if (datacourse === 500) {
                this.log.info("lastDeviceCourse: Error Request");
                return;
            }
            if (!datacourse || !datacourse["item"]) {
                this.log.warn("Cannot found last course!");
                return;
            }
            this.log.debug("datacourse: " + JSON.stringify(datacourse) + " - devID: " + devId);
            if (datacourse != null && Object.keys(datacourse["item"]).length > 0) {
                const states = {};
                let count  = 0;
                let name   = "";
                const common = {
                    name: constants[this.lang + "Translation"]["LASTCOURSE"],
                    type: "number",
                    role: "value",
                    write: true,
                    read: true,
                    def: 0,
                };
                for (const items of Object.keys(datacourse["item"])) {
                    ++count;
                    name = "";
                    Object.keys(datacourse["item"][items]).forEach( async (keys) => {
                        try {
                            if (keys === "timestamp") {
                                const actual_date = new Date(parseFloat(datacourse["item"][items][keys]));
                                states[count] = new Date(actual_date.getTime() - (actual_date.getTimezoneOffset() * 60000))
                                    .toISOString()
                                    .replace("T", " ")
                                    .replace(/\..+/, "");
                            }
                            name = (constants[this.lang + "Translation"][datacourse["item"][items][keys]] != null)
                                ? constants[this.lang + "Translation"][datacourse["item"][items][keys]]
                                : datacourse["item"][items][keys];
                        } catch (e) {
                            this.log.error("datacourse: " + e + " - " + keys);
                        }
                    });
                    states[count] += " - " +  name;
                }
                states["0"] = "NOT_SELECTED";
                common["desc"] = datacourse["item"];
                common["states"] = states;
                await this.createDataPoint(devId + ".remote.LastCourse", common, "state");
                this.log.debug(JSON.stringify(states));
            } else {
                this.log.info("Not found washer!");
            }
        } catch (e) {
            this.log.error("lastDeviceCourse: " + e);
        }
    },
    /**
     * Request for device
     * @param {string} device
     * @param {string} type
     */
    async sendStaticRequest(device, type, thinq) {
        try {
            const deviceID = device;
            let statistic = null;
            let com;
            let lasturl;
            if (type === "fridge" || type === "air") {
                com = await this.getStateAsync(device + ".remote.Statistic.command");
            } else {
                com = {val: 100};
            }
            if (thinq === "thinq1") {
                if (com.val === 0) {
                    lasturl = "energy/inquiryDoorInfoMonth";
                    statistic = await this.getDeviceEnergyThinq1("/energy/inquiryDoorInfoMonth", device);
                } else if (com.val === 1) {
                    lasturl = "energy/inquiryDoorInfoDay";
                    statistic = await this.getDeviceEnergyThinq1("/energy/inquiryDoorInfoDay", device);
                } else if (com.val === 2) {
                    lasturl = "energy/inquiryPowerMeteringMonth";
                    statistic = await this.getDeviceEnergyThinq1("/energy/inquiryPowerMeteringMonth", device);
                } else if (com.val === 3) {
                    lasturl = "energy/inquiryPowerMeteringDay";
                    statistic = await this.getDeviceEnergyThinq1("/energy/inquiryPowerMeteringDay", device);
                } else if (com.val === 4) {
                    lasturl = "rms/inquiryWaterConsumptionInfo";
                    statistic = await this.getDeviceEnergyThinq1("/rms/inquiryWaterConsumptionInfo", device);
                } else if (com.val === 5) {
                    lasturl = "energy/inquiryActiveSaving";
                    statistic = await this.getDeviceEnergyThinq1("/energy/inquiryActiveSaving", device);
                } else if (com.val === 6) {
                    lasturl = "energy/inquirySmartCareActiveSaving";
                    statistic = await this.getDeviceEnergyThinq1("/energy/inquirySmartCareActiveSaving", device);
                }
            } else {
                const period  = await this.getStateAsync(device + ".remote.Statistic.period");
                let startD    = await this.getStateAsync(device + ".remote.Statistic.startDate");
                let endD      = await this.getStateAsync(device + ".remote.Statistic.endDate");
                let per = "hour";
                if (!this.checkdate(startD) || !this.checkdate(endD)) {
                    this.log.warn("Wrong date: Start: " + startD.val + " End: " + endD.val);
                    return;
                }
                if (period.val === 0 && startD.val != endD.val) {
                    this.log.warn("For hourly, the start and end date must be the same!: Start: " + startD.val + " End: " + endD.val);
                    return;
                }
                startD = this.checkdate(startD);
                endD = this.checkdate(endD);
                //fix in the next revision - year is not possible - change to month
                if (period.val === 1) per = "day";
                else if (period.val === 2) per = "month";
                else if (period.val === 3) per = "year";
                else if (period.val === 0) per = "hour";
                else per = "year";
                this.log.debug("START " + startD);
                this.log.debug("END " + endD);
                this.log.debug(JSON.stringify(per));
                lasturl = "period=" + per + "&startDate=" + startD + "&endDate=" + endD;
                if (type === "air") {
                    if (com.val === 0) {
                        statistic = await this.getDeviceEnergy("service/aircon/" + device + "/energy-history?type=period&" + lasturl);
                    } else {
                        statistic = await this.getDeviceEnergy("service/aircon/" + device + "/air-pollution-history?type=period&" + lasturl);
                    }
                } else if (type === "other") {
                    statistic = await this.getDeviceEnergy("service/laundry/" + device + "/energy-history?type=period&" + lasturl);
                } else {
                    device = "service/fridge/" + device + "/";
                    if (com.val === 0)
                        statistic = await this.getDeviceEnergy(device + "door-open-history?" + lasturl);
                    else if (com.val === 1)
                        statistic = await this.getDeviceEnergy(device + "energy-history?" + lasturl);
                    else if (com.val === 2)
                        statistic = await this.getDeviceEnergy(device + "water-consumption-history?" + lasturl);
                    else if (com.val === 3)
                        statistic = await this.getDeviceEnergy(device + "active-power-saving?" + lasturl + "&lgTotalAverageInfo=&version=2");
                    else if (com.val === 4)
                        statistic = await this.getDeviceEnergy(device + "fridge-water-history?" + lasturl);
                    else if (com.val === 5)
                        statistic = await this.getDeviceEnergy(device + "fridge-water-history?self-care?startDate=" + startD + "&endDate=" + endD);
                }
            }
            if (statistic === 400) {
                this.log.info("Bad Request: " + lasturl);
            } else if (statistic === 500) {
                this.log.info("Error Request: " + statistic);
            } else if (statistic != null) {
                this.log.debug(JSON.stringify(statistic));
                await this.setStateAsync(deviceID + ".remote.Statistic.jsonResult", {
                    val: JSON.stringify(statistic),
                    ack: true
                });
            }
        } catch (e) {
            this.log.error("Error in sendStaticRequest: " + e);
        }
    },
    /**
     * Check date for request
     */
    checkdate(value) {
        const onlynumber = /^-?[0-9]+$/;
        if (value.val == null) return false;
        const checkd = value.val.split(".");
        if (Object.keys(checkd).length !== 3) return false;
        if (checkd[0].toString().length !== 4  || !onlynumber.test(checkd[0])) return false;
        if (!onlynumber.test(checkd[1])) return false;
        if (checkd[1].toString().length !== 2) {
            if (checkd[1].toString().length === 1) {
                checkd[1] = "0" + checkd[1];
            } else {
                return false;
            }
        }
        if (!onlynumber.test(checkd[2])) return false;
        if (checkd[2].toString().length !== 2) {
            if (checkd[2].toString().length === 1) {
                checkd[2] = "0" + checkd[1];
            } else {
                return false;
            }
        }
        return checkd[0] + "-" + checkd[1] + "-" + checkd[2]
    },
    /**
     * Request for device favorite (APP Favorit WASHER & Dryer)
     * @param {string} device
     */
    async setFavoriteCourse(device) {
        try {
            this.log.debug(JSON.stringify(device));
            const favcourse = await this.getDeviceEnergy("service/laundry/" + device + "/courses/favorite");
            if (favcourse === 400) {
                this.log.info("setFavoriteCourse: Bad Request");
                return;
            } else if (favcourse === 500) {
                this.log.info("setFavoriteCourse: Error Request");
                return;
            }
            if (
                favcourse &&
                favcourse["item"] !=null &&
                Object.keys(favcourse["item"]).length > 0 &&
                favcourse["item"]["courseId"] != null
            ) {
                this.log.debug(JSON.stringify(favcourse));
                await this.setStateAsync(device + ".remote.WMDownload_Select", {
                    val: favcourse["item"]["courseId"],
                    ack: false
                });
                this.log.info("Set Favorite: " + (constants[this.lang + "Translation"][favcourse["item"]["courseId"]] != null)
                    ? constants[this.lang + "Translation"][favcourse["item"]["courseId"]]
                    : favcourse["item"]["courseId"]);
            } else {
                this.log.info("No favorite set.");
            }
        } catch (e) {
            this.log.error("Error in setFavoriteCourse: " + e);
        }
    },
    /**
     * Set program into course folder (Only Washer & Dryer Thinq2)
     * @param {string} id => path
     * @param {string} device => deviceid
     * @param {ioBroker.State | null | undefined} state
     */
    async setCourse(id, device, state) {
        try {
            if (
                !this.coursetypes[device] ||
                !this.coursetypes[device].smartCourseType ||
                !this.coursetypes[device].courseType)
            {
                this.log.info("Cannot found course type!");
                return;
            }
            const smartCourse = this.coursetypes[device].smartCourseType;
            const courseType = this.coursetypes[device].courseType;
            this.getForeignObject(id, async (err, obj) => {
                if (obj) {
                    const rawstring = obj.common.desc;
                    this.log.debug(JSON.stringify(rawstring) + " State: " + state.val);
                    if (Array.isArray(rawstring) && Object.keys(rawstring).length > 0) {
                        const rawselect = rawstring[state.val];
                        this.log.debug(JSON.stringify(rawstring) + " State: " + state.val);
                        this.log.debug(JSON.stringify(rawselect));
                        this.log.debug(JSON.stringify(smartCourse));
                        this.log.debug(JSON.stringify(courseType));
                        if (
                            (rawselect[smartCourse] &&
                            rawselect[smartCourse] !== "NOT_SELECTED") ||
                            (rawselect[courseType] &&
                            rawselect[courseType] !== "NOT_SELECTED")
                        ) {
                            await this.setStateAsync(device + ".remote.WMDownload_Select", {
                                val: rawselect[smartCourse],
                                ack: false
                            });
                            await this.sleep(1000);
                        } else {
                            this.log.info("setCourse: Device unknown");
                            return;
                        }
                        Object.keys(rawselect).forEach( async (value) => {
                            await this.getForeignObject(this.namespace + "." + device + ".remote.Course." + value, async (err, obj) => {
                                if (obj) {
                                    await this.setStateAsync(device + ".remote.Course." + value, {
                                        val: rawselect[value],
                                        ack: false
                                    });
                                    await this.sleep(200);
                                }
                            });
                        });
                    }
                }
            });
        } catch (e) {
            this.log.error("Error in setCourse: " + e);
        }
    },
    /**
     * Set program into course folder when change datapoint WMDownload (Only Washer & Dryer Thinq2)
     * @param {string} state => Input datapoint WMDownload
     * @param {string} device => deviceid
     */
    async insertCourse(state, device, course) {
        try {
            const onlynumber = /^-?[0-9]+$/;
            this.courseactual[device] = {};
            Object.keys(this.courseJson[device]).forEach( async (value) => {
                this.courseactual[device][value] = this.courseJson[device][value];
                await this.setStateAsync(device + ".remote.Course." + value, {
                    val: (onlynumber.test(this.courseJson[device][value]))
                        ? parseFloat(this.courseJson[device][value])
                        : this.courseJson[device][value],
                    ack: true
                });
            });
            let com = {};
            if (
                this.deviceJson &&
                this.deviceJson[device] &&
                this.deviceJson[device][course] &&
                this.deviceJson[device][course][state] &&
                this.deviceJson[device][course][state].function
            ) {
                com = this.deviceJson[device][course][state].function;
            } else {
                this.log.warn("Command " + state + " not found");
                return;
            }
            for(const val of com) {
                this.courseactual[device][val["value"]] = val["default"];
                await this.setStateAsync(device + ".remote.Course." + val["value"], {
                    val: (onlynumber.test(val["default"])) ? parseFloat(val["default"]) : val["default"],
                    ack: true
                });
            }
        } catch (e) {
            this.log.error("Error in insertCourse: " + e);
        }
    },
    async createCourse(state, deviceId, action) {
        try {
            const WMDLState = await this.getStateAsync(deviceId + ".remote.WMDownload_Select");
            if (!WMDLState) {
                this.log.warn("Datapoint WMDownload_Select is empty!");
                return {};
            } else if (WMDLState.val === "NOT_SELECTED") {
                this.log.warn("Datapoint WMDownload_Select is empty!");
                return {};
            }
            const isSig = this.modelInfos[deviceId]["signature"];
            state.val = WMDLState.val;
            let com = {};
            const first_insert = {};
            const last_insert = {};
            const down_insert = {};
            let downloadSlotNumber = 0;
            if (
                !this.coursetypes[deviceId] ||
                !this.coursetypes[deviceId].smartCourseType ||
                !this.coursetypes[deviceId].courseType
            ) {
                this.log.info("Cannot found course type!");
                return {};
            }
            const downloadedCourseType = this.coursetypes[deviceId].downloadedCourseType;
            const smartCourseType = this.coursetypes[deviceId].smartCourseType;
            const courseType = this.coursetypes[deviceId].courseType;
            let lengthcourse = 2;
            if (
                this.deviceJson &&
                this.deviceJson[deviceId] &&
                this.deviceJson[deviceId]["Course"] &&
                this.deviceJson[deviceId]["Course"][state.val]
            ) {
                com = this.deviceJson[deviceId]["Course"][state.val].function;
                first_insert[courseType] = state.val;
                last_insert[smartCourseType] = "NOT_SELECTED";
                if (isSig) {
                    down_insert[downloadedCourseType] = "COURSE_TYPE_COURSE";
                }
            } else if (
                this.deviceJson &&
                this.deviceJson[deviceId] &&
                this.deviceJson[deviceId]["SmartCourse"] &&
                this.deviceJson[deviceId]["SmartCourse"][state.val]
            ) {
                com = this.deviceJson[deviceId]["SmartCourse"][state.val].function;
                first_insert[courseType] = this.deviceJson[deviceId]["SmartCourse"][state.val].Course;
                lengthcourse = 3;
                if (!isSig) {
                    down_insert[downloadedCourseType] = state.val;
                } else {
                    down_insert[downloadedCourseType] = "COURSE_TYPE_DOWNLOADCYCLE";
                    downloadSlotNumber = 4;
                }
                last_insert[smartCourseType] = state.val;
            } else {
                this.log.warn("Command " + action + " and value " + state.val + " not found");
                return {};
            }
            const rawData = this.deviceControls[deviceId][action];
            const dev = Object.keys(this.deviceControls[deviceId][action]["data"])[0];
            if (Object.keys(this.courseactual[deviceId]).length === 0) {
                for(const val of com) {
                    this.courseactual[deviceId][val["value"]] = val["default"];
                }
            }
            rawData.data[dev] = {
                courseDownloadType: "COURSEDATA",
                courseDownloadDataLength: Object.keys(this.courseactual[deviceId]).length + lengthcourse,
                ...first_insert,
                ...down_insert,
                ...this.courseactual[deviceId],
                ...last_insert,
            };
            if (isSig) {
                delete rawData.data[dev]["courseDownloadDataLength"];
                delete rawData.data[dev]["courseDownloadType"];
                rawData.data[dev][downloadedCourseType] = down_insert[downloadedCourseType];
                rawData.data[dev]["downloadSlotNumber"] = downloadSlotNumber;
                rawData.data[dev]["categoryNumber"] = 0;
            }
            rawData["current_course"] = WMDLState.val;
            return rawData;
        } catch (e) {
            this.log.error("Error in createCourse: " + e);
            return {};
        }
    },
    async refreshRemote(element, thinq1, device) {
        try {
            if (element.deviceId && this.modelInfos[element.deviceId]) {
                const deviceModel = this.modelInfos[element.deviceId];
                const platformType = deviceModel["thinq2"];
                const deviceType = deviceModel["deviceType"];
                if (deviceType === 101 && platformType === "thinq2") {
                    const fixDatapoints = ["fridgeTemp", "freezerTemp", "expressMode", "ecoFriendly"];
                    let value;
                    for (const key of fixDatapoints) {
                        if (
                            element.snapshot != null &&
                            element.snapshot.refState != null &&
                            element.snapshot.refState[key] != null
                        ) {
                            if (this.remoteValue[`${element.deviceId}.snapshot.refState.${key}`] != null) {
                                value  = this.remoteValue[`${element.deviceId}.snapshot.refState.${key}`];
                            } else {
                                this.remoteValue[`${element.deviceId}.snapshot.refState.${key}`]  = element.snapshot.refState[key];
                            }
                            if (value != element.snapshot.refState[key]) {
                                await this.setStateAsync(`${element.deviceId}.remote.${key}`, {
                                    val: element.snapshot.refState[key],
                                    ack: true,
                                });
                            }
                        }
                    }
                }
            } else if (thinq1 && device) {
                this.log.debug("Refresh Remote: " + JSON.stringify(element));
                await this.setStateAsync(`${device}.remote.fridgeTemp`, {
                    val: parseInt(element.TempRefrigerator),
                    ack: true,
                });
                await this.setStateAsync(`${device}.remote.freezerTemp`, {
                    val: parseInt(element.TempFreezer),
                    ack: true,
                });
                await this.setStateAsync(`${device}.remote.expressMode`, {
                    val: parseInt(element.IcePlus),
                    ack: true,
                });
            }
        } catch (e) {
            this.log.warn("Error in refreshRemote: " + e);
        }
    },
    async refrigerator(deviceId, action, value, uuid) {
        if (
            this.modelInfos[deviceId] &&
            this.modelInfos[deviceId].ControlWifi &&
            this.modelInfos[deviceId].ControlWifi.action &&
            this.modelInfos[deviceId].ControlWifi.action.SetControl &&
            this.modelInfos[deviceId].ControlWifi.action.SetControl.data
        ) {
            let new_hex = "";
            let arr = this.modelInfos[deviceId].ControlWifi.action.SetControl.data;
            this.log.debug(arr);
            arr = arr.replace(/{|}|\[|\]| /g, "").split(",");
            for (const element of arr) {
                if (element === action) {
                    new_hex += this.DecToHex(value);
                } else if (element === 255) {
                    new_hex += this.DecToHex(255);
                } else {
                    const valueDP = await this.getStateAsync(`${deviceId}.snapshot.${element}`);
                    if (valueDP && valueDP.val != null) {
                        new_hex += this.DecToHex(valueDP.val);
                    } else {
                        new_hex += this.DecToHex(255);
                    }
                }
            }
            this.log.debug("HEX: " + new_hex);
            const data = {
                lgedmRoot: {
                    deviceId: deviceId,
                    workId: uuid,
                    cmd: "Control",
                    cmdOpt: "Set",
                    value: "ControlData",
                    data: Buffer.from(new_hex, "hex").toString("base64"),
                    format: "B64"
                }
            };
            const response = await this.sendCommandToDevice(deviceId, data, true);
            if (
                response && response.lgedmRoot && response.lgedmRoot.returnCd !== "0000"
            ) {
                this.log.error("Command not succesful - " + JSON.stringify(response));
            } else {
                this.log.debug("Command succesful - " + JSON.stringify(response));
            }
        } else {
            this.log.info("Not found modelInfos");
        }
    }
};
