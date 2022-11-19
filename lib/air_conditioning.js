const constants = require("./constants");
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
                                    role: "state",
                                },
                                native: {},
                            });
                            const obj = await this.getObjectAsync(
                                device.deviceId + ".remote." + dataRemote.ctrlKey + "." + laststate,
                            );
                            common = {
                                name: remote,
                                type: "mixed",
                                write: true,
                                read: true,
                            };
                            if (obj) {
                                common = obj.common;
                            }
                            const commons = {};
                            valueDefault = deviceModel["Value"][remote]["default"] ? deviceModel["Value"][remote]["default"] : null;
                            if (deviceModel["Value"][remote]["value_mapping"]) {
                                valueObject = deviceModel["Value"][remote]["value_mapping"];
                            }
                            if (deviceModel["Value"][remote]["value_validation"]) {
                                valueObject = deviceModel["Value"][remote]["value_validation"];
                            }
                            if (valueObject) {
                                if (valueObject.max) {
                                    common.min = 0;
                                    common.max = valueObject.max;
                                    common.def = valueDefault ? parseFloat(valueDefault) : 0;
                                    common.type = "number";
                                } else {
                                    const values = Object.keys(valueObject);
                                    values.forEach((value) => {
                                        const content = valueObject[value];
                                        if (typeof content === "string") {
                                            commons[value] = (langPack && langPack[content]) ? langPack[content] : content.replace("@", "");
                                        }
                                    });
                                }
                            }
                            if (Object.keys(commons).length > 0) {
                                if (common["states"] != null) {
                                    delete common.states;
                                }
                                common.states = commons;
                            }
                            if (!obj) {
                                await this.setObjectNotExistsAsync(device.deviceId + ".remote." + dataRemote.ctrlKey + "." + laststate, {
                                    type: "state",
                                    common: common,
                                    native: {
                                        dataKey: remote,
                                    },
                                }).catch((error) => {
                                    this.log.error(error);
                                });
                            } else {
                                obj.common = common;
                                obj.native = {dataKey: remote};
                                const res = await this.setForeignObjectAsync(
                                    this.namespace +
                                    "." +
                                    device.deviceId +
                                    ".remote." +
                                    dataRemote.ctrlKey +
                                    "." + laststate, obj
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
                                }
                            ]
//                            [
//                                "holiday",
//                                "holiday",
//                                "holiday.holiday_onoff",
//                                {
//                                    name: "Holiday On/Off",
//                                    type: "boolean",
//                                    role: "switch",
//                                    write: true,
//                                    read: true,
//                                    def: false,
//                                }
//                            ],
//                            [
//                                "holiday_data_on",
//                                "holiday",
//                                "holiday.holiday_data_on",
//                                {
//                                    name: "Holiday On JSON",
//                                    type: "string",
//                                    role: "json",
//                                    write: true,
//                                    read: true,
//                                }
//                            ],
//                            [
//                                "holiday_data_off",
//                                "holiday",
//                                "holiday.holiday_data_off",
//                                {
//                                    name: "Holiday Off JSON",
//                                    type: "string",
//                                    role: "json",
//                                    write: true,
//                                    read: true,
//                                }
//                            ],
//                            [
//                                "holiday_data_download",
//                                "holiday",
//                                "holiday.holiday_data_download",
//                                {
//                                    name: "Holiday download JSON",
//                                    type: "boolean",
//                                    role: "button",
//                                    write: true,
//                                    read: true,
//                                    def: false,
//                                }
//                            ],
//                            [
//                                "holiday_data_upload",
//                                "holiday",
//                                "holiday.holiday_data_upload",
//                                {
//                                    name: "Holiday upload JSON",
//                                    type: "boolean",
//                                    role: "button",
//                                    write: true,
//                                    read: true,
//                                    def: false,
//                                }
//                            ]
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
            const obj = await this.getObjectAsync(this.namespace + '.' + device.deviceId + ".remote." + device_data[2]);
            if (!obj) {
                await this.setObjectNotExistsAsync(device.deviceId + ".remote." + device_data[2], {
                    type: "state",
                    common: commons,
                    native: {dataKey: device_data[1]},
                })
                .catch((error) => {
                    this.log.error(error);
                });
            } else {
                delete obj["common"];
                obj["common"] = commons;
                obj["native"] = {dataKey: device_data[1]};
                const res = await this.setForeignObjectAsync(this.namespace + "." + device.deviceId + ".remote." + device_data[2], obj);
            }
        }
    },
    async updateHoliday(device, func, devType, id, state) {
        let data = {};
        switch (func) {
            case "update":
                data = {
                            ctrlKey: "reservationCtrl",
                            command: "GET",
                            dataKey: null,
                            dataValue: null,
                            dataSetList: null,
                            dataGetList: ["airState.reservation.advancedSchedule"],
                       };
                response = await this.sendCommandToDevice(device, data);
                await this.setStateAsync(device + ".remote.holiday.holiday_data_on", {
                    val: JSON.stringify(response),
                    ack: true
                });
                break;
        default:
            this.log.info("Not found switch");
            return;
        }
    }
};
