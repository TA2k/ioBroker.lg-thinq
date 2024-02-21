const new_holiday_start = {
    type: 2,
    onOffFlag: 0,
    startYear: 255,
    startMonth: 255,
    startDate: 255,
    startHour: 255,
    startMin: 255,
    power: 0,
    opMode: 3,
    tempCfg: 17,
    hotWater: 0,
};
const new_holiday_end = {
    type: 2,
    onOffFlag: 0,
    endYear: 255,
    endMonth: 255,
    endDate: 255,
    endHour: 255,
    endMin: 255,
    power: 0,
    opMode: 3,
    tempCfg: 17,
    hotWater: 0,
};
const new_silentMode = {
    type: 3,
    onOffFlag: 0,
    startHour: 17,
    startMin: 17,
    endHour: 19,
    endMin: 17,
    silentMode: 1,
};
module.exports = {
    async createAirRemoteStates(device, deviceModel) {
        if (!deviceModel || !deviceModel.ControlDevice) {
            this.log.info("createAirRemoteStates: Cannot found ControlDevice");
        }
        let langPack = null;
        if (device.langPackProductTypeUri) {
            langPack = await this.requestClient
                .get(device.langPackProductTypeUri)
                .then((res) => res.data)
                .catch((error) => {
                    this.log.info("langPackProductTypeUri: " + error);
                    return null;
                });
            if (langPack && langPack.pack) {
                langPack = langPack.pack;
            } else {
                langPack = null;
            }
        }
        this.log.debug(JSON.stringify(langPack));
        const control = JSON.stringify(deviceModel.ControlDevice);
        let common = {};
        let valueDefault = null;
        if (device.snapshot) {
            Object.keys(device.snapshot).forEach(async (remote) => {
                if (control.includes(remote)) {
                    for (const dataRemote of deviceModel.ControlDevice) {
                        if (JSON.stringify(dataRemote).includes(remote)) {
                            if (dataRemote.dataKey) {
                                const laststate = remote.split(".").pop();
                                await this.setObjectNotExistsAsync(device.deviceId + ".remote." + dataRemote.ctrlKey, {
                                    type: "channel",
                                    common: {
                                        name: dataRemote.ctrlKey,
                                        desc: "Create by LG-Thinq Adapter",
                                    },
                                    native: {},
                                });
                                const obj = await this.getObjectAsync(
                                    device.deviceId + ".remote." + dataRemote.ctrlKey + "." + laststate,
                                );
                                common = {
                                    name: remote,
                                    type: "mixed",
                                    role: "state",
                                    write: true,
                                    read: true,
                                };
                                if (obj) {
                                    common = obj.common;
                                }
                                const commons = {};
                                let valueObject = {};
                                valueDefault = deviceModel["Value"][remote]["default"]
                                    ? deviceModel["Value"][remote]["default"]
                                    : null;
                                if (deviceModel["Value"][remote]["value_mapping"]) {
                                    valueObject = deviceModel["Value"][remote]["value_mapping"];
                                }
                                if (deviceModel["Value"][remote]["value_validation"]) {
                                    valueObject = deviceModel["Value"][remote]["value_validation"];
                                }
                                if (valueObject) {
                                    if (valueObject.max) {
                                        common.min = 0;
                                        common.max = laststate == "odor" ? 2000000 : valueObject.max;
                                        common.def = valueDefault ? parseFloat(valueDefault) : 0;
                                        common.type = "number";
                                        common.role = "value";
                                    } else {
                                        const values = Object.keys(valueObject);
                                        values.forEach((value) => {
                                            const content = valueObject[value];
                                            if (typeof content === "string") {
                                                commons[value] =
                                                    langPack && langPack[content]
                                                        ? langPack[content].toString("utf-8")
                                                        : content.replace("@", "");
                                            }
                                        });
                                        common.role = "state";
                                    }
                                }
                                if (Object.keys(commons).length > 0) {
                                    if (common["states"] != null) {
                                        delete common.states;
                                    }
                                    common.states = commons;
                                }
                                if (!obj) {
                                    await this.createDataPoint(device.deviceId + ".remote." + dataRemote.ctrlKey + "." + laststate, common, "state", {"dataKey": remote});
                                } else {
                                    obj.common = common;
                                    obj.native = { dataKey: remote };
                                    await this.setObjectAsync(
                                        device.deviceId + ".remote." +
                                        dataRemote.ctrlKey + "." +
                                        laststate, obj
                                    );
                                }
                                this.log.debug("Snapshot: " + device.deviceId + ".remote." + laststate);
                            } else if (dataRemote.dataSetList) {
                                //wModeCtrl
                                //reservationCtrl
                                //favoriteCtrl
                                //filterMngStateCtrl
                                //energyDesiredCtrl
                            }
                        }
                    }
                }
            });
        }

        await this.setObjectNotExistsAsync(device.deviceId + ".remote.sendJSON", {
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
        //create manual allEventEnable, reservationCtrl
        let commons = {};
        const manuell = [
            [
                "allEventEnable",
                "airState.mon.timeout",
                "allEventEnable.timeout",
                {
                    name: "airState.mon.timeout",
                    type: "number",
                    role: "value",
                    write: true,
                    read: true,
                    min: 0,
                    max: 1440,
                    def: 0,
                },
            ],
            [
                "break",
                "holiday",
                "break.holiday_silent_update",
                {
                    name: "Read data holiday & silent",
                    type: "boolean",
                    role: "button",
                    write: true,
                    read: true,
                    def: false,
                },
            ],
            [
                "break",
                "holiday",
                "break.holiday_sendJSON",
                {
                    name: "Holiday & Silent send your JSON",
                    type: "boolean",
                    role: "switch",
                    write: true,
                    read: true,
                    def: false,
                },
            ],
            [
                "break",
                "holiday",
                "break.holiday_onoff",
                {
                    name: "Holiday On/Off",
                    type: "boolean",
                    role: "switch",
                    write: true,
                    read: true,
                    def: false,
                },
            ],
            [
                "break",
                "holiday",
                "break.holiday_silent_data",
                {
                    name: "Holiday JSON",
                    type: "string",
                    role: "json",
                    write: true,
                    read: true,
                },
            ],
            [
                "break",
                "holiday",
                "break.holiday_startdate",
                {
                    name: "Holiday start DD.MM.YY HH:MM",
                    type: "string",
                    role: "value.date",
                    write: true,
                    read: true,
                },
            ],
            [
                "break",
                "holiday",
                "break.holiday_enddate",
                {
                    name: "Holiday end DD.MM.YY HH:MM",
                    type: "string",
                    role: "value.date",
                    write: true,
                    read: true,
                },
            ],
            [
                "break",
                "holiday",
                "break.holiday_heating",
                {
                    name: "Holiday heating on/off",
                    type: "boolean",
                    role: "switch",
                    write: true,
                    read: true,
                    def: false,
                },
            ],
            [
                "break",
                "holiday",
                "break.holiday_water",
                {
                    name: "Holiday water on/off",
                    type: "boolean",
                    role: "switch",
                    write: true,
                    read: true,
                    def: false,
                },
            ],
            [
                "break",
                "holiday",
                "break.silent_mode_starttime",
                {
                    name: "Silent-Mode start HH:MM",
                    type: "string",
                    role: "value.date",
                    write: true,
                    read: true,
                },
            ],
            [
                "break",
                "holiday",
                "break.silent_mode_endtime",
                {
                    name: "Silent-Mode end HH:MM",
                    type: "string",
                    role: "value.date",
                    write: true,
                    read: true,
                },
            ],
            [
                "break",
                "holiday",
                "break.silent_mode_onoff",
                {
                    name: "Silent-Mode On/Off",
                    type: "boolean",
                    role: "switch",
                    write: true,
                    read: true,
                    def: false,
                },
            ],
        ];
        for (const device_data of manuell) {
            commons = device_data[3];
            await this.setObjectNotExistsAsync(device.deviceId + ".remote." + device_data[0], {
                type: "channel",
                common: {
                    name: device_data[0],
                    role: "state",
                },
                native: {},
            });
            const obj = await this.getObjectAsync(device.deviceId + ".remote." + device_data[2]);
            if (!obj) {
                await this.createDataPoint(device.deviceId + ".remote." + device_data[2], commons, "state", {"dataKey": device_data[1]});
            } else {
                delete obj["common"];
                obj["common"] = commons;
                obj["native"] = { dataKey: device_data[1] };
                await this.setObjectAsync(
                    device.deviceId + ".remote." + device_data[2],
                    obj,
                );
            }
        }
    },
    async updateHoliday(device, devType, id, state) {
        const laststate = id.split(".").pop();
        let countValue = 0;
        let next_type = 0;
        let first_type_2 = true;
        let obj = null;
        let is_holiday_available = false;
        let is_silent_available = false;
        const data = {
            ctrlKey: "reservationCtrl",
            command: "Get",
            dataKey: null,
            dataValue: null,
            dataSetList: null,
            dataGetList: ["airState.reservation.advancedSchedule"],
        };
        try {
            let valJSON;
            let editJSON;
            let datapoint = "";
            switch (laststate) {
                case "holiday_silent_update":
                    obj = await this.sendCommandToDevice(device, data);
                    if (obj && obj.result && obj.result.data) {
                        await this.setStateAsync(device + ".remote.break.holiday_silent_data", {
                            val: JSON.stringify(obj.result.data),
                            ack: true,
                        });
                        let date_DP = "";
                        if (obj.result.data["airState.reservation.advancedSchedule"]) {
                            const lastValue = Object.keys(
                                obj.result.data["airState.reservation.advancedSchedule"],
                            ).length;
                            for (const element of obj.result.data["airState.reservation.advancedSchedule"]) {
                                ++countValue;
                                if (countValue < lastValue) {
                                    next_type =
                                        obj.result.data["airState.reservation.advancedSchedule"][countValue].type;
                                } else {
                                    next_type = element.type;
                                }
                                this.log.debug(next_type);
                                if (element.type != null && element.onOffFlag != null) {
                                    if (element.type === 2 && countValue != lastValue && first_type_2) {
                                        first_type_2 = false;
                                        is_holiday_available = true;
                                        date_DP =
                                            element["startDate"].toString().length == 1
                                                ? "0" + element.startDate
                                                : element.startDate + ".";
                                        date_DP +=
                                            element["startMonth"].toString().length == 1
                                                ? "0" + element.startMonth
                                                : element.startMonth + ".";
                                        date_DP += element.startYear + " ";
                                        date_DP +=
                                            element["startHour"].toString().length == 1
                                                ? "0" + element.startHour
                                                : element.startHour + ":";
                                        date_DP +=
                                            element["startMin"].toString().length == 1
                                                ? "0" + element.startMin
                                                : element.startMin;
                                        await this.setStateAsync(device + ".remote.break.holiday_heating", {
                                            val: element.power ? true : false,
                                            ack: true,
                                        });
                                        await this.setStateAsync(device + ".remote.break.holiday_water", {
                                            val: element.hotWater ? true : false,
                                            ack: true,
                                        });
                                        await this.setStateAsync(device + ".remote.break.holiday_startdate", {
                                            val: date_DP,
                                            ack: true,
                                        });
                                    } else if (element.type === 2 && (countValue === lastValue || next_type === 3)) {
                                        is_holiday_available = true;
                                        date_DP =
                                            element["endDate"].toString().length == 1
                                                ? "0" + element.endDate
                                                : element.endDate + ".";
                                        date_DP +=
                                            element["endMonth"].toString().length == 1
                                                ? "0" + element.endMonth
                                                : element.endMonth + ".";
                                        date_DP += element.endYear + " ";
                                        date_DP +=
                                            element["endHour"].toString().length == 1
                                                ? "0" + element.endHour
                                                : element.endHour + ":";
                                        date_DP +=
                                            element["endMin"].toString().length == 1
                                                ? "0" + element.endMin
                                                : element.endMin;
                                        await this.setStateAsync(device + ".remote.break.holiday_enddate", {
                                            val: date_DP,
                                            ack: true,
                                        });
                                        await this.setStateAsync(device + ".remote.break.holiday_onoff", {
                                            val: element.onOffFlag === 1 ? true : false,
                                            ack: true,
                                        });
                                    } else if (element.type === 3) {
                                        is_silent_available = true;
                                        date_DP =
                                            element["startHour"].toString().length == 1
                                                ? "0" + element.startHour
                                                : element.startHour + ":";
                                        date_DP +=
                                            element["startMin"].toString().length == 1
                                                ? "0" + element.startMin
                                                : element.startMin;
                                        await this.setStateAsync(device + ".remote.break.silent_mode_starttime", {
                                            val: date_DP,
                                            ack: true,
                                        });
                                        date_DP =
                                            element["endHour"].toString().length == 1
                                                ? "0" + element.endHour
                                                : element.endHour + ":";
                                        date_DP +=
                                            element["endMin"].toString().length == 1
                                                ? "0" + element.endMin
                                                : element.endMin;
                                        await this.setStateAsync(device + ".remote.break.silent_mode_endtime", {
                                            val: date_DP,
                                            ack: true,
                                        });
                                        await this.setStateAsync(device + ".remote.break.silent_mode_onoff", {
                                            val: element.onOffFlag === 1 ? true : false,
                                            ack: true,
                                        });
                                    }
                                } else {
                                    this.log.info("Cannot find advancedSchedule!");
                                }
                            }
                            if (is_holiday_available === false) {
                                obj.result.data["airState.reservation.advancedSchedule"].push(new_holiday_start);
                                obj.result.data["airState.reservation.advancedSchedule"].push(new_holiday_end);
                                this.log.info("Push advancedSchedule holiday");
                            }
                            if (is_silent_available === false) {
                                obj.result.data["airState.reservation.advancedSchedule"].push(new_silentMode);
                                this.log.info("Push advancedSchedule silent mode");
                            }
                            if (is_holiday_available === false || is_silent_available === false) {
                                data.command = "Set";
                                data.dataSetList = obj.result.data;
                                // @ts-ignore
                                data.dataGetList = null;
                                this.log.info("send obj: " + JSON.stringify(data));
                                obj = await this.sendCommandToDevice(device, data);
                                this.log.info("create obj: " + JSON.stringify(obj));
                                if (obj != null && obj.resultCode != null && obj.resultCode == "0000") {
                                    this.log.warn(
                                        "Holiday/Silent Mode time maybe created. Please press holiday_silent_update again!",
                                    );
                                } else {
                                    this.log.info("Cannot created advancedSchedule!");
                                }
                            }
                        } else {
                            this.log.info("Cannot find advancedSchedule");
                        }
                    }
                    break;
                case "holiday_enddate":
                    break;
                case "holiday_startdate":
                    break;
                case "holiday_heating":
                    break;
                case "holiday_water":
                    break;
                case "holiday_silent_data":
                    break;
                case "silent_mode_starttime":
                    break;
                case "silent_mode_endtime":
                    break;
                case "silent_mode_onoff":
                case "holiday_onoff":
                    await this.setStateAsync(device + ".remote.break." + laststate, {
                        val: false,
                        ack: true,
                    });
                    valJSON = await this.getStateAsync(device + ".remote.break.holiday_silent_data");
                    if (!valJSON || valJSON.val == null || valJSON.val == "") {
                        this.log.info("Cannot find advancedSchedule!");
                        break;
                    }
                    editJSON = JSON.parse(valJSON.val);
                    if (!editJSON["airState.reservation.advancedSchedule"]) {
                        this.log.info("Missing advancedSchedule!");
                        break;
                    }
                    datapoint = "holiday_startdate";
                    if (state.val) {
                        const allValue = Object.keys(editJSON["airState.reservation.advancedSchedule"]).length;
                        if (allValue === 0) {
                            this.log.info("The holiday JSON is empty!");
                            break;
                        } else if (allValue > 4 && allValue === 5) {
                            next_type = editJSON["airState.reservation.advancedSchedule"][allValue - 1].type;
                            if (next_type != 3) {
                                this.log.info("Cannot create a holiday JSON! Use direct DP holiday_sendJSON!");
                                break;
                            }
                        } else if (allValue > 5) {
                            this.log.info("Cannot create a holiday JSON! Use direct DP holiday_sendJSON!");
                            break;
                        }
                        if (laststate != "holiday_onoff") {
                            datapoint = "silent_mode_starttime";
                        }
                        const startD = await this.getStateAsync(device + ".remote.break." + datapoint);
                        if (!startD || startD.val == null || startD.val == "") {
                            this.log.info("Cannot find startdate!");
                            break;
                        }
                        if (datapoint == "silent_mode_starttime") {
                            startD.val = "01.01.21 " + startD.val;
                        }
                        const startDate = await this.checkHolidayDate(startD.val, laststate);
                        if (!startDate) {
                            break;
                        }
                        datapoint = "holiday_enddate";
                        if (laststate != "holiday_onoff") {
                            datapoint = "silent_mode_endtime";
                        }
                        const endD = await this.getStateAsync(device + ".remote.break." + datapoint);
                        if (!endD || endD.val == null || endD.val == "") {
                            this.log.info("Cannot find enddate!");
                            break;
                        }
                        if (datapoint == "silent_mode_endtime") {
                            endD.val = "01.01.21 " + endD.val;
                        }
                        const endDate = await this.checkHolidayDate(endD.val, laststate);
                        if (!endDate) {
                            break;
                        }
                        if (endDate[5] - startDate[5] < 0) {
                            this.log.info("Enddate is less than the startdate!");
                            break;
                        }
                        const heating = await this.getStateAsync(device + ".remote.break.holiday_heating");
                        const firstValue = {};
                        for (const element of editJSON["airState.reservation.advancedSchedule"]) {
                            ++countValue;
                            if (countValue < allValue) {
                                next_type = editJSON["airState.reservation.advancedSchedule"][countValue].type;
                            } else {
                                next_type = element.type;
                            }
                            this.log.debug(next_type);

                            if (element.type != null && element.type === 1 && countValue === 1) {
                                firstValue["power"] = element.power;
                                firstValue["hotWater"] = element.hotWater;
                            } else if (
                                first_type_2 &&
                                laststate == "holiday_onoff" &&
                                element.type != null &&
                                element.type === 2 &&
                                countValue !== allValue
                            ) {
                                first_type_2 = false;
                                element.onOffFlag = 1;
                                element.startDate = startDate[0];
                                element.startMonth = startDate[1];
                                element.startYear = startDate[2];
                                element.startHour = startDate[3];
                                element.startMin = startDate[4];
                                element.power = heating.val === true ? 1 : 0;
                                element.hotWater = heating.val === true ? 1 : 0;
                            } else if (
                                laststate == "holiday_onoff" &&
                                element.type != null &&
                                element.type === 2 &&
                                (countValue === allValue || next_type === 3)
                            ) {
                                element.onOffFlag = 1;
                                element.startDate = 255;
                                element.startMonth = 255;
                                element.startYear = 255;
                                element.startHour = 255;
                                element.startMin = 255;
                                element.endDate = endDate[0];
                                element.endMonth = endDate[1];
                                element.endYear = endDate[2];
                                element.endHour = endDate[3];
                                element.endMin = endDate[4];
                                element.power = firstValue["power"];
                                element.hotWater = firstValue["hotWater"];
                            } else if (laststate == "silent_mode_onoff" && element.type === 3) {
                                element.onOffFlag = 1;
                                element.startHour = startDate[3];
                                element.startMin = startDate[4];
                                element.endHour = endDate[3];
                                element.endMin = endDate[4];
                            }
                        }
                        this.log.debug("editJSON: " + JSON.stringify(editJSON));
                        data.command = "Set";
                        data.dataSetList = editJSON;
                        // @ts-ignore
                        data.dataGetList = null;
                        obj = await this.sendCommandToDevice(device, data);
                        this.log.debug("obj: " + JSON.stringify(obj));
                        if (obj != null && obj.resultCode != null && obj.resultCode == "0000") {
                            this.log.info("Holiday/Silent Mode time is activated.");
                            await this.setStateAsync(device + ".remote.break." + laststate, {
                                val: true,
                                ack: true,
                            });
                        } else {
                            this.log.info("Cannot update advancedSchedule!");
                        }
                    } else {
                        for (const element of editJSON["airState.reservation.advancedSchedule"]) {
                            if (element.type && element.type === 2 && laststate == "holiday_onoff") {
                                element.onOffFlag = 0;
                            }
                            if (element.type && element.type === 3 && laststate == "silent_mode_onoff") {
                                element.onOffFlag = 0;
                            }
                        }
                        this.log.debug("editJSON: " + JSON.stringify(editJSON));
                        data.command = "Set";
                        data.dataSetList = editJSON;
                        // @ts-ignore
                        data.dataGetList = null;
                        obj = await this.sendCommandToDevice(device, data);
                        this.log.debug("obj: " + JSON.stringify(obj));
                        if (obj != null && obj.resultCode != null && obj.resultCode == "0000") {
                            this.log.info("Holiday/Silent Mode time is disabled.");
                            await this.setStateAsync(device + ".remote.break.holiday_silent_update", {
                                val: true,
                                ack: false,
                            });
                        } else {
                            this.log.info("Cannot update advancedSchedule!");
                        }
                    }
                    break;
                case "holiday_sendJSON":
                    break;
                default:
                    this.log.info("Not found switch");
                    return;
            }
        } catch (err) {
            this.log.info("updateHoliday: " + err);
        }
    },
    async checkHolidayDate(datecheck, laststate) {
        try {
            const dateTime = datecheck.split(" ");
            if (dateTime.length != 2) {
                this.log.info("Cannot parse date & time!");
                return false;
            }
            const splitTime = dateTime[1].split(":");
            if (splitTime.length != 2) {
                this.log.info("Cannot parse time!!");
                return false;
            }
            const splitDate = dateTime[0].split(".");
            if (splitDate.length != 3) {
                this.log.info("Cannot parse date!!");
                return false;
            }
            if (
                splitDate[0].toString().length != 2 ||
                splitDate[1].toString().length != 2 ||
                splitDate[2].toString().length != 2 ||
                splitDate[0] > 31 ||
                splitDate[1] > 12 ||
                splitTime[0].toString().length != 2 ||
                splitTime[1].toString().length != 2 ||
                splitTime[0] > 23 ||
                splitTime[1] > 59
            ) {
                this.log.info("Cannot parse startdate/starttime!!");
                return false;
            }
            const times = new Date(
                "20" +
                    splitDate[2] +
                    "-" +
                    splitDate[1] +
                    "-" +
                    splitDate[0] +
                    " " +
                    splitTime[0] +
                    ":" +
                    splitTime[1] +
                    ":00",
            );
            if (times.getTime() - Date.now() < 0 && laststate == "holiday_onoff") {
                this.log.info("Date is less than the current date.");
                return false;
            }
            return [
                Number(splitDate[0]),
                Number(splitDate[1]),
                Number(splitDate[2]),
                Number(splitTime[0]),
                Number(splitTime[1]),
                times.getTime(),
            ];
        } catch (err) {
            this.log.info("checkHolidayDate: " + err);
            return false;
        }
    },
    async createAirRemoteThinq1States(device, deviceModel, constants) {
        if (!deviceModel) {
            this.log.info("createAirRemoteThinq1States: Cannot found ControlDevice");
            return;
        }
        let langPack = null;
        if (device.langPackProductTypeUri) {
            langPack = await this.requestClient
                .get(device.langPackProductTypeUri)
                .then((res) => res.data)
                .catch((error) => {
                    this.log.info("langPackProductTypeUri: " + error);
                    return null;
                });
            if (langPack && langPack.pack) {
                langPack = langPack.pack;
            } else {
                langPack = null;
            }
        }
        this.log.debug(`LangPack: ${JSON.stringify(langPack)}`);
        const monitoring = deviceModel.Monitoring && deviceModel.Monitoring.protocol ? deviceModel.Monitoring.protocol : null;
        const path = `${device.deviceId}.remote.settings.`;
        const path_remote = `${device.deviceId}.remote.`;
        if (monitoring != null) {
            for (const val of monitoring) {
                const state = val.value;
                this.log.debug(path + state);
                if (deviceModel["Value"][state]) {
                    if (deviceModel.ControlWifi && deviceModel.ControlWifi.action && deviceModel.ControlWifi.action[`Set${state}`]) {
                        await this.setObjectNotExistsAsync(`${path_remote}Set${state}`, {
                            type: "state",
                            common: {
                                name: deviceModel.ControlWifi.action[`Set${state}`].value || state,
                                type: "boolean",
                                role: "button",
                                desc: "Create by LG-Thinq Adapter",
                                def: false,
                                write: true,
                                read: true,
                            },
                            native: {},
                        }).catch((error) => {
                            this.log.error(error);
                        });
                    }
                    const obj = await this.getObjectAsync(path + state);
                    const common = {
                        name: state,
                        type: "mixed",
                        role: "state",
                        write: true,
                        read: true,
                    };
                    const commons = {};
                    const valueObject = deviceModel["Value"][state]["option"]
                        ? deviceModel["Value"][state]["option"]
                        : null;
                    const valueDefault = deviceModel["Value"][state]["default"]
                        ? deviceModel["Value"][state]["default"]
                        : null;
                    if (valueObject) {
                        if (valueObject.max) {
                            common.min = 0;
                            if (state === "moreLessTime") {
                                common.max = 200;
                            } else if (state === "timeSetting") {
                                common.max = 360;
                            } else {
                                if (valueDefault != null && valueDefault > valueObject.max) {
                                    common.max = valueDefault;
                                } else {
                                    common.max = valueObject.max;
                                }
                            }
                        } else {
                            const values = Object.keys(valueObject);
                            for (const value of values) {
                                const content = valueObject[value];
                                if (typeof content === "string") {
                                    const new_content = content.replace("@", "");
                                    if (langPack != null && langPack[content]) {
                                        commons[value] = langPack[content].toString("utf-8");
                                    } else if (constants[this.lang + "Translation"][new_content] != null) {
                                        commons[value] = constants[this.lang + "Translation"][new_content];
                                    } else {
                                        commons[value] = new_content;
                                    }
                                }
                            }
                        }
                        common.def = valueDefault ? parseFloat(valueDefault) : 0;
                        common.type = "number";
                        if (Object.keys(commons).length > 0) {
                            if (common["states"] != null) {
                                delete common.states;
                            }
                            common.states = commons;
                        }
                        if (!obj) {
                            // @ts-ignore
                            await this.setObjectNotExistsAsync(path + state, {
                                type: "state",
                                common: common,
                                native: {},
                            }).catch((error) => {
                                this.log.error(error);
                            });
                        } else {
                            obj.common = common;
                            await this.setObjectAsync(path + state, obj);
                        }
                    }
                }
            }
        }
    },
    async sendCommandThinq1AC(id, deviceID, data, action) {
        const rawData = Object.assign({}, data);
        const dp_value = async (dp, single) => {
            if (single) {
                const val = await this.getStateAsync(dp);
                this.log.debug("Val: " + JSON.stringify(val));
                return val.val;
            } else {
                try {
                    this.log.debug("RAW: " + dp);
                    const json_value = JSON.parse(dp);
                    this.log.debug("RAW_JSON: " + JSON.stringify(json_value));
                    const new_json = {};
                    for (const js in json_value) {
                        const value = await this.getStateAsync(`${deviceID}.remote.settings.${js}`);
                        this.log.debug("Value: " + JSON.stringify(value));
                        if (value) {
                            new_json[js] = value.val;
                        } else {
                            new_json[js] = json_value[js];
                        }
                    }
                    return new_json;
                } catch (e) {
                    this.log.info("sendCommandThinq1AC: " + e);
                    return null;
                }
            }
        };
        if (action === "SetOperation") {
            //rawData.value = await dp_value(`${deviceID}.remote.settings.Operation`, true);
            rawData.value = await dp_value(`${deviceID}.remote.settings.Operation`, true);
        } else if (action === "SetEnergyDesiredValue") {
            rawData.value = null;
            //"value": "{\"Schedule\" : \" { \"Day\":\"{EnergyDesiredValueDay}\",\"Week\":\"{EnergyDesiredValueWeek}\",\"Month\":\"{EnergyDesiredValueMonth}\" } \" } ",
        } else if (action === "SetRecommendWind") {
            rawData.value = null;
            //"value": "{\"AirCapsule\" : \"{ \"OpMode\":\"{{OpMode}}\",\"TempCfg\":\"{{TempCfg}}\"}",
        } else if (action === "SetFilterUse") {
            rawData.value = "Filter";
        } else if (action === "Camera_Start" || action === "Camera_Start") {
            rawData.value = null;
        } else if (action === "Indirect_Wind_ON") {
            rawData.value = "Indirect_Wind_ON";
        } else if (action === "Indirect_Wind_OFF") {
            rawData.value = "Indirect_Wind_OFF";
        } else {
            rawData.value = await dp_value(rawData.value, false);
        }
        this.setAckFlag(id);
        this.log.debug("rawDataFunc: " + JSON.stringify(rawData));
        rawData._comment && delete rawData._comment;
        return rawData;
    },
    async getSummary(API_KEY, SVC_CODE, TIME_ZONE) {
        if (this.defaultHeaders == null) return;
        const header = {
            "x-thinq-app-pageid": "CEM_Home",
            "x-trial": "N",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
            "x-service-phase": "OP",
            "x-thinq-app-ver": "5.0.1000",
            "x-timezone": TIME_ZONE,
            "x-thinq-app-module-ver": "5001.03",
            "x-language-code": this.defaultHeaders["x-language-code"],
            "Sec-Fetch-Dest": "empty",
            "x-client-id": this.mqtt_userID,
            "x-thinq-app-level": "PRD",
            "Sec-Fetch-Site": "cross-site",
            "x-user-no": this.userNumber,
            "x-carefrom": "menu",
            "x-device-platform": "IOS",
            "x-service-code": SVC_CODE,
            "x-message-id": this.random_string(22),
            "x-thinq-app-module": "CEM",
            "Accept-Language": "de-DE,de;q=0.9",
            "x-emp-token": this.session.access_token,
            "Accept": "application/json, text/plain, */*",
            "x-api-key": API_KEY,
            "x-country-code": this.defaultHeaders["x-country-code"],
            "x-home-id": this.homes[0].homeId,
            "Sec-Fetch-Mode": "cors",
        };
        this.log.info("header: " + JSON.stringify(header));
        const energy_state = await this.requestClient
            .get("https://eic-hdss.lgthinq.com:47040/v3/hdss/energy/state",
                {
                    headers: header,
                },
            )
            .then((res) => res.data)
            .catch((error) => {
                this.log.debug("energy_state: " + error);
                return false;
            });
        this.log.info("energy_state: " + JSON.stringify(energy_state));
        const energy_summary = await this.requestClient
            .get("https://eic-hdss.lgthinq.com:47040/v3/hdss/energy/summary",
                {
                    headers: header,
                })
            .then((res) => res.data)
            .catch((error) => {
                this.log.debug("energy_summary: " + error);
                return false;
            });
        this.log.info("energy_summary: " + JSON.stringify(energy_summary));
    }
};
