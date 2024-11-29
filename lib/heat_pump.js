module.exports = {
    async createHeatRemoteStates(device, deviceModel) {
        if (!deviceModel || !deviceModel.ControlDevice) {
            this.log.info("createHeatRemoteStates: Cannot found ControlDevice");
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
        const datapoints = ["airState.tempState.hotWaterTarget", "airState.opMode", "airState.operation"];
        if (device.snapshot) {
            await this.setObjectNotExistsAsync(device.deviceId + ".remote.basicCtrl", {
                type: "channel",
                common: {
                    name: "basicCtrl",
                    desc: "Create by LG-Thinq Adapter",
                },
                native: {},
            });
            for (const remote of datapoints) {
                let common = {};
                let valueDefault = null;
                if (deviceModel.Value && deviceModel.Value[remote]) {
                    const laststate = remote.split(".").pop();
                    const obj = await this.getObjectAsync(
                        device.deviceId + ".remote.basicCtrl." + laststate,
                    );
                    common = {
                        name: remote,
                        role: "state",
                        type: "mixed",
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
                    this.log.debug("valueObject - " + JSON.stringify(valueObject));
                    if (valueObject) {
                        if (valueObject.max) {
                            common.min = 0;
                            common.max = laststate == "odor" ? 20000 : valueObject.max;
                            common.def = valueDefault ? parseFloat(valueDefault) : 0;
                            common.type = "number";
                        } else {
                            const values = Object.keys(valueObject);
                            if (valueDefault != null) {
                                common.def = valueDefault;
                            }
                            for (const value of values) {
                                const content = valueObject[value];
                                if (typeof content === "string") {
                                    commons[value] =
                                        langPack && langPack[content]
                                            ? langPack[content].toString("utf-8")
                                            : content.replace("@", "");
                                }
                            }
                        }
                        if (Object.keys(commons).length > 0) {
                            if (common["states"] != null) {
                                delete common.states;
                            }
                            common.states = commons;
                        }
                        if (!obj) {
                            await this.setObjectNotExistsAsync(
                                device.deviceId + ".remote.basicCtrl." + laststate,
                                {
                                    type: "state",
                                    common: common,
                                    native: {
                                        dataKey: remote,
                                    },
                                },
                            ).catch((error) => {
                                this.log.error(error);
                            });
                        } else {
                            obj.common = common;
                            obj.native = { dataKey: remote };
                            await this.setObjectAsync(
                                device.deviceId + ".remote.basicCtrl." +
                                laststate, obj
                            );
                        }
                        await this.setState(device.deviceId + ".remote.basicCtrl." + laststate, device.snapshot[remote], true);
                        this.log.debug("Snapshot: " + device.deviceId + ".remote.basicCtrl." + laststate);
                    }
                } else {
                    this.log.warn(`Cannot found ${remote}`);
                }
            }
        }
        await this.setObjectNotExistsAsync(device.deviceId + ".remote.reservationCtrl", {
            type: "channel",
            common: {
                name: "reservationCtrl",
                desc: "Create by LG-Thinq Adapter",
            },
            native: {},
        });
        const data = {
            "command": "Get",
            "ctrlKey": "reservationCtrl",
            "dataGetList": [
                "airState.reservation.monOnTime",
                "airState.reservation.monOffTime",
                "airState.reservation.tueOnTime",
                "airState.reservation.tueOffTime",
                "airState.reservation.wedOnTime",
                "airState.reservation.wedOffTime",
                "airState.reservation.thuOnTime",
                "airState.reservation.thuOffTime",
                "airState.reservation.friOnTime",
                "airState.reservation.friOffTime",
                "airState.reservation.satOnTime",
                "airState.reservation.satOffTime",
                "airState.reservation.sunOnTime",
                "airState.reservation.sunOffTime"
            ],
            "dataKey": null,
            "dataSetList": null,
            "dataValue": null
        };
        const response = await this.sendCommandToDevice(device.deviceId, data);
        this.log.debug(`response: ${JSON.stringify(response)}`);
        let counter = 0;
        const del_states = [];
        del_states.push("00");
        if (
            response &&
            response.result &&
            response.result.data &&
            response.result.data["airState.reservation.monOnTime"]
        ) {
            const on_data = response.result.data["airState.reservation.monOnTime"].split("|");
            const off_data = response.result.data["airState.reservation.monOffTime"].split("|");
            const all_dp = await this.getObjectListAsync({
                startkey: `${this.namespace}.${device.deviceId}.remote.reservationCtrl.`,
                endkey: `${this.namespace}.${device.deviceId}.remote.reservationCtrl.\u9999`,
            });
            this.log.debug(`on_data - ${on_data.length}`);
            this.log.debug(`on_data - ${on_data}`);
            this.log.debug(`off_data - ${off_data.length}`);
            this.log.debug(`off_data - ${off_data}`);
            const length_data = on_data.toString() === "0" ? 3 : (on_data.length * 3) + 3;
            this.log.debug(`Length row - ${all_dp.rows.length}`);
            this.log.debug(`Length data - ${length_data}`);
            if (all_dp && all_dp.rows && on_data != null && all_dp.rows.length > length_data) {
                let del_row = (all_dp.rows.length - length_data) / 3;
                const start_point = (all_dp.rows.length - 3) / 3;
                this.log.debug(`Delete row - ${del_row}`);
                this.log.debug(`Start point - ${start_point}`);
                for (let i = start_point; i > 0; i--) {
                    this.log.debug(`Delete row - ${del_row}`);
                    if (del_row > 0) {
                        const state = i.toString().length === 1 ? `0${i}` : i;
                        this.log.debug(`State - ${state}`);
                        await this.delObjectAsync(`${device.deviceId}.remote.reservationCtrl.${state}_start`, { recursive: true });
                        await this.delObjectAsync(`${device.deviceId}.remote.reservationCtrl.${state}_end`, { recursive: true });
                        await this.delObjectAsync(`${device.deviceId}.remote.reservationCtrl.${state}_state`, { recursive: true });
                    } else {
                        i = 0;
                    }
                    --del_row;
                }
            }
            if (on_data.length > 0 && on_data[0].length === 7) {
                for (const single of on_data) {
                    const count = single.substring(0, 2);
                    del_states.push(count);
                    await this.createHeatSchedule(device.deviceId, single, off_data[counter]);
                    ++counter;
                }
            }
        }
        let common = {};
        let native = {};
        common = {
            name: {
                "en": "Add schedule",
                "de": "Zeitplan hinzufügen",
                "ru": "Добавить расписание",
                "pt": "Adicionar agenda",
                "nl": "Add schedule",
                "fr": "Ajouter le calendrier",
                "it": "Aggiungi il calendario",
                "es": "Agregar calendario",
                "pl": "Harmonogram",
                "uk": "Додати графік",
                "zh-cn": "增 编"
            },
            type: "boolean",
            role: "button",
            write: true,
            read: true,
            def: false,
        };
        native = {
            data: counter,
        };
        await this.createDataPoint(`${device.deviceId}.remote.reservationCtrl.add_new_schedule`, common, "state", native);
        await this.setState(`${device.deviceId}.remote.reservationCtrl.add_new_schedule`, false, true);
        common = {
            name: {
                "en": "Delete schedule",
                "de": "Löschen des Zeitplans",
                "ru": "Удалить расписание",
                "pt": "Excluir agendamento",
                "nl": "Verwijder agenda",
                "fr": "Supprimer l ' horaire",
                "it": "Cancella il programma",
                "es": "Suprímase el calendario",
                "pl": "Opisywy",
                "uk": "Розклад",
                "zh-cn": "删除时间表"
            },
            type: "string",
            role: "state",
            write: true,
            read: true,
            def: "00",
            states: del_states,
        };
        await this.createDataPoint(`${device.deviceId}.remote.reservationCtrl.del_new_schedule`, common, "state", native);
        await this.setState(`${device.deviceId}.remote.reservationCtrl.del_new_schedule`, "00", true);
        await this.setObjectNotExistsAsync(
            device.deviceId + ".remote.reservationCtrl.send_new_schedule",
            {
                type: "state",
                common: {
                    name: {
                        "en": "Send schedule",
                        "de": "Terminplan versenden",
                        "ru": "Отправить расписание",
                        "pt": "Enviar agendamento",
                        "nl": "Stuur een schema",
                        "fr": "Calendrier d ' envoi",
                        "it": "Inviare il programma",
                        "es": "Enviar horario",
                        "pl": "Harmonogram",
                        "uk": "Розклад",
                        "zh-cn": "简表"
                    },
                    type: "boolean",
                    role: "button",
                    write: true,
                    read: true,
                    def: false,
                },
            }).catch((error) => {
            this.log.error(error);
        });
        await this.setState(device.deviceId + ".remote.reservationCtrl.send_new_schedule", false, true);
        this.log.debug("Snapshot: " + device.deviceId + ".remote.basicCtrl.schedule");
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
        await this.setObjectNotExistsAsync(device.deviceId + ".remote.sendJSONNoSync", {
            type: "state",
            common: {
                name: "sendJSONNoSync",
                type: "string",
                write: true,
                read: true,
                role: "json",
                desc: "sendJSON",
                def: "",
            },
            native: {},
        });
    },
    async addHeat(device) {
        const obj = await this.getObjectAsync(
            `${device}.remote.reservationCtrl.add_new_schedule`,
        );
        if (obj && obj.native && obj.native.data != null) {
            const count = obj.native.data + 1;
            const new_count = count.toString().length === 1 ? `0${count}` : count;
            this.createHeatSchedule(device, `${new_count}00000`, `${new_count}00000`);
            this.extendObject(`${device}.remote.reservationCtrl.add_new_schedule`, {"native": {"data": count}});
        }
        const obj_del = await this.getObjectAsync(
            `${device}.remote.reservationCtrl.del_new_schedule`,
        );
        if (obj_del && obj_del.common && obj_del.common.states) {
            const count = obj.native.data + 1;
            const new_count = count.toString().length === 1 ? `0${count}` : count;
            obj_del.common.states.push(new_count);
            this.extendObject(`${device}.remote.reservationCtrl.del_new_schedule`, {"common": {"states": obj_del.common.states}});

        }
    },
    async updateHeat(device) {
        const data = {
            "command": "Get",
            "ctrlKey": "reservationCtrl",
            "dataGetList": [
                "airState.reservation.monOnTime",
                "airState.reservation.monOffTime",
                "airState.reservation.tueOnTime",
                "airState.reservation.tueOffTime",
                "airState.reservation.wedOnTime",
                "airState.reservation.wedOffTime",
                "airState.reservation.thuOnTime",
                "airState.reservation.thuOffTime",
                "airState.reservation.friOnTime",
                "airState.reservation.friOffTime",
                "airState.reservation.satOnTime",
                "airState.reservation.satOffTime",
                "airState.reservation.sunOnTime",
                "airState.reservation.sunOffTime"
            ],
            "dataKey": null,
            "dataSetList": null,
            "dataValue": null
        };
        const response = await this.sendCommandToDevice(device, data);
        this.log.debug(`response update: ${JSON.stringify(response)}`);
        if (
            response &&
            response.result &&
            response.result.data &&
            response.result.data["airState.reservation.monOnTime"]
        ) {
            const on_data = response.result.data["airState.reservation.monOnTime"].split("|");
            const off_data = response.result.data["airState.reservation.monOffTime"].split("|");
            if (on_data && on_data.length > 0) {
                for (const single in on_data) {
                    this.log.debug(`Update: ${on_data[single]} - ${off_data[single]}`);
                    if (on_data.length > 0 && on_data[0].length === 7) {
                        await this.createHeatSchedule(device, on_data[single], off_data[single]);
                    }
                }
            }
        }
    },
    async check_reservationCtrl(id, deviceId, lastsplit, state) {
        if (!state) {
            this.log.info(`No value!!`);
            return;
        }
        if (
            id.indexOf("_end") !== -1 ||
            id.indexOf("_start") !== -1
        ){
            const times = state.toString().split(":");
            if (times.length != 2) {
                this.log.info(`Wrong time string - ${state}`);
                return;
            }
            if (
                (parseInt(times[0]) > 0 && parseInt(times[0]) < 24) &&
                (parseInt(times[1]) > 0 && parseInt(times[1]) < 60)
            ) {
                this.log.debug(`Time OK!`);
            } else {
                this.log.warn(`Wrong Time - ${state}`);
                this.setState(`${deviceId}.remote.reservationCtrl.${lastsplit}`, "00:00", true);
            }
        } else if (id.indexOf("_state") !== -1) {
            if (state.toString() == "0" || state.toString() == "1") {
                this.log.debug(`State OK!`);
            } else {
                this.log.warn(`Wrong state - ${state}`);
                this.setState(`${deviceId}.remote.reservationCtrl.${lastsplit}`, 0, true);
            }
        }
    },
    async delHeat(device, state) {
        const all_dp = await this.getObjectListAsync({
            startkey: `${this.namespace}.${device}.remote.reservationCtrl.`,
            endkey: `${this.namespace}.${device}.remote.reservationCtrl.\u9999`,
        });
        if (all_dp && all_dp.rows) {
            const next = parseInt(state) + 1;
            const new_next = next.toString().length === 1 ? `0${next}` : next;
            const find_id = `${this.namespace}.${device}.remote.reservationCtrl.${new_next}_end`;
            const isfind = all_dp.rows.find((mes) => mes.id === find_id);
            if (isfind != null) {
                this.log.debug(JSON.stringify(isfind));
                const del_row = (all_dp.rows.length / 3) - 3;
                const last_row = parseInt(state);
                for (let i = del_row; i > 0; i--) {
                    if (last_row === i) {
                        this.log.debug("last_row: " + last_row);
                        const del_last = state.toString().length === 1 ? `0${del_row}` : del_row;
                        await this.delObjectAsync(`${device}.remote.reservationCtrl.${del_last}_start`, { recursive: true });
                        await this.delObjectAsync(`${device}.remote.reservationCtrl.${del_last}_end`, { recursive: true });
                        await this.delObjectAsync(`${device}.remote.reservationCtrl.${del_last}_state`, { recursive: true });
                        i = 0;
                    } else {
                        const write = i - 1;
                        const write_dp = write.toString().length === 1 ? `0${write}` : write;
                        const read = i.toString().length === 1 ? `0${i}` : i;
                        const start_dp = await this.getStateAsync(`${device}.remote.reservationCtrl.${read}_start`);
                        this.setState(`${device}.remote.reservationCtrl.${write_dp}_start`, start_dp.val, true);
                        const end_dp = await this.getStateAsync(`${device}.remote.reservationCtrl.${read}_end`);
                        this.setState(`${device}.remote.reservationCtrl.${write_dp}_end`, end_dp.val, true);
                        const state_dp = await this.getStateAsync(`${device}.remote.reservationCtrl.${read}_state`);
                        this.setState(`${device}.remote.reservationCtrl.${write_dp}_state`, state_dp.val, true);
                    }
                }
                const obj = await this.getObjectAsync(
                    `${device}.remote.reservationCtrl.del_new_schedule`,
                );
                if (obj && obj.common && obj.common.states != null) {
                    this.extendObject(`${device}.remote.reservationCtrl.del_new_schedule`, {"common": {"states": obj.common.states.pop()}});
                }
                const obj_add = await this.getObjectAsync(
                    `${device}.remote.reservationCtrl.add_new_schedule`,
                );
                if (obj_add && obj_add.native && obj_add.native.data != null) {
                    const new_dp = obj_add.native.data - 1;
                    this.extendObject(`${device}.remote.reservationCtrl.add_new_schedule`, {"native": {"data": new_dp}});
                }
            } else {
                const state_del = state.toString().length === 1 ? `0${state}` : state;
                await this.delObjectAsync(`${device}.remote.reservationCtrl.${state_del}_start`, { recursive: true });
                await this.delObjectAsync(`${device}.remote.reservationCtrl.${state_del}_end`, { recursive: true });
                await this.delObjectAsync(`${device}.remote.reservationCtrl.${state_del}_state`, { recursive: true });
            }
        }
    },
    async sendHeat(device) {
        const all_dp = await this.getObjectListAsync({
            startkey: `${this.namespace}.${device}.remote.reservationCtrl.`,
            endkey: `${this.namespace}.${device}.remote.reservationCtrl.\u9999`,
        });
        if (all_dp && all_dp.rows) {
            let start = "";
            let end = "";
            let all_start = "";
            let all_end = "";
            let counter;
            for (const ids of all_dp.rows) {
                if (ids && ids.id) {
                    if (ids.id.indexOf("_end") !== -1) {
                        counter = ids.id.split(".").pop();
                        counter = counter.split("_");
                        start = "";
                        end = "";
                        const end_date = await this.getStateAsync(ids.id);
                        end = end_date.val.replace(/:/g, "");
                    }
                    if (ids.id.indexOf("_start") !== -1) {
                        const start_date = await this.getStateAsync(ids.id);
                        start = start_date.val.replace(/:/g, "");
                    }
                    if (ids.id.indexOf("_state") !== -1) {
                        const state = await this.getStateAsync(ids.id);
                        if (all_start == "") {
                            all_start = `${counter[0]}${state.val}${start}`;
                        } else {
                            all_start = `${all_start}|${counter[0]}${state.val}${start}`;
                        }
                        if (all_end == "") {
                            all_end = `${counter[0]}${state.val}${end}`;
                        } else {
                            all_end = `${all_end}|${counter[0]}${state.val}${end}`;
                        }
                    }
                }
            }
            if (all_end != "" && all_start != "") {
                const data = {
                    "command": "Set",
                    "ctrlKey": "reservationCtrl",
                    "dataGetList": null,
                    "dataKey": null,
                    "dataSetList": {
                        "airState.reservation.monOnTime": all_start,
                        "airState.reservation.monOffTime": all_end,
                        "airState.reservation.tueOnTime": all_start,
                        "airState.reservation.tueOffTime": all_end,
                        "airState.reservation.wedOnTime": all_start,
                        "airState.reservation.wedOffTime": all_end,
                        "airState.reservation.thuOnTime": all_start,
                        "airState.reservation.thuOffTime": all_end,
                        "airState.reservation.friOnTime": all_start,
                        "airState.reservation.friOffTime": all_end,
                        "airState.reservation.satOnTime": all_start,
                        "airState.reservation.satOffTime": all_end,
                        "airState.reservation.sunOnTime": all_start,
                        "airState.reservation.sunOffTime": all_end
                    },
                    "dataValue": null
                };
                const response = await this.sendCommandToDevice(device, data);
                if (
                    (response && response.resultCode && response.resultCode !== "0000") ||
                    (response && response.lgedmRoot && response.lgedmRoot.returnCd !== "0000")
                ) {
                    this.log.error("Command not succesful");
                    this.log.error(JSON.stringify(response));
                }
            }
        }
    },
    async createHeatSchedule(device, first, second) {
        const count = first.substring(0, 2);
        const active = first.substring(2, 3);
        const hour = first.substring(3, 5);
        const minute = first.substring(5, 7);
        const hour_off = second.substring(3, 5);
        const minute_off = second.substring(5, 7);
        let common = {};
        let native = {};
        common = {
            name: "status",
            type: "number",
            role: "value",
            write: true,
            read: true,
            def: 0,
            states: {
                0: "Off",
                1: "On"
            },
        };
        native = {
            data: first + "|" + second,
        };
        await this.createDataPoint(`${device}.remote.reservationCtrl.${count}_state`, common, "state", native);
        await this.setState(`${device}.remote.reservationCtrl.${count}_state`, parseInt(active), true);
        common = {
            name: {
                "en": "switch on",
                "de": "einschalten",
                "ru": "перейти на",
                "pt": "ligar",
                "nl": "switch on",
                "fr": "interrupteur",
                "it": "accensione",
                "es": "encendido",
                "pl": "przełącznik",
                "uk": "увійти",
                "zh-cn": "转换"
            },
            type: "string",
            role: "state",
            write: true,
            read: true,
            def: "00:00",
        };
        await this.createDataPoint(`${device}.remote.reservationCtrl.${count}_start`, common, "state", native);
        await this.setState(`${device}.remote.reservationCtrl.${count}_start`, hour + ":" + minute, true);
        common = {
            name: {
                "en": "switch off",
                "de": "ausschalten",
                "ru": "выключить",
                "pt": "desligar",
                "nl": "vertaling:",
                "fr": "arrêt",
                "it": "spegnimento",
                "es": "apagado",
                "pl": "złączać",
                "uk": "відключення",
                "zh-cn": "转换"
            },
            type: "string",
            role: "state",
            write: true,
            read: true,
            def: "00:00",
        };
        await this.createDataPoint(`${device}.remote.reservationCtrl.${count}_end`, common, "state", native);
        await this.setState(`${device}.remote.reservationCtrl.${count}_end`, hour_off + ":" + minute_off, true);
    }
};
