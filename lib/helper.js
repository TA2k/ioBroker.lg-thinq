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
                min: 0,
                max: 500,
                def: 0,
            }
            await this.createDataPoint(path + stateName, commons);
        }
        const com = {
            name: "dnn_dust",
            type: "string",
            role: "info",
            write: false,
            read: true,
            def: "-",
        }
        await this.createDataPoint(path + "dnn_dust", com);
    },
    async createFridge(device) {
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
                min: 1,
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
        }
        await this.createDataPoint(device.deviceId + ".remote.expressMode", commons);
        await this.setObjectNotExistsAsync(device.deviceId + ".remote.ecoFriendly", {
            type: "state",
            common: {
                name: "ecoFriendly",
                type: "boolean",
                write: true,
                read: true,
                role: "state",
                desc: "Umweltfreundlich. Nicht für alle verfügbar",
                def: false,
                states: {
                    true: "ON",
                    false: "OFF",
                },
            },
            native: {},
        });
    },
    async createStatistic(devicedp, fridge) {
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

            if (fridge === 101) {
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

            this.setObjectNotExists(devicedp + ".remote.Statistic.period", {
                type: "state",
                common: {
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
                        "3": constants[this.lang + "Translation"]["YEARLY"],
                    },
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });

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
        } catch (e) {
            this.log.error("Error in createStatistic: " + e);
        }
    },
    async createremote(devicedp, control, course) {
        try {
            let states = {};
            let dev    = "";
            let db     = null;
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
                await this.createDataPoint(devicedp + ".remote.WMDownload_Select", common);
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
                                        if (value === "moreLessTime") {
                                            common[map] = 200;
                                        } else if (value === "timeSetting") {
                                            common[map] = 360;
                                        } else {
                                            common[map] = (course["MonitoringValue"][value]["valueMapping"][map] != null)
                                                ? course["MonitoringValue"][value]["valueMapping"][map]
                                                : 0;
                                        }
                                        common["type"] = "number";
                                        common["def"] = 0;
                                    } else {
                                        states[map] = (constants[this.lang + "Translation"][map] != null)
                                            ? constants[this.lang + "Translation"][map]
                                            : states[map]["value"];
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
                            await this.createDataPoint(devicedp + ".remote.Course." + value, common);
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
                                await this.createDataPoint(devicedp + ".remote.Course." + value, common);
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
                                await this.createDataPoint(devicedp + ".remote.Course." + value, common);
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
    async createDataPoint(ident, common) {
        const obj = await this.getObjectAsync(this.namespace + '.' + ident);
        if (!obj) {
            await this.setObjectNotExistsAsync(ident, {
                type: "state",
                common: common,
                native: {},
            })
            .catch((error) => {
                this.log.error(error);
            });
        } else {
            delete obj["common"];
            obj["common"] = common;
            const res = await this.setForeignObjectAsync(this.namespace + "." + ident, obj);
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
            if (!datacourse || !datacourse["item"]) {
                this.log.warn("Cannot found last course!");
                return;
            }
            this.log.debug("datacourse: " + JSON.stringify(datacourse) + " - devID: " + devId);
            if (datacourse != null && Object.keys(datacourse["item"]).length > 0) {
                let states = {};
                let count  = 0;
                let name   = "";
                let common = {
                    name: constants[this.lang + "Translation"]["LASTCOURSE"],
                    type: "number",
                    role: "value",
                    write: true,
                    read: true,
                    def: 0,
                };
                for (const items of Object.keys(datacourse["item"])) {
                    ++count;
                    name = null;
                    Object.keys(datacourse["item"][items]).forEach( async (keys) => {
                        try {
                            if (keys === "timestamp") {
                                let actual_date = new Date(parseFloat(datacourse["item"][items][keys]));
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
                await this.createDataPoint(devId + ".remote.LastCourse", common);
                this.log.debug(JSON.stringify(states));
            } else {
                this.log.info("Not found washer!");
            }
        } catch (e) {
            this.log.error("lastDeviceCourse: " + JSON.stringify(datacourse) + " - Error: " + e);
        }
    },
    /**
     * Request for device
     * @param {string} device
     * @param {state} true for fridge
     */
    async sendStaticRequest(device, fridge) {
        try {
            const deviceID = device;
            let statistic = null;
            const period  = await this.getStateAsync(device + ".remote.Statistic.period");
            let startD    = await this.getStateAsync(device + ".remote.Statistic.startDate");
            let endD      = await this.getStateAsync(device + ".remote.Statistic.endDate");
            let com       = "";
            if (fridge) {
                com = await this.getStateAsync(device + ".remote.Statistic.command");
            }
            let per = "hour";
            if (!this.checkdate(startD) || !this.checkdate(endD)) {
                this.log.warn("Wrong date: Start: " + startD.val + " End: " + endD.val);
                return;
            }
            startD = this.checkdate(startD);
            endD = this.checkdate(endD);
            if (period.val === 1) per = "day";
            else if (period.val === 2) per = "month";
            else if (period.val === 3) per = "year";
            else per = "year";
            this.log.debug("START " + startD);
            this.log.debug("END " + endD);
            this.log.debug(JSON.stringify(per));
            let lasturl = "period=" + per + "&startDate=" + startD + "&endDate=" + endD;
            if (!fridge) {
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
            if (statistic != null) {
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
     * @param {string} input date from user
     */
    checkdate(value) {
        const onlynumber = /^-?[0-9]+$/;
        if (value.val == null) return false;
        let checkd = value.val.split(".");
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
                const obj = await this.getStateAsync(device + ".remote.Course." + val["value"]);
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
            state.val = WMDLState.val;
            let com = {};
            let first_insert = {};
            let last_insert = {};
            let down_insert = {};
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
            } else if (
                this.deviceJson &&
                this.deviceJson[deviceId] &&
                this.deviceJson[deviceId]["SmartCourse"] &&
                this.deviceJson[deviceId]["SmartCourse"][state.val]
            ) {
                com = this.deviceJson[deviceId]["SmartCourse"][state.val].function;
                first_insert[courseType] = this.deviceJson[deviceId]["SmartCourse"][state.val].Course;
                lengthcourse = 3;
                down_insert[downloadedCourseType] = state.val;
                last_insert[smartCourseType] = state.val;
            } else {
                this.log.warn("Command " + action + " and value " + state.val + " not found");
                return {};
            }
            let rawData = this.deviceControls[deviceId][action];
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
            rawData["current_course"] = WMDLState.val;
            return rawData;
        } catch (e) {
            this.log.error("Error in createCourse: " + e);
            return {};
        }
    }
};
