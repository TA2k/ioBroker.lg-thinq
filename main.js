"use strict";

/*
 * Created with @iobroker/create-adapter v1.34.1
 * Based on https://github.com/nVuln/homebridge-lg-thinq
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const axios = require("axios").default;
const crypto = require("crypto");
const uuid = require("uuid");
const qs = require("qs");
const { DateTime } = require("luxon");
const Json2iob = require("./lib/extractKeys");
const constants = require("./lib/constants");
const { URL } = require("url");
const helper = require("./lib/helper");
const air = require("./lib/air_conditioning"); // Device 401
const heat = require("./lib/heat_pump"); // Device 406
const awsIot = require("aws-iot-device-sdk").device;
const forge = require("node-forge");
const http = require("http");
const https = require("https");
const fs = require("fs");

class LgThinq extends utils.Adapter {
    /**
     * @param options Options
     */
    constructor(options) {
        super({
            ...options,
            name: "lg-thinq",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.requestClient = axios.create({
            timeout: 60000,
            httpAgent: new http.Agent({ keepAlive: true }),
            httpsAgent: new https.Agent({ keepAlive: true }),
            maxRedirects: 10,
            maxContentLength: 50 * 1000 * 1000,
        });
        this.updateInterval = null;
        this.qualityInterval = null;
        this.refreshTokenInterval = null;
        this.updateThinq1Interval = null;
        this.updateThinq1SingleInterval = null;
        this.updatethinq1Run = false;
        this.refreshTimeout = null;
        this.refreshCounter = {};
        this.session = {};
        this.modelInfos = {};
        this.auth = {};
        this.workIds = {};
        this.deviceControls = {};
        this.json2iob = new Json2iob(this);
        this.targetKeys = {};
        this.homes = null;
        this.createDataPoint = helper.createDataPoint;
        this.setDryerBlindStates = helper.setDryerBlindStates;
        this.createFridge = helper.createFridge;
        this.createInterval = helper.createInterval;
        this.createStatistic = helper.createStatistic;
        this.createremote = helper.createremote;
        this.lastDeviceCourse = helper.lastDeviceCourse;
        this.insertCourse = helper.insertCourse;
        this.setCourse = helper.setCourse;
        this.setFavoriteCourse = helper.setFavoriteCourse;
        this.checkdate = helper.checkdate;
        this.createWeather = helper.createWeather;
        this.sendStaticRequest = helper.sendStaticRequest;
        this.sendStaticRequestThinq1 = helper.sendStaticRequestThinq1;
        this.createCourse = helper.createCourse;
        this.refreshRemote = helper.refreshRemote;
        this.refrigerator = helper.refrigerator;
        this.getSummary = air.getSummary;
        this.createAirRemoteStates = air.createAirRemoteStates;
        this.createAirRemoteThinq1States = air.createAirRemoteThinq1States;
        this.sendCommandThinq1AC = air.sendCommandThinq1AC;
        this.updateHoliday = air.updateHoliday;
        this.checkHolidayDate = air.checkHolidayDate;
        this.createHeatRemoteStates = heat.createHeatRemoteStates;
        this.createHeatSchedule = heat.createHeatSchedule;
        this.addHeat = heat.addHeat;
        this.delHeat = heat.delHeat;
        this.sendHeat = heat.sendHeat;
        this.updateHeat = heat.updateHeat;
        this.check_reservationCtrl = heat.check_reservationCtrl;
        this.mqttdata = {};
        this.mqttC = null;
        this.lang = "de";
        this.deviceJson = {};
        this.courseJson = {};
        this.courseactual = {};
        this.coursetypes = {};
        this.coursedownload = {};
        this.remoteValue = {};
        this.mqtt_userID = "";
        this.isThinq2 = false;
        this.thinq1Counter = 0;
        this.isRestart = true;
        this.isFinished = false;
        this.jsessionId = null;
        this.client_id = null;
        this.svc = constants.SVC_CODE;
        this.lge = "LGE";
        this.app_agent = "";
        this.app_device = "";
        this.isAdapterUpdateFor406 = false;
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        this.app_agent = constants.APP_AGENT[Math.floor(Math.random() * constants.APP_AGENT.length)];
        this.app_device = constants.APP_DEVICE[Math.floor(Math.random() * constants.APP_DEVICE.length)];
        await this.setState("info.connection", false, true);
        await this.cleanOldVersion();
        if (this.config.interval < 0.5) {
            this.log.info("Set interval to minimum 0.5");
            this.config.interval = 0.5;
        }
        if (this.config.interval_thinq1 < 0 || this.config.interval_thinq1 > 1440) {
            this.log.info("Set thinq1 interval to 30 seconds");
            this.config.interval_thinq1 = 30;
        }
        this.refreshCounter["interval.active"] = null;
        this.refreshCounter["interval.inactive"] = null;
        this.refreshCounter["interval.inactive"] = null;
        this.refreshCounter["interval.status_devices"] = null;
        const data = await this.getForeignObjectAsync("system.config");
        if (data && data.common && data.common.language) {
            this.lang = data.common.language === this.lang ? this.lang : "en";
        }
        this.log.debug(this.lang);
        this.defaultHeaders = {
            "x-api-key": constants.API_KEY,
            "x-client-id": constants.API_CLIENT_ID,
            "x-thinq-app-ver": "3.5.1700",
            "x-thinq-app-type": "NUTS",
            "x-thinq-app-level": "PRD",
            "x-thinq-app-os": "ANDROID",
            "x-thinq-app-logintype": "LGE",
            "x-service-code": "SVC202",
            "x-country-code": this.config.country,
            "x-language-code": this.config.language,
            "x-service-phase": "OP",
            "x-origin": "app-native",
            "x-model-name": "samsung / SM-N950N",
            "x-os-version": "7.1.2",
            "x-app-version": "3.5.1721",
            "x-message-id": this.random_string(22),
        };

        this.gateway = await this.requestClient
            .get(constants.GATEWAY_URL, { headers: this.defaultHeaders })
            .then(res => res.data.result)
            .catch(error => {
                this.log.error(error);
            });
        this.log.debug(JSON.stringify(this.gateway));
        if (this.gateway) {
            this.lgeapi_url = `https://${this.gateway.countryCode.toLowerCase()}.lgeapi.com/`;

            //   this.session = await this.login(this.config.user, this.config.password).catch((error) => {
            //     this.log.error(error);
            //   });
            this.session = await this.loginNew();
            if (
                this.session != null &&
                this.session.access_token != null &&
                this.session.expires_in != null &&
                this.session.refresh_token != null
            ) {
                try {
                    if (!this.jsessionId) {
                        const jsessionId = await this.getJSessionId();
                        this.log.debug(`jsessionId: ${JSON.stringify(jsessionId)}`);
                        if (jsessionId && jsessionId.jsessionId) {
                            this.jsessionId = jsessionId.jsessionId;
                        }
                    }
                } catch (e) {
                    this.logError("debug", "Cannot load sessionID: ", e);
                }
                this.log.debug(JSON.stringify(this.session));
                this.log.info("Login successful");
                this.refreshTokenInterval = this.setInterval(
                    () => {
                        this.refreshNewToken();
                    },
                    (this.session.expires_in - 100) * 1000,
                );
                this.userNumber = await this.getUserNumber();
                const hash = crypto.createHash("sha256");
                const clientID = this.userNumber ? this.userNumber : constants.API_CLIENT_ID;
                this.mqtt_userID = hash.update(clientID + new Date().getTime()).digest("hex");
                this.defaultHeaders["x-user-no"] = this.userNumber;
                this.defaultHeaders["x-emp-token"] = this.session.access_token;
                let listDevices = await this.getListDevices();
                if (listDevices && listDevices === "TERMS") {
                    this.setState("info.connection", false, true);
                    const new_term = await this.terms();
                    if (new_term) {
                        listDevices = await this.getListDevices();
                    } else {
                        return;
                    }
                }
                if (listDevices && listDevices === "TERMS") {
                    this.setState("info.connection", false, true);
                    return;
                } else if (listDevices && listDevices === "BLOCKED") {
                    this.setState("info.connection", false, true);
                    return;
                }
                if (!listDevices) {
                    this.log.info("Cannot find device!");
                    return;
                }
                this.log.info(`Found: ${listDevices.length} devices`);
                let isThinq1 = false;
                const area = {};
                if (this.userNumber) {
                    const hash = crypto.createHash("sha256");
                    this.client_id = hash.update(this.userNumber + new Date().getTime()).digest("hex");
                }
                this.subscribeStates("*");
                for (const element of listDevices) {
                    this.log.info(`Create or update datapoints for ${element.deviceId}`);
                    this.modelInfos[element.deviceId] = await this.getDeviceModelInfo(element);
                    if (!this.modelInfos[element.deviceId]) {
                        this.log.error(`Missing Modelinfo for device - ${element.deviceId}. Restart adapter please!!!`);
                        continue;
                    } else if (this.modelInfos[element.deviceId] === "NOK") {
                        continue;
                    }
                    await this.setObjectNotExistsAsync(element.deviceId, {
                        type: "device",
                        common: {
                            name: element.alias,
                            role: "state",
                        },
                        native: {},
                    });
                    await this.setObjectNotExistsAsync(`${element.deviceId}.quality`, {
                        type: "state",
                        common: {
                            name: {
                                en: "Datapoint quality",
                                de: "Datenpunktqualität",
                                ru: "Качество Datapoint",
                                pt: "Qualidade de Datapoint",
                                nl: "Datapunt kwaliteit",
                                fr: "Qualité du Datapoint",
                                it: "Qualità dei dati",
                                es: "Calidad del punto de datos",
                                pl: "Jakości danych",
                                uk: "Якість даних",
                                "zh-cn": "数据点",
                            },
                            type: "string",
                            role: "json",
                            desc: "Datapoints Quality",
                            read: true,
                            write: false,
                            def: "",
                        },
                        native: {},
                    });
                    if (element.area != null) {
                        area[element.area] = element.deviceId;
                    }
                    await this.json2iob.parse(element.deviceId, element, {
                        forceIndex: true,
                        write: true,
                        preferedArrayName: null,
                        channelName: null,
                        autoCast: true,
                        checkvalue: false,
                        checkType: true,
                        firstload: true,
                    });
                    this.modelInfos[element.deviceId]["thinq2"] = element.platformType;
                    this.modelInfos[element.deviceId]["signature"] = false;
                    this.modelInfos[element.deviceId]["deviceState"] = element.deviceState;
                    this.modelInfos[element.deviceId]["deviceType"] = 0;
                    if (element.platformType && element.platformType === "thinq2") {
                        this.isThinq2 = true;
                        if (
                            element.deviceType &&
                            element.deviceType == 201 &&
                            element.snapshot &&
                            element.snapshot.washerDryer &&
                            element.snapshot.washerDryer.initialTimeHour == null
                        ) {
                            this.modelInfos[element.deviceId]["signature"] = true;
                            //LG Signature without reserveTimeHour, remainTimeHour and initialTimeHour
                        }
                    }
                    if (element.platformType && element.platformType === "thinq1") {
                        isThinq1 = true;
                        ++this.thinq1Counter;
                    }
                    if (element.deviceType != null) {
                        this.modelInfos[element.deviceId]["deviceType"] = element.deviceType;
                        //this.isThinq2 = true;
                    }
                    await this.pollMonitor(element);
                    //await this.sleep(2000);
                    this.log.info(`Update raw datapoints for ${element.deviceId}`);
                    await this.extractValues(element);
                }
                this.log.debug(JSON.stringify(listDevices));
                if (this.isThinq2) {
                    this.start_mqtt();
                }
                if (isThinq1 && this.config.interval_thinq1 > 0) {
                    await this.sleep(2000);
                    await this.createInterval();
                    this.setState("interval.interval", this.config.interval_thinq1, true);
                    this.setState("interval.active", 0, true);
                    this.setState("interval.active", 0, true);
                    this.setState("interval.last_update", 0, true);
                    this.setState("interval.status_devices", JSON.stringify({}), true);
                    this.startPollMonitor();
                }
                this.log.debug(`AREA: ${JSON.stringify(area)}`);
                this.createWeather(area);
                this.updateInterval = this.setInterval(
                    async () => {
                        await this.updateDevices();
                    },
                    this.config.interval * 60 * 1000,
                );
                this.qualityInterval = this.setInterval(
                    () => {
                        this.cleanupQuality();
                    },
                    60 * 60 * 24 * 1000,
                );
            } else {
                this.log.warn(`Missing Session Infos!`);
            }
        }
    }

    async maskingTimer() {
        if (typeof this.modelInfos === "object") {
            for (const model in this.modelInfos) {
                if (
                    this.modelInfos &&
                    this.modelInfos[model] &&
                    this.modelInfos[model]["deviceState"] === "E" &&
                    this.modelInfos[model]["thinq2"] === "thinq2" &&
                    this.modelInfos[model]["deviceType"] === 406
                ) {
                    const deviceState = {
                        command: "Set",
                        ctrlKey: "allEventEnable",
                        dataKey: "airState.mon.timeout",
                        dataValue: "70",
                    };
                    this.log.debug(`Set timeout for device ${model}`);
                    this.isAdapterUpdateFor406 = true;
                    this.sendCommandToDevice(model, deviceState, null, true);
                    await this.sleep(3000);
                    this.isAdapterUpdateFor406 = false;
                }
            }
        }
    }

    async getJSessionId() {
        const memberLoginUrl = `${this.gateway.thinq1Uri}/member/login`;
        const headers = {
            "x-thinq-application-key": "wideq",
            "x-thinq-security-key": "nuts_securitykey",
            Accept: "application/json",
            "x-thinq-token": this.session.access_token,
        };
        const data = {
            countryCode: this.gateway.countryCode,
            langCode: this.gateway.languageCode,
            loginType: "EMP",
            token: this.session.access_token,
        };
        return await this.requestClient
            .post(memberLoginUrl, { lgedmRoot: data }, { headers })
            .then(res => res.data.lgedmRoot)
            .then(data => data)
            .catch(error => {
                error.message && this.log.debug(`getJSessionId message: ${error.message}`);
                this.log.debug(`getJSessionId: ${error}`);
                return null;
            });
    }

    getSecondsConversionTime(s) {
        const num = typeof s !== "number" ? parseInt(s) : s;
        const result = { day: 0, hour: 0, min: 0 };
        result.day = num / 86400;
        result.hour = (num % 86400) / 3600;
        result.min = Math.ceil(((num % 86400) % 3600) / 60);
        return result;
    }

    getMinConversionTime(m) {
        return {
            day: Math.floor(parseInt(m) / (24 * 60)),
            hour:
                Math.floor(parseInt(m) / (24 * 60)) > 0
                    ? Math.floor(parseInt(m) / 60) - Math.floor(parseInt(m) / (24 * 60)) * 24
                    : Math.floor(parseInt(m) / 60),
            min: parseInt(m) - Math.floor(parseInt(m) / 60) * 60,
        };
    }

    // Original APP header request
    monitorHeader() {
        const headers = {
            "User-Agent": this.app_agent,
            "x-model-name": this.app_device,
            "x-thinq-app-ver": "5.0.1000",
            "x-thinq-app-type": "NUTS",
            "x-language-code": this.gateway.languageCode,
            "x-thinq-app-logintype": this.lge,
            "x-os-version": "16.7.2",
            "x-client-id": this.client_id,
            "x-thinq-app-level": "PRD",
            "x-app-version": "5.0.11861",
            "x-user-no": this.userNumber,
            Connection: "keep-alive",
            "x-service-code": this.svc,
            "Accept-Language": `${this.gateway.languageCode};q=1`,
            "x-message-id": uuid.v4(),
            "x-emp-token": this.session ? this.session.access_token : "",
            "x-origin": "app-native",
            Accept: "application/json",
            "Content-Type": "application/json;charset=UTF-8",
            "x-api-key": constants.API_KEY,
            "x-thinq-app-os": "IOS",
            "x-country-code": this.gateway.countryCode,
            "x-service-phase": "OP",
        };
        if (this.jsessionId) {
            headers["x-thinq-jsessionId"] = this.jsessionId;
        }
        this.log.debug(`HEADER: ${JSON.stringify(headers)}`);
        return headers;
    }

    // Original APP request
    async startSinglePollMonitor() {
        this.updateThinq1SingleInterval && this.clearInterval(this.updateThinq1SingleInterval);
        this.updateThinq1SingleInterval = null;
        this.updatethinq1Run = false;
        if (Object.keys(this.workIds).length < 1) {
            this.log.warn("Found no workID`s. Please restart adapter!");
            return;
        }
        this.updateThinq1SingleInterval = this.setInterval(async () => {
            this.log.debug(`Status ongoing: ${this.updatethinq1Run}`);
            if (this.updatethinq1Run) {
                this.log.debug("Update thinq1 ongoing!");
                return;
            }
            this.updatethinq1Run = true;
            this.log.debug("START MONITORING");
            this.log.debug(`WORKID: ${Object.keys(this.workIds).length}`);
            this.log.debug(`MODEL: ${Object.keys(this.modelInfos).length}`);
            this.log.debug(`Counter: ${this.thinq1Counter}`);
            this.log.debug(`workIds: ${JSON.stringify(this.workIds)}`);
            if (this.thinq1Counter != Object.keys(this.workIds).length) {
                for (const model in this.modelInfos) {
                    this.log.debug(`Check deviceID: ${JSON.stringify(model)}`);
                    const devID = {};
                    if (
                        this.modelInfos[model] &&
                        this.modelInfos[model]["thinq2"] === "thinq1" &&
                        !this.workIds[model]
                    ) {
                        devID.platformType = this.modelInfos[model]["thinq2"];
                        devID.deviceId = model;
                        await this.startMonitor(devID);
                        this.log.debug(`Start Monitoring for ${model}`);
                    }
                }
            }
            const device_status = {};
            let active = 0;
            for (const dev in this.workIds) {
                const data = {
                    platformType: "thinq1",
                    deviceId: dev,
                };
                if (this.workIds[dev] == null) {
                    this.log.debug(
                        `Restart DEV: ${dev} workid: ${this.workIds[dev]} thinq: ${this.modelInfos[dev]["thinq2"]}`,
                    );
                    device_status[dev] = "Error";
                    await this.startMonitor(data);
                    continue;
                } else {
                    this.log.debug(`DEV: ${dev} workid: ${this.workIds[dev]}`);
                    const result = await this.getMonResult([{ deviceId: dev, workId: this.workIds[dev] }]);
                    this.log.debug(`RESULTS: ${JSON.stringify(result)}`);
                    if (result == null || !result.workList) {
                        this.log.debug(`Result is undefined! Stop Monitoring!`);
                        device_status[dev] = "Result Error";
                        await this.stopMonitor(data);
                        continue;
                    }
                    const device = result.workList;
                    try {
                        if (
                            device &&
                            device.returnData &&
                            (device.returnCode === "0000" ||
                                device.returnCode === "0100" ||
                                device.returnCode === "0106")
                        ) {
                            let resultConverted;
                            let unit = new Uint8Array(1024);
                            unit = Buffer.from(device.returnData, "base64");
                            if (this.modelInfos[device.deviceId].Monitoring.type === "BINARY(BYTE)") {
                                resultConverted = this.decodeMonitorBinary(
                                    unit,
                                    this.modelInfos[device.deviceId].Monitoring.protocol,
                                );
                            }
                            if (this.modelInfos[device.deviceId].Monitoring.type === "JSON") {
                                try {
                                    // @ts-expect-error nothing
                                    resultConverted = JSON.parse(unit.toString("utf-8"));
                                } catch (e) {
                                    this.logError("debug", "Parse error! Stop Monitoring: ", e);
                                    device_status[dev] = "Parse error";
                                    await this.stopMonitor(data);
                                    continue;
                                }
                            }
                            this.log.debug(`resultConverted: ${JSON.stringify(resultConverted)}`);
                            if (this.modelInfos[device.deviceId].Info.productType === "REF") {
                                this.refreshRemote(resultConverted, true, device.deviceId);
                            }
                            await this.json2iob.parse(`${device.deviceId}.snapshot`, resultConverted, {
                                forceIndex: true,
                                write: true,
                                preferedArrayName: null,
                                channelName: null,
                                autoCast: true,
                                checkvalue: this.isFinished,
                                checkType: true,
                            });
                            if (device.returnCode === "0000") {
                                device_status[device.deviceId] = "OK";
                                ++active;
                            } else if (device.returnCode === "0100") {
                                device_status[device.deviceId] = "Fail - 0100";
                                this.log.debug(`Fail! Stop Monitoring!`);
                                await this.stopMonitor(data);
                                await this.startMonitor(data);
                            } else if (device.returnCode === "0106") {
                                device_status[device.deviceId] = "Fail - 0106";
                                this.log.debug(`Not connected device! Stop Monitoring!`);
                                await this.stopMonitor(data);
                                await this.startMonitor(data);
                            } else {
                                device_status[device.deviceId] = `Error - ${device.returnCode}`;
                                this.log.debug(`Unknown`);
                                await this.stopMonitor(data);
                                await this.startMonitor(data);
                            }
                        } else {
                            this.log.debug(`No data:${JSON.stringify(device)} ${device.deviceId}`);
                            device_status[device.deviceId] = `Error - ${device.returnCode}`;
                            await this.stopMonitor(data);
                            await this.startMonitor(data);
                        }
                    } catch (e) {
                        this.logError("debug", "CATCH RESULT: ", e);
                        if (e instanceof Error) {
                            this.log.debug(e.message);
                        }
                        this.log.debug(`CATCH RESULT: ${JSON.stringify(result)}`);
                    }
                }
            }
            this.log.debug(`active: ${active}`);
            this.setThinq1Interval(active, device_status);
            this.updatethinq1Run = false;
        }, this.config.interval_thinq1 * 1000);
    }

    async startPollMonitor() {
        this.updateThinq1Interval && this.clearInterval(this.updateThinq1Interval);
        this.updateThinq1Interval = null;
        this.updatethinq1Run = false;
        if (Object.keys(this.workIds).length < 1) {
            this.log.warn("Found no workID`s. Please restart adapter!");
            return;
        }
        this.updateThinq1Interval = this.setInterval(async () => {
            this.log.debug(`Status ongoing: ${this.updatethinq1Run}`);
            if (this.updatethinq1Run) {
                this.log.debug("Update thinq1 ongoing!");
                return;
            }
            this.updatethinq1Run = true;
            this.log.debug("START MONITORING");
            this.log.debug(`WORKID: ${Object.keys(this.workIds).length}`);
            this.log.debug(`MODEL: ${Object.keys(this.modelInfos).length}`);
            this.log.debug(`Counter: ${this.thinq1Counter}`);
            if (this.thinq1Counter != Object.keys(this.workIds).length) {
                for (const model in this.modelInfos) {
                    this.log.debug(`Check deviceID: ${JSON.stringify(model)}`);
                    const devID = {};
                    if (
                        this.modelInfos[model] &&
                        this.modelInfos[model]["thinq2"] === "thinq1" &&
                        !this.workIds[model]
                    ) {
                        devID.platformType = this.modelInfos[model]["thinq2"];
                        devID.deviceId = model;
                        await this.startMonitor(devID);
                        this.log.debug(`Start Monitoring for ${model}`);
                    }
                }
            }
            const all_workids = [];
            const device_status = {};
            let active = 0;
            for (const dev in this.workIds) {
                if (!this.modelInfos[dev] || !this.modelInfos[dev]["thinq2"]) {
                    this.log.warn(`Missing Modelinfos for ${dev}. Please restart this adapter!`);
                    continue;
                }
                if (this.workIds[dev] == null) {
                    const devID = {
                        platformType: this.modelInfos[dev]["thinq2"],
                        deviceId: dev,
                    };
                    this.log.debug(
                        `Restart DEV: ${dev} workid: ${this.workIds[dev]} thinq: ${this.modelInfos[dev]["thinq2"]}`,
                    );
                    device_status[dev] = "Error";
                    await this.startMonitor(devID);
                } else {
                    device_status[dev] = "Request";
                    this.log.debug(`DEV: ${dev} workid: ${this.workIds[dev]}`);
                    all_workids.push({ deviceId: dev, workId: this.workIds[dev] });
                }
            }
            if (all_workids.length === 0) {
                this.log.debug(`WorkID for request is empty!`);
                this.setThinq1Interval(0, device_status);
                this.updatethinq1Run = false;
                return;
            }
            const result = await this.getMonResult(all_workids);
            if (result == null || !result.workList) {
                this.log.debug(`Result is undefined`);
                this.setThinq1Interval(0, device_status);
                this.updatethinq1Run = false;
                return;
            }
            this.log.debug(`RESULTS: ${JSON.stringify(result)}`);
            let device_array = [];
            if (Object.keys(result.workList).length === 0) {
                this.updatethinq1Run = false;
                return;
            } else if (!Array.isArray(result.workList) && typeof result.workList === "object") {
                device_array.push(result.workList);
            } else if (Array.isArray(result.workList)) {
                device_array = result.workList;
            } else {
                this.log.debug(`WRONG WORKLIST: ${JSON.stringify(device_array)}`);
                this.updatethinq1Run = false;
                return;
            }
            this.log.debug(`device_array: ${JSON.stringify(device_array)}`);
            try {
                for (const device of device_array) {
                    this.log.debug(`device: ${JSON.stringify(device)}`);
                    const data = {
                        platformType: "thinq1",
                        deviceId: device.deviceId,
                    };
                    if (
                        device &&
                        device.returnData &&
                        (device.returnCode === "0000" || device.returnCode === "0100" || device.returnCode === "0106")
                    ) {
                        let resultConverted;
                        let unit = new Uint8Array(1024);
                        unit = Buffer.from(device.returnData, "base64");
                        if (this.modelInfos[device.deviceId].Monitoring.type === "BINARY(BYTE)") {
                            resultConverted = this.decodeMonitorBinary(
                                unit,
                                this.modelInfos[device.deviceId].Monitoring.protocol,
                            );
                        }
                        if (this.modelInfos[device.deviceId].Monitoring.type === "JSON") {
                            try {
                                // @ts-expect-error nothing
                                resultConverted = JSON.parse(unit.toString("utf-8"));
                            } catch (e) {
                                this.logError("debug", "Parse error! Stop Monitoring: ", e);
                                device_status[device.deviceId] = "Parse error";
                                await this.stopMonitor(data);
                                continue;
                            }
                        }
                        this.log.debug(`resultConverted: ${JSON.stringify(resultConverted)}`);
                        if (this.modelInfos[device.deviceId].Info.productType === "REF") {
                            this.refreshRemote(resultConverted, true, device.deviceId);
                        }
                        await this.json2iob.parse(`${device.deviceId}.snapshot`, resultConverted, {
                            forceIndex: true,
                            write: true,
                            preferedArrayName: null,
                            channelName: null,
                            autoCast: true,
                            checkvalue: this.isFinished,
                            checkType: true,
                        });
                        if (device.returnCode === "0000") {
                            device_status[device.deviceId] = "OK";
                            ++active;
                        } else if (device.returnCode === "0100") {
                            device_status[device.deviceId] = "Fail - 0100";
                            this.log.debug(`Fail! Stop Monitoring!`);
                            await this.stopMonitor(data);
                            await this.startMonitor(data);
                        } else if (device.returnCode === "0106") {
                            device_status[device.deviceId] = "Fail - 0106";
                            this.log.debug(`Not connected device! Stop Monitoring!`);
                            await this.stopMonitor(data);
                            await this.startMonitor(data);
                        } else {
                            device_status[device.deviceId] = `Error - ${device.returnCode}`;
                            this.log.debug(`Not connected device! Stop Monitoring!`);
                            await this.stopMonitor(data);
                            await this.startMonitor(data);
                        }
                    } else {
                        this.log.debug(`No data:${JSON.stringify(device)} ${device.deviceId}`);
                        device_status[device.deviceId] = `Error - ${device.returnCode}`;
                        await this.stopMonitor(data);
                        await this.startMonitor(data);
                    }
                }
            } catch (e) {
                this.logError("debug", "", e);
                this.log.debug(`CATCH WORKLIST: ${JSON.stringify(device_array)}`);
                this.log.debug(`CATCH WORKLIST RESULT: ${JSON.stringify(result)}`);
            }
            this.log.debug(`active: ${active}`);
            this.setThinq1Interval(active, device_status);
            this.updatethinq1Run = false;
        }, this.config.interval_thinq1 * 1000);
    }

    async getWeather() {
        const unit_value = await this.getStateAsync("weather.unit");
        const area_value = await this.getStateAsync("weather.device");
        if (!unit_value || unit_value.val == null || (unit_value.val != "C" && unit_value.val != "F")) {
            this.log.info(`Missing unit`);
            return;
        }
        if (!area_value || area_value.val == null) {
            this.log.info(`Missing area`);
            return;
        }
        const req = `service/application/weather/daily?area=${area_value.val}&unit=${unit_value.val}`;
        this.log.debug(req);
        const weather = await this.getDeviceEnergy(req);
        this.log.debug(JSON.stringify(weather));
        if (weather.temperature != null) {
            const temp = typeof weather.temperature === "string" ? weather.temperature : weather.temperature.toString();
            this.setState("weather.temperature", temp, true);
        }
        if (weather.humidity != null) {
            const humi = typeof weather.humidity === "string" ? weather.humidity : weather.humidity.toString();
            this.setState("weather.humidity", humi, true);
        }
    }

    setThinq1Interval(active, status) {
        this.setState("interval.last_update", Date.now(), true);
        if (this.refreshCounter["interval.status_devices"] != JSON.stringify(status)) {
            this.refreshCounter["interval.status_devices"] = JSON.stringify(status);
            this.setState("interval.status_devices", JSON.stringify(status), true);
        }
        if (this.refreshCounter["interval.active"] != active) {
            this.refreshCounter["interval.active"] = active;
            this.setState("interval.active", active, true);
        }
        const inactive = this.thinq1Counter - active;
        if (this.refreshCounter["interval.inactive"] != inactive) {
            this.refreshCounter["interval.inactive"] = inactive;
            this.setState("interval.inactive", inactive, true);
        }
    }

    monitorHeaders() {
        const monitorHeaders = {
            Accept: "application/json",
            "x-thinq-application-key": "wideq",
            "x-thinq-security-key": "nuts_securitykey",
        };
        if (this.session.access_token) {
            monitorHeaders["x-thinq-token"] = this.session.access_token;
        }
        if (this.jsessionId) {
            monitorHeaders["x-thinq-jsessionId"] = this.jsessionId;
        }
        return monitorHeaders;
    }

    async getMonResult(work_id) {
        const headers = this.monitorHeader();
        //const headers = this.monitorHeaders();
        return await this.requestClient
            .post(`${this.gateway.thinq1Uri}/` + `rti/rtiResult`, { lgedmRoot: { workList: work_id } }, { headers })
            .then(resp => resp.data.lgedmRoot)
            .then(data => data)
            .catch(error => {
                this.log.debug("getMonResult");
                this.log.debug(error);
                return null;
            });
    }

    async terms() {
        try {
            const showTermUrl =
                "common/showTerms?callback_url=lgaccount.lgsmartthinq:/updateTerms&country=VN&language=en-VN&division=ha:T20&terms_display_type=3&svc_list=SVC202";
            this.log.info("New term agreement is starting...");
            const showTermHtml = await this.requestClient
                .get(`${this.gateway.empSpxUri}/${showTermUrl}`, {
                    headers: {
                        "X-Login-Session": this.session.access_token,
                    },
                })
                .then(res => res.data)
                .catch(error => {
                    this.log.debug(`terms: ${error}`);
                    return false;
                });
            const headers = {
                Accept: "application/json",
                "X-Application-Key": constants.APPLICATION_KEY,
                "X-Client-App-Key": constants.CLIENT_ID,
                "X-Lge-Svccode": "SVC709",
                "X-Device-Type": "M01",
                "X-Device-Platform": "ADR",
                "X-Device-Language-Type": "IETF",
                "X-Device-Publish-Flag": "Y",
                "X-Device-Country": this.gateway.countryCode,
                "X-Device-Language": this.gateway.languageCode,
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                "X-Login-Session": this.session.access_token,
                "X-Signature": showTermHtml.match(/signature\s+:\s+"([^"]+)"/)[1],
                "X-Timestamp": showTermHtml.match(/tStamp\s+:\s+"([^"]+)"/)[1],
            };
            const accountTermUrl =
                "emp/v2.0/account/user/terms?opt_term_cond=001&term_data=SVC202&itg_terms_use_flag=Y&dummy_terms_use_flag=Y";
            const accountTerms = await this.requestClient
                .get(`${this.gateway.empTermsUri}/${accountTermUrl}`, { headers })
                .then(res => {
                    return res.data.account.terms;
                })
                .catch(error => {
                    this.log.debug(`terms: ${error}`);
                    return false;
                });
            const termInfoUrl =
                "emp/v2.0/info/terms?opt_term_cond=001&only_service_terms_flag=&itg_terms_use_flag=Y&term_data=SVC202";
            const infoTerms = await this.requestClient
                .get(`${this.gateway.empTermsUri}/${termInfoUrl}`, { headers })
                .then(res => {
                    return res.data.info.terms;
                })
                .catch(error => {
                    this.log.debug(`terms: ${error}`);
                    return false;
                });

            const newTermAgreeNeeded = infoTerms
                .filter(term => {
                    return accountTerms.indexOf(term.termsID) === -1;
                })
                .map(term => {
                    return [term.termsType, term.termsID, term.defaultLang].join(":");
                })
                .join(",");
            if (newTermAgreeNeeded) {
                const updateAccountTermUrl = "emp/v2.0/account/user/terms";
                await this.requestClient
                    .post(
                        `${this.gateway.empTermsUri}/${updateAccountTermUrl}`,
                        qs.stringify({ terms: newTermAgreeNeeded }),
                        {
                            headers,
                        },
                    )
                    .catch(error => {
                        this.log.debug(`terms: ${error}`);
                        return false;
                    });
                return true;
            }
            return false;
        } catch (e) {
            this.logError("debug", "terms: ", e);
            return false;
        }
    }

    async restartMqtt() {
        this.log.debug("Restart MQTT Connection");
        if (this.mqttC) {
            this.mqttC.end();
            this.mqttC = null;
        }
        this.isRestart = false;
        await this.sleep(2000);
        this.start_mqtt();
    }

    async updateDevices() {
        const listDevices = await this.getListDevices().catch(error => {
            this.log.error(error);
        });
        if (listDevices && listDevices === "TERMS") {
            this.setState("info.connection", false, true);
            this.terms();
            return;
        } else if (listDevices && listDevices === "BLOCKED") {
            this.setState("info.connection", false, true);
            return;
        }
        if (typeof listDevices == "object") {
            for (const element of listDevices) {
                this.log.debug(`UPDATE: ${JSON.stringify(element)}`);
                await this.json2iob.parse(element.deviceId, element, {
                    forceIndex: true,
                    write: true,
                    preferedArrayName: null,
                    channelName: null,
                    autoCast: true,
                    checkvalue: this.isFinished,
                    checkType: true,
                });
                if (Object.keys(this.workIds).length === 0 || this.config.interval_thinq1 === 0) {
                    await this.pollMonitor(element);
                }
                this.refreshRemote(element);
            }
            if (
                this.updateThinq1Interval == null &&
                Object.keys(this.workIds).length > 0 &&
                this.config.interval_thinq1 > 0
            ) {
                this.startPollMonitor();
            }
        }
        this.isFinished = true;
        this.log.debug(JSON.stringify(listDevices));
        this.updatethinq1Run = false;
    }

    async getDeviceEnergy(path) {
        const headers = this.defaultHeaders;
        const deviceUrl = this.resolveUrl(`${this.gateway.thinq2Uri}/`, path);
        return this.requestClient
            .get(deviceUrl, { headers })
            .then(res => res.data.result)
            .catch(error => {
                if (error.message && error.message === "Request failed with status code 400") {
                    return 400;
                }
                this.log.debug(`getDeviceEnergy: ${error}`);
                return 500;
            });
    }

    async ownRequestThinq1(data, deviceId) {
        this.log.debug(`ownRequestThinq1: ${data}`);
        const header = JSON.parse(JSON.stringify(this.defaultHeaders));
        header["x-client-id"] = this.mqtt_userID != null ? this.mqtt_userID : constants.API1_CLIENT_ID;
        header["x-message-id"] = this.random_string(22);
        let reqData = null;
        try {
            reqData = JSON.parse(data);
        } catch (e) {
            this.logError("warn", "Own Request error: ", e);
            return;
        }
        this.log.debug(`reqDatahinq1: ${JSON.stringify(reqData)}`);
        const axiosOption = {
            params: reqData.params,
            data: reqData.data,
        };
        this.log.debug(`axiosOptionhinq1: ${JSON.stringify(axiosOption)}`);
        if (axiosOption.params && axiosOption.params.lgedmRoot) {
            if (axiosOption.params.lgedmRoot.deviceId === null) {
                axiosOption.params.lgedmRoot.deviceId = deviceId;
            }
            if (axiosOption.params.lgedmRoot.workId === null) {
                axiosOption.params.lgedmRoot.workId = uuid.v4();
            }
        }
        if (axiosOption.data && axiosOption.data.lgedmRoot) {
            if (axiosOption.data.lgedmRoot.deviceId === null) {
                axiosOption.data.lgedmRoot.deviceId = deviceId;
            }
            if (axiosOption.data.lgedmRoot.workId === null) {
                axiosOption.data.lgedmRoot.workId = uuid.v4();
            }
        }
        this.log.debug(`Own request: ${JSON.stringify(axiosOption)}`);
        if (reqData && reqData.method) {
            const resp = await this.requestClient({
                method: reqData.method,
                url: reqData.url,
                baseURL: `${this.gateway.thinq1Uri}/`,
                headers: header,
                ...axiosOption,
            })
                .then(async res => {
                    if (res.data) {
                        this.log.debug(`DATA: ${JSON.stringify(res.data)}`);
                        return res.data;
                    }
                    this.log.debug(`STATUS: ${res.status}`);
                    this.log.debug(`TEXT: ${res.statusText}`);
                    this.log.debug(`HEADER: ${res.headers}`);
                    this.log.debug(`CONFIG: ${res.config}`);
                    return res;
                })
                .catch(error => {
                    if (error.response) {
                        this.log.debug(`DATA: ${error.response.data}`);
                        this.log.debug(`STATUS: ${error.response.status}`);
                        this.log.debug(`HEADER: ${error.response.headers}`);
                    } else if (error.request) {
                        this.log.info(`REQUEST: ${error.request}`);
                    } else {
                        this.log.info(`MESSAGE: ${error.message}`);
                    }
                    return error;
                });
            let unit;
            if (resp && resp.lgedmRoot && resp.lgedmRoot.returnData) {
                if (resp.lgedmRoot.format === "B64") {
                    unit = Buffer.from(resp.lgedmRoot.returnData, "base64").toString();
                    this.log.debug(`UNIT: ${unit}`);
                } else {
                    try {
                        unit = JSON.parse(resp.lgedmRoot.returnData.toString());
                    } catch (e) {
                        this.logError("warn", "Parse error: ", e);
                        return;
                    }
                }
                await this.setState(`${deviceId}.remote.Statistic.ownresponse`, {
                    val: unit,
                    ack: true,
                });
            } else {
                this.log.warn(`Own request failed: ${resp}`);
            }
        }
    }

    async getDeviceEnergyThinq1(path, device) {
        this.log.debug(`getDeviceEnergyThinq1: ${device}`);
        const headers = JSON.parse(JSON.stringify(this.defaultHeaders));
        headers["x-client-id"] = constants.API1_CLIENT_ID;
        const deviceUrl = this.resolveUrl(`${this.gateway.thinq1Uri}/`, path);
        this.log.debug(deviceUrl);
        return this.requestClient
            .get(deviceUrl, { headers })
            .then(res => res)
            .catch(error => {
                if (error.message && error.message === "Request failed with status code 400") {
                    return 400;
                }
                this.log.debug(`getDeviceEnergy: ${error}`);
                return 500;
            });
    }

    async loginNew() {
        const countryCode = this.gateway.countryCode.toLowerCase();
        const sessionCookie = await this.requestClient({
            method: "get",
            maxBodyLength: Infinity,
            url: `https://${countryCode}.lgemembers.com/lgacc/service/v1/signin`,
            headers: {
                accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "cache-control": "max-age=0",
                "user-agent":
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_8_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
                "accept-language": "de-DE,de;q=0.9",
            },
            params: {
                callback_url: "lgaccount.lgsmartthinq:/",
                client_id: constants.CLIENT_ID,
                close_type: "0",
                country: this.config.country,
                language: this.config.language,
                pre_login: "",
                redirect_url: "lgaccount.lgsmartthinq:/",
                state: "signin",
                svc_code: constants.SVC_CODE,
                svc_integrated: "Y",
                ui_mode: "light",
                webview_yn: "Y",
            },
        })
            .then(res => {
                res.data && this.log.debug(res.data);
                //return session cookie
                if (res.headers["set-cookie"] != null) {
                    return res.headers["set-cookie"][0].split(";")[0];
                }
                this.log.error(`Missing cookie`);
                return;
            })
            .catch(error => {
                this.log.error(error);
                error.response && this.log.error(error.response.data);
            });
        // @ts-expect-error nothing
        const hashedPassword = await this.requestClient({
            method: "post",
            url: `https://${countryCode}.lgemembers.com/lgacc/front/v1/signin/signInPre`,
            headers: {
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                accept: "*/*",
                "x-requested-with": "XMLHttpRequest",
                "accept-language": "de-DE,de;q=0.9",
                origin: `https://${this.gateway.countryCode.toLowerCase()}.lgemembers.com`,
                "user-agent":
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_8_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
                cookie: sessionCookie,
            },
            //hash sha512 from password
            data: { userAuth2: crypto.createHash("sha512").update(this.config.password).digest("hex") },
        })
            .then(res => {
                return res.data;
            })
            .catch(error => {
                this.log.error(error);
                error.response && this.log.error(error.response.data);
            });
        // @ts-expect-error nothing
        const accountInfo = await this.requestClient({
            method: "post",
            url: `https://${countryCode}.lgemembers.com/lgacc/front/v1/signin/signInAct`,
            headers: {
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                accept: "*/*",
                "x-requested-with": "XMLHttpRequest",
                "accept-language": "de-DE,de;q=0.9",
                origin: `https://${countryCode}.lgemembers.com`,
                "user-agent":
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_8_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
                cookie: sessionCookie,
            },
            data: {
                clientId: constants.CLIENT_ID,
                doneYn: "",
                ipadYn: "N",
                itgTermsUseFlag: "Y",
                itgUserType: "A",
                local_country: this.config.country,
                local_lang: this.config.language,
                skipYn: "N",
                svcCode: constants.SVC_CODE,
                svc_code: constants.SVC_CODE,
                userId: encodeURIComponent(this.plainTextToRSA(this.config.user)),
                userPw: hashedPassword,
            },
        })
            .then(res => {
                return res.data;
            })
            .catch(error => {
                this.log.error(error);
                error.response && this.log.error(error.response.data);
            });
        if (!accountInfo) {
            this.log.error("Login failed");
            return;
        }
        const loginUuid = uuid.v4();
        const additionalInfo = {
            uuid: loginUuid,
            user_id: accountInfo.account.userID,
            user_id_type: accountInfo.account.userIDType,
            svc_integrated: "Y", //queryMap.svc_integrated
        };
        // @ts-expect-error nothing
        const sessionCookieV2 = await this.requestClient({
            method: "post",
            url: `https://${countryCode}.lgemembers.com/lgacc/front/v1/signin/signInComplete`,
            headers: {
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                accept: "*/*",
                "x-requested-with": "XMLHttpRequest",
                "accept-language": "de-DE,de;q=0.9",
                origin: `https://${this.gateway.countryCode.toLowerCase()}.lgemembers.com`,
                "user-agent":
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_8_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
                cookie: sessionCookie,
            },

            data: {
                loginSessionID: accountInfo.account.loginSessionID,
                additionalInfo: encodeURIComponent(JSON.stringify(additionalInfo)),
                autoYn: "N",
                deviceId: this.random_string(32),
                ipadYn: "N",
                local_country: this.config.country,
                local_lang: this.config.language,
                serviceYn: "Y",
                svcCode: constants.SVC_CODE,
                svc_code: constants.SVC_CODE,
                uuid: loginUuid,
            },
        })
            .then(res => {
                if (res.data.code !== "SUCCESS") {
                    this.log.error(res.data);
                    return;
                }
                if (res.headers["set-cookie"] != null) {
                    return res.headers["set-cookie"][0].split(";")[0];
                }
                this.log.error(`Missing cookie`);
                return;
            })
            .catch(error => {
                this.log.error(error);
                error.response && this.log.error(error.response.data);
            });
        // @ts-expect-error nothing
        await this.requestClient({
            method: "post",
            url: `https://${countryCode}.lgemembers.com/lgacc/front/v1/signin/token`,
            headers: {
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                accept: "*/*",
                "x-requested-with": "XMLHttpRequest",
                "accept-language": "de-DE,de;q=0.9",
                origin: `https://${countryCode}.lgemembers.com`,
                "user-agent":
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_8_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
                cookie: sessionCookieV2,
            },

            data: {
                loginSessionID: accountInfo.account.loginSessionID,

                uuid: loginUuid,
            },
        })
            .then(res => {
                if (res.data !== "SUCCESS") {
                    this.log.error(res.data);
                    return;
                }
            })
            .catch(error => {
                this.log.error(error);
                error.response && this.log.error(error.response.data);
            });
        // @ts-expect-error nothing
        const codeResponse = await this.requestClient({
            method: "post",
            url: `https://${countryCode}.lgemembers.com/lgacc/front/v1/signin/oauth`,
            headers: {
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                accept: "*/*",
                "x-requested-with": "XMLHttpRequest",
                "accept-language": "de-DE,de;q=0.9",
                origin: `https://${countryCode}.lgemembers.com`,
                "user-agent":
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_8_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
                cookie: sessionCookieV2,
            },
            data: {
                loginSessionID: accountInfo.account.loginSessionID,
                accountType: "LGE",
                clientId: constants.CLIENT_ID,
                countryCode: this.config.country,
                local_country: this.config.country,
                local_lang: this.config.language,
                redirectUri: "lgaccount.lgsmartthinq:/",
                state: "signin",
                svc_code: constants.SVC_CODE,
                userName: this.config.user,
            },
        })
            .then(res => {
                if (!res.data.redirect_uri) {
                    this.log.error(JSON.stringify(res.data));
                    return;
                }
                return qs.parse(decodeURIComponent(res.data.redirect_uri).split("?")[1]);
            })
            .catch(error => {
                this.log.error(error);
                error.response && this.log.error(error.response.data);
            });
        const tokenUrl = `https://${countryCode}.lgeapi.com/oauth/1.0/oauth2/token`;
        const timestamp = DateTime.utc().toRFC2822();
        const data = {
            code: codeResponse ? codeResponse.code : "",
            grant_type: "authorization_code",
            redirect_uri: "lgaccount.lgsmartthinq:/",
        };
        const requestUrl = `/oauth/1.0/oauth2/token${qs.stringify(data, { addQueryPrefix: true })}`;
        const signature = this.signature(`${requestUrl}\n${timestamp}`, constants.OAUTH_SECRET_KEY);

        const headers = {
            "x-lge-app-os": "IOS",
            "x-lge-appkey": constants.CLIENT_ID,
            "x-lge-oauth-signature": signature,
            "x-lge-oauth-date": timestamp,
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        };
        this.log.debug(JSON.stringify(tokenUrl));
        this.log.debug(JSON.stringify(headers));
        this.log.debug(JSON.stringify(data));
        const resp = await this.requestClient
            .post(tokenUrl, qs.stringify(data), { headers })
            .then(resp => resp.data)
            .catch(error => {
                this.log.error(error);
                return;
            });
        this.log.debug(JSON.stringify(resp));
        this.log.debug(JSON.stringify(codeResponse));
        if (resp && resp.access_token) {
            this.setState("info.connection", true, true);
        }
        return resp;
    }

    plainTextToRSA(plainTxt) {
        const pubkey =
            "-----BEGIN PUBLIC KEY-----\r\n" +
            "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkb2bcfvV5Q2Ag0UI6Mj3\r\n" +
            "oDmS0b2I9RTIRFhIVqrO47FRKQaFQpjiKkgxMcbLqK+ACTORrt6eA6srX/HKGtN9\r\n" +
            "aJvM/8ZzqAe1tztli/yQtm6MezKExTtSAxYkawaV2s+pj7RkOes+BsJ0ahL/HC1x\r\n" +
            "divxU4M0DN7AKdOyQM3XJnAfIimb1yhI5VeQkSBLDeAY9OTjRdAn4N6aRXaIwtck\r\n" +
            "hQYDs7t120uhRvtRX8WVY+YiROCKTgK9PPcvaGgWublxLnSPFFb4BGYDan2Ro0DL\r\n" +
            "b0DD1It4vqePBDWZD9MByhRJ67mQGXOJ/u3EEbctHB7TZkejjWn5sArU6K1jP0LB\r\n" +
            "hwIDAQAB\r\n" +
            "-----END PUBLIC KEY-----";

        const pk = forge.pki.publicKeyFromPem(pubkey);
        const encrypted = pk.encrypt(`${plainTxt}`);
        //to base64
        const b64 = forge.util.encode64(encrypted);

        return b64.trim();
    }

    async login(username, password) {
        // get signature and timestamp in login form
        const loginForm = await this.requestClient.get(await this.getLoginUrl()).then(res => res.data);
        const headers = {
            Accept: "application/json",
            "X-Application-Key": constants.APPLICATION_KEY,
            "X-Client-App-Key": constants.CLIENT_ID,
            "X-Lge-Svccode": "SVC709",
            "X-Device-Type": "M01",
            "X-Device-Platform": "ADR",
            "X-Device-Language-Type": "IETF",
            "X-Device-Publish-Flag": "Y",
            "X-Device-Country": this.gateway.countryCode,
            "X-Device-Language": this.gateway.languageCode,
            "X-Signature": loginForm.match(/signature\s+:\s+"([^"]+)"/)[1],
            "X-Timestamp": loginForm.match(/tStamp\s+:\s+"([^"]+)"/)[1],
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        };

        const hash = crypto.createHash("sha512");
        const data = {
            user_auth2: hash.update(password).digest("hex"),
            itg_terms_use_flag: "Y",
            svc_list: "SVC202,SVC710", // SVC202=LG SmartHome, SVC710=EMP OAuth
        };

        // try login with username and hashed password
        const loginUrl = `${this.gateway.empTermsUri}/` + `emp/v2.0/account/session/${encodeURIComponent(username)}`;
        const res = await this.requestClient
            .post(loginUrl, qs.stringify(data), { headers })
            .then(res => res.data)
            .catch(err => {
                if (!err.response) {
                    this.log.error(err);
                    return;
                }
                this.log.error(JSON.stringify(err.response.data));
                const { code, message } = err.response.data.error;
                if (code === "MS.001.03") {
                    this.log.error(`Double-check your country in configuration - ${message}`);
                }
                return;
            });
        if (!res) {
            return;
        }
        // dynamic get secret key for emp signature
        const empSearchKeyUrl = `${this.gateway.empSpxUri}/` + `searchKey?key_name=OAUTH_SECRETKEY&sever_type=OP`;
        const secretKey = await this.requestClient
            .get(empSearchKeyUrl)
            .then(res => res.data)
            .then(data => data.returnData);

        const timestamp = DateTime.utc().toRFC2822();
        const empData = {
            account_type: res.account.userIDType,
            client_id: constants.CLIENT_ID,
            country_code: res.account.country,
            username: res.account.userID,
        };
        const empUrl = `/emp/oauth2/token/empsession${qs.stringify(empData, { addQueryPrefix: true })}`;
        const signature = this.signature(`${empUrl}\n${timestamp}`, secretKey);
        const empHeaders = {
            "lgemp-x-app-key": constants.OAUTH_CLIENT_KEY,
            "lgemp-x-date": timestamp,
            "lgemp-x-session-key": res.account.loginSessionID,
            "lgemp-x-signature": signature,
            Accept: "application/json",
            "X-Device-Type": "M01",
            "X-Device-Platform": "ADR",
            "Content-Type": "application/x-www-form-urlencoded",
            "Access-Control-Allow-Origin": "*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "en-US,en;q=0.9",
        };
        // create emp session and get access token
        const token = await this.requestClient
            .post("https://emp-oauth.lgecloud.com/emp/oauth2/token/empsession", qs.stringify(empData), {
                headers: empHeaders,
            })
            .then(res => res.data)
            .catch(err => {
                this.log.error(err.response.data.error.message);
                return;
            });
        if (token.status !== 1) {
            this.log.error(token.message);
            return;
        }

        this.lgeapi_url = token.oauth2_backend_url || this.lgeapi_url;
        if (token && token.access_token) {
            this.setState("info.connection", true, true);
        }
        return token;
    }

    async pollMonitor(device) {
        if (device.platformType === "thinq1") {
            this.log.debug("start polling");
            let result = new Uint8Array(1024);
            try {
                if (!this.workIds || !this.workIds[device.deviceId]) {
                    this.log.debug(`${device.deviceId} is connecting`);
                    await this.startMonitor(device);
                    await this.sleep(5000);
                }
                result = await this.getMonitorResult(device.deviceId, this.workIds[device.deviceId]);
                this.log.debug(`resultMonitor: ${JSON.stringify(result)}`);
                if (result && typeof result === "object") {
                    let resultConverted;
                    if (this.modelInfos[device.deviceId].Monitoring.type === "BINARY(BYTE)") {
                        this.log.debug(`result: ${JSON.stringify(result)}`);
                        resultConverted = this.decodeMonitorBinary(
                            result,
                            this.modelInfos[device.deviceId].Monitoring.protocol,
                        );
                    }
                    if (this.modelInfos[device.deviceId].Monitoring.type === "JSON") {
                        // @ts-expect-error nothing
                        resultConverted = JSON.parse(result.toString("utf-8"));
                    }
                    this.log.debug(`resultConverted: ${JSON.stringify(resultConverted)}`);
                    if (this.modelInfos[device.deviceId].Info.productType === "REF") {
                        this.refreshRemote(resultConverted, true, device.deviceId);
                    }
                    await this.json2iob.parse(`${device.deviceId}.snapshot`, resultConverted, {
                        forceIndex: true,
                        write: true,
                        preferedArrayName: null,
                        channelName: null,
                        autoCast: true,
                        checkvalue: this.isFinished,
                        checkType: true,
                    });
                    return resultConverted;
                }
                this.log.debug(`No data:${JSON.stringify(result)} ${device.deviceId}`);

                await this.stopMonitor(device);
            } catch (error) {
                this.logError("debug", "pollMonitor: ", error);
            }
        }
    }
    async startMonitor(device) {
        try {
            if (device.platformType === "thinq1") {
                const sendId = uuid.v4();
                const returnWorkId = await this.sendMonitorCommand(device.deviceId, "Start", sendId).then(
                    data => data.workId,
                );
                this.workIds[device.deviceId] = returnWorkId;
                return true;
            }
            return false;
        } catch (error) {
            this.logError("debug", "startMonitor: ", error);
            return false;
        }
    }

    async stopMonitor(device) {
        if (device.platformType === "thinq1" && device.deviceId in this.workIds) {
            try {
                await this.sendMonitorCommand(device.deviceId, "Stop", this.workIds[device.deviceId]);
                delete this.workIds[device.deviceId];
                this.log.debug(`Stop monitoring for device ${device.deviceId}`);
                return true;
            } catch (error) {
                this.logError("debug", "stopMonitor: ", error);
                return false;
            }
        }
    }
    decodeMonitorBinary(data, protocol) {
        const decoded = {};

        for (const item of protocol) {
            const key = item.value;
            let value = 0;

            for (let i = item.startByte; i < item.startByte + item.length; i++) {
                const v = data[i];
                value = (value << 8) + v;
                decoded[key] = String(value);
            }
        }

        return decoded;
    }
    async refreshNewToken() {
        this.log.debug("refreshToken");
        const tokenUrl = `${this.lgeapi_url}oauth/1.0/oauth2/token`;
        if (!this.session || !this.session.refresh_token) {
            await this.setState("info.connection", false, true);
            this.updateInterval && this.clearInterval(this.updateInterval);
            this.qualityInterval && this.clearInterval(this.qualityInterval);
            this.refreshTokenInterval && this.clearInterval(this.refreshTokenInterval);
            this.refreshTimeout && this.clearTimeout(this.refreshTimeout);
            this.sleepTimer && this.clearTimeout(this.sleepTimer);
            this.updateThinq1Interval && this.clearInterval(this.updateThinq1Interval);
            this.updateThinq1SingleInterval && this.clearInterval(this.updateThinq1SingleInterval);
            this.log.warn(`Missing refreshtoken. Please restart this adapter!!`);
            return;
        }
        const data = {
            grant_type: "refresh_token",
            refresh_token: this.session.refresh_token,
        };

        const timestamp = DateTime.utc().toRFC2822();

        const requestUrl = `/oauth/1.0/oauth2/token${qs.stringify(data, { addQueryPrefix: true })}`;
        const signature = this.signature(`${requestUrl}\n${timestamp}`, constants.OAUTH_SECRET_KEY);

        const headers = {
            "x-lge-app-os": "ADR",
            "x-lge-appkey": constants.CLIENT_ID,
            "x-lge-oauth-signature": signature,
            "x-lge-oauth-date": timestamp,
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        };
        this.log.debug(JSON.stringify(tokenUrl));
        this.log.debug(JSON.stringify(headers));
        this.log.debug(JSON.stringify(data));
        const resp = await this.requestClient
            .post(tokenUrl, qs.stringify(data), { headers })
            .then(resp => resp.data)
            .catch(error => {
                this.log.error(error);
                return;
            });
        this.log.debug(JSON.stringify(resp));
        if (!resp || !resp.access_token) {
            this.log.warn("refresh token failed, start relogin");
            this.session = await this.loginNew();
            //   this.session = await this.login(this.config.user, this.config.password).catch((error) => {
            //     this.log.error(error);
            //   });
        }
        if (this.session && resp && resp.access_token) {
            this.session.access_token = resp.access_token;
            try {
                const jsessionId = await this.getJSessionId();
                this.log.debug(JSON.stringify(this.jsessionId));
                if (jsessionId && jsessionId.jsessionId) {
                    this.jsessionId = jsessionId.jsessionId;
                }
            } catch (e) {
                this.logError("debug", "Cannot load sessionID: ", e);
            }
            // @ts-expect-error nothing
            this.defaultHeaders["x-emp-token"] = this.session.access_token;
            if (this.isThinq2) {
                this.restartMqtt();
            }
            this.refreshTokenInterval && this.clearInterval(this.refreshTokenInterval);
            this.refreshTokenInterval = null;
            this.refreshTokenInterval = this.setInterval(
                () => {
                    this.refreshNewToken();
                },
                (this.session.expires_in - 100) * 1000,
            );
        }
    }

    async getUserNumber() {
        const profileUrl = `${this.lgeapi_url}users/profile`;
        const timestamp = DateTime.utc().toRFC2822();
        const signature = this.signature(`/users/profile\n${timestamp}`, constants.OAUTH_SECRET_KEY);

        const headers = {
            Accept: "application/json",
            Authorization: `Bearer ${this.session.access_token}`,
            "X-Lge-Svccode": "SVC202",
            "X-Application-Key": constants.APPLICATION_KEY,
            "lgemp-x-app-key": constants.CLIENT_ID,
            "X-Device-Type": "M01",
            "X-Device-Platform": "ADR",
            "x-lge-oauth-date": timestamp,
            "x-lge-oauth-signature": signature,
        };

        const resp = await this.requestClient
            .get(profileUrl, { headers })
            .then(resp => resp.data)
            .catch(error => {
                this.log.error(error);
            });
        if (!resp) {
            return;
        }
        if (resp && resp.account && resp.account.serviceList) {
            const svc = resp.account.serviceList.find(val => val.svcName === "LG ThinQ");
            if (svc && svc.svcCode) {
                this.svc = svc.svcCode;
                this.log.debug(`SVC: ${svc.svcCode}`);
            }
        }
        if (resp && resp.account && resp.account.userIDType) {
            this.lge = resp.account.userIDType;
            this.log.debug(`LGE: ${this.lge}`);
        }
        await this.json2iob.parse("general", resp, {
            forceIndex: true,
            preferedArrayName: null,
            channelName: null,
            autoCast: true,
            checkvalue: false,
            checkType: true,
            firstload: true,
        });
        this.log.debug(JSON.stringify(resp));
        if (!resp.account) {
            this.log.error("No account found");
            this.log.error(JSON.stringify(resp));
            return;
        }
        return resp.account.userNo;
    }

    async getLoginUrl() {
        const params = {
            country: this.gateway.countryCode,
            language: this.gateway.languageCode,
            client_id: constants.CLIENT_ID,
            svc_list: constants.SVC_CODE,
            svc_integrated: "Y",
            redirect_uri: `${this.gateway.empSpxUri}/` + `login/iabClose`,
            show_thirdparty_login: "LGE,MYLG",
            division: "ha:T20",
            callback_url: `${this.gateway.empSpxUri}/` + `login/iabClose`,
        };

        return `${this.gateway.empSpxUri}/` + `login/signIn${qs.stringify(params, { addQueryPrefix: true })}`;
    }

    async sendMonitorCommand(deviceId, cmdOpt, workId) {
        const headers = JSON.parse(JSON.stringify(this.defaultHeaders));
        headers["x-client-id"] = constants.API1_CLIENT_ID;
        const data = {
            cmd: "Mon",
            cmdOpt,
            deviceId,
            workId,
        };
        return await this.requestClient
            .post(`${this.gateway.thinq1Uri}/` + `rti/rtiMon`, { lgedmRoot: data }, { headers })
            .then(res => res.data.lgedmRoot)
            .then(data => {
                if ("returnCd" in data) {
                    const code = data.returnCd;
                    if (code === "0106") {
                        this.log.debug(data.returnMsg || "");
                    } else if (code !== "0000") {
                        this.log.debug(`${code} - ${data.returnMsg}`);
                    }
                }
                this.log.debug(`sendMonitorCommand: ${JSON.stringify(data)}`);
                return data;
            })
            .catch(error => {
                this.log.error("SendMonitorCommand");
                this.log.error(error);
            });
    }

    async getMonitorResult(device_id, work_id) {
        const headers = JSON.parse(JSON.stringify(this.defaultHeaders));
        headers["x-client-id"] = constants.API1_CLIENT_ID;
        const workList = [{ deviceId: device_id, workId: work_id }];
        return await this.requestClient
            .post(`${this.gateway.thinq1Uri}/rti/rtiResult`, { lgedmRoot: { workList } }, { headers })
            .then(resp => resp.data.lgedmRoot)
            .then(data => {
                if ("returnCd" in data) {
                    const code = data.returnCd;
                    if (code === "0106") {
                        return code;
                    } else if (code !== "0000") {
                        this.log.debug(`${code} - ${data.returnMsg}`);
                        return code;
                    }
                }
                this.log.debug(JSON.stringify(data));
                const workList = data.workList;
                if (!workList || workList.returnCode !== "0000") {
                    this.log.debug(JSON.stringify(data));
                    return null;
                }

                if (!("returnData" in workList)) {
                    return null;
                }
                this.log.debug(`worklist: ${JSON.stringify(workList)}`);
                return Buffer.from(workList.returnData, "base64");
            })
            .catch(error => {
                this.log.error("GetMonitorResult");
                this.log.error(error);
            });
    }

    signature(message, secret) {
        return crypto.createHmac("sha1", Buffer.from(secret)).update(message).digest("base64");
    }
    random_string(length) {
        const result = [];
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
            result.push(characters.charAt(Math.floor(Math.random() * charactersLength)));
        }
        return result.join("");
    }
    resolveUrl(from, to, home) {
        if (home) {
            const url = new URL(from);
            return url.hostname;
        }
        const url = new URL(to, from);
        return url.href;
    }
    async getDeviceInfo(deviceId) {
        const headers = this.defaultHeaders;
        const deviceUrl = this.resolveUrl(`${this.gateway.thinq2Uri}/`, `service/devices/${deviceId}`);

        return this.requestClient
            .get(deviceUrl, { headers })
            .then(res => res.data.result)
            .catch(error => {
                this.log.error("GetDevicenfo");
                this.log.error(error);
            });
    }

    async getListDevices() {
        if (!this.homes) {
            const home_result = await this.getListHomes();
            if (
                home_result &&
                home_result.resultCode &&
                home_result.resultCode === "0000" &&
                home_result.result &&
                home_result.result.item == null
            ) {
                this.log.warn("LG does not provide any data! Maybe your account is blocked");
                return "BLOCKED";
            } else if (home_result && home_result.resultCode && home_result.resultCode === "0110") {
                this.log.error("Could not receive homes. Please check your app and accept new agreements");
                return "TERMS";
            } else if (!home_result || !home_result.result || !home_result.result.item) {
                return "BLOCKED";
            }
            if (!home_result || !home_result.result || !home_result.result.item) {
                this.log.error("Could not receive homes");
                return;
            }
            this.log.debug(`Home Items: ${JSON.stringify(home_result)}`);
            this.homes = home_result.result.item;
            this.json2iob.parse("homes", this.homes, {
                forceIndex: true,
                write: true,
                preferedArrayName: null,
                channelName: null,
                autoCast: true,
                checkvalue: false,
                checkType: true,
                firstload: true,
            });
        }
        const headers = this.defaultHeaders;
        const devices = [];
        if (!this.homes) {
            this.log.error("No homes found");
            return [];
        }
        // get all devices in home
        for (let i = 0; i < this.homes.length; i++) {
            const homeUrl = this.resolveUrl(`${this.gateway.thinq2Uri}/`, `service/homes/${this.homes[i].homeId}`);
            const resp = await this.requestClient
                .get(homeUrl, { headers })
                .then(res => res.data)
                .catch(error => {
                    this.log.error("Failed to get home");
                    this.log.error(error);
                    if (error.response && error.response.data) {
                        this.log.error(JSON.stringify(error.response.data));
                    }
                    if (error.response && error.response.status === 400) {
                        this.log.info("Try to refresh Token");
                        this.refreshNewToken();
                    }
                    return;
                });

            this.log.debug(JSON.stringify(resp));
            if (resp) {
                this.log.debug(JSON.stringify(resp));
                devices.push(...resp.result.devices);
            }
        }

        return devices;
    }

    async getListHomes() {
        if (!this._homes) {
            const headers = this.defaultHeaders;
            const homesUrl = this.resolveUrl(`${this.gateway.thinq2Uri}/`, "service/homes");
            this._homes = await this.requestClient
                .get(homesUrl, { headers })
                .then(res => res.data)
                .then(data => {
                    this.log.debug(JSON.stringify(data));
                    return data;
                })
                .catch(error => {
                    this.log.error(error);
                    if (error.response) {
                        this.log.error(JSON.stringify(error.response.data));
                        return error.response.data;
                    }
                });
        }

        return this._homes;
    }

    async getDeviceModelInfo(device) {
        let uris = {};
        try {
            if (fs.existsSync(`${this.adapterDir}/lib/modelJsonUri`)) {
                const data_uris = fs.readFileSync(`${this.adapterDir}/lib/modelJsonUri`, "utf-8");
                uris = JSON.parse(data_uris);
            } else {
                uris["data"] = {};
            }
        } catch (error) {
            this.logError("debug", "", error);
            uris["data"] = {};
        }
        if (!device.modelJsonUri) {
            this.log.error(`Missing Modelinfo for device - ${device.deviceId}. Create a new issue on github please!!!`);
            return "NOK";
        }
        this.log.debug("Get Device Model Info");
        this.log.debug(JSON.stringify(device));
        let stopp = false;
        let deviceModel = await this.requestClient
            .get(device.modelJsonUri)
            .then(res => res.data)
            .catch(error => {
                this.log.error(error);
                return;
            });
        if (!deviceModel) {
            if (uris.data[device.modelJsonUri]) {
                this.log.info(`Use local modelJsonUri for device ${device.deviceId}`);
                deviceModel = uris.data[device.modelJsonUri];
            }
        }
        if (deviceModel) {
            if (!uris.data[device.modelJsonUri]) {
                uris.data[device.modelJsonUri] = deviceModel;
                fs.writeFile(`${this.adapterDir}/lib/modelJsonUri`, JSON.stringify(uris), err => {
                    if (err) {
                        this.log.info(`Write file error: ${err}`);
                    } else {
                        this.log.info(`File written successfully`);
                    }
                });
            }
            await this.setObjectNotExistsAsync(`${device.deviceId}.remote`, {
                type: "channel",
                common: {
                    name: "remote control device",
                    role: "state",
                },
                native: {},
            });
            this.coursetypes[device.deviceId] = {};
            if (deviceModel["Config"]) {
                this.coursetypes[device.deviceId]["smartCourseType"] = deviceModel.Config.smartCourseType
                    ? deviceModel.Config.smartCourseType
                    : "";
                this.coursetypes[device.deviceId]["courseType"] = deviceModel.Config.courseType
                    ? deviceModel.Config.courseType
                    : "";
                this.coursetypes[device.deviceId]["downloadedCourseType"] = deviceModel.Config.downloadedCourseType
                    ? deviceModel.Config.downloadedCourseType
                    : "courseType";
            }
            if (device.deviceType === 406) {
                if (deviceModel["ControlWifi"] && deviceModel["ControlWifi"].type) {
                    this.log.debug(`deviceModel.type: ${deviceModel["ControlWifi"].type}`);
                } else {
                    this.log.debug("deviceModel.type not found");
                }
                if (device.platformType == "thinq2") {
                    await this.createHeatRemoteStates(device, deviceModel);
                    await this.createStatistic(device.deviceId, 406);
                    const dataKeys = deviceModel["ControlDevice"];
                    if (deviceModel && dataKeys[0] && dataKeys[0].dataKey) {
                        try {
                            const arr_dataKey = dataKeys[0].dataKey.split("|").pop();
                            deviceModel["folder"] = arr_dataKey.split(".")[0];
                        } catch (error) {
                            this.logError("info", "Cannot find the snapshot folder: ", error);
                        }
                    }
                    stopp = true;
                } else {
                    this.log.warn(`DeviceType 406 with platformType ${device.platformType} is not supported yet`);
                    this.log.info(JSON.stringify(device));
                }
            }
            if (device.deviceType === 401) {
                if (deviceModel["ControlWifi"] && deviceModel["ControlWifi"].type) {
                    this.log.debug(`deviceModel.type: ${deviceModel["ControlWifi"].type}`);
                } else {
                    this.log.debug("deviceModel.type not found");
                }
                if (device.platformType == "thinq2") {
                    await this.createAirRemoteStates(device, deviceModel);
                    await this.createStatistic(device, 401);
                    const dataKeys = deviceModel["ControlDevice"];
                    if (deviceModel && dataKeys[0] && dataKeys[0].dataKey) {
                        try {
                            const arr_dataKey = dataKeys[0].dataKey.split("|").pop();
                            deviceModel["folder"] = arr_dataKey.split(".")[0];
                        } catch (error) {
                            this.logError("info", "Cannot find the snapshot folder: ", error);
                        }
                    }
                    stopp = true;
                } else if (
                    device.platformType == "thinq1" &&
                    deviceModel["ControlWifi"] &&
                    deviceModel["ControlWifi"].type === "JSON"
                ) {
                    this.log.debug("Found device 401 thinq1.");
                    await this.createAirRemoteThinq1States(device, deviceModel, constants);
                    await this.createStatistic(device, 401);
                    stopp = true;
                } else {
                    this.log.warn(`DeviceType 401 with platformType ${device.platformType} is not supported yet`);
                    this.log.info(JSON.stringify(device));
                }
            }
            if (deviceModel["ControlWifi"]) {
                this.log.debug(JSON.stringify(deviceModel["ControlWifi"]));
                let controlWifi = deviceModel["ControlWifi"];
                try {
                    deviceModel["folder"] = "";
                    if (Object.keys(deviceModel["ControlWifi"])[0] != null) {
                        const wifi = Object.keys(deviceModel["ControlWifi"])[0];
                        if (
                            deviceModel["ControlWifi"][wifi] &&
                            deviceModel["ControlWifi"][wifi]["data"] &&
                            Object.keys(deviceModel["ControlWifi"][wifi]["data"])[0] != null
                        ) {
                            deviceModel["folder"] = Object.keys(deviceModel["ControlWifi"][wifi]["data"])[0];
                        }
                    }
                } catch (error) {
                    this.logError("error", "Cannot find the folder: ", error);
                }
                if (deviceModel["ControlWifi"].action) {
                    controlWifi = deviceModel["ControlWifi"].action;
                }
                this.deviceControls[device.deviceId] = controlWifi;
                this.deviceJson[device.deviceId] = deviceModel;
                await this.setObjectNotExistsAsync(`${device.deviceId}.remote`, {
                    type: "channel",
                    common: {
                        name: "remote control device",
                        desc: "Create by LG-Thinq Adapter",
                    },
                    native: {},
                });
                if (deviceModel["Info"] && deviceModel["Info"].productType === "REF") {
                    await this.createFridge(device, deviceModel);
                    await this.createStatistic(device, 101);
                } else if (stopp) {
                    return deviceModel;
                } else {
                    if (controlWifi) {
                        for (const control in controlWifi) {
                            if (control === "WMDownload" && device.platformType === "thinq2") {
                                await this.createremote(device.deviceId, control, deviceModel);
                            }
                            const common = {
                                name: control,
                                type: "boolean",
                                role: "switch",
                                write: true,
                                read: true,
                                def: false,
                            };
                            if (
                                control === "WMDownload" ||
                                control === "WMStart" ||
                                control === "WMStop" ||
                                control === "WMOff" ||
                                control === "WMWakeup"
                            ) {
                                common.role = "button";
                                common.def = false;
                            }
                            await this.createDataPoint(`${device.deviceId}.remote.${control}`, common, "state");
                        }
                    }
                }
            }
        }
        return deviceModel;
    }

    async extractValues(device) {
        const deviceModel = this.modelInfos[device.deviceId];
        if (!deviceModel) {
            this.log.warn(`No model info for ${device.deviceId}`);
            return;
        }
        let langPack = null;
        let langPath = null;
        if (device.langPackProductTypeUri) {
            langPath = "langPackProductTypeUri";
        } else if (device.langPackModelUri) {
            langPath = "langPackModelUri";
        }
        if (langPath != null) {
            langPack = await this.requestClient
                .get(device[langPath])
                .then(res => res.data)
                .catch(error => {
                    this.log.info(`langPackProductTypeUri: ${error}`);
                    return null;
                });
        }
        if (langPack != null && langPack.pack) {
            langPack = langPack.pack;
        }
        if (deviceModel["MonitoringValue"] || deviceModel["Value"]) {
            this.log.debug("extract values from model");
            const deviceType = deviceModel["deviceType"] ? deviceModel["deviceType"] : 0;
            let type = "";
            if (device["snapshot"] && deviceModel["folder"] && deviceType != 401) {
                type = deviceModel["folder"];
            }
            //const thinq2 = deviceModel["thinq2"] ? deviceModel["thinq2"] : "";
            let path = `${device.deviceId}.snapshot.`;
            if (type) {
                path = `${path + type}.`;
            }
            if (deviceType === 202) {
                await this.setDryerBlindStates(path);
            }
            const downloadedCourseType = this.coursetypes[device.deviceId].downloadedCourseType
                ? this.coursetypes[device.deviceId].downloadedCourseType
                : "courseMiniGplusBest";
            const smartCourseType = this.coursetypes[device.deviceId].smartCourseType
                ? this.coursetypes[device.deviceId].smartCourseType
                : "WASHERANDDRYER";
            const courseType = this.coursetypes[device.deviceId].courseType
                ? this.coursetypes[device.deviceId].courseType
                : "WASHERANDDRYER";
            const onlynumber = /^-?[0-9]+$/;
            if (deviceModel["MonitoringValue"]) {
                const dp_targetkey = [];
                for (const state in deviceModel["MonitoringValue"]) {
                    const obj = await this.getObjectAsync(path + state);
                    let common = {
                        name: state,
                        type: "mixed",
                        role: "state",
                        write: true,
                        read: true,
                    };
                    if (obj && obj.common) {
                        // @ts-expect-error nothing
                        common = obj.common;
                    }
                    const commons = {};
                    if (deviceModel["MonitoringValue"][state]["targetKey"] && obj) {
                        this.targetKeys[state] = [];
                        const firstKeyName = Object.keys(deviceModel["MonitoringValue"][state]["targetKey"])[0];
                        const firstObject = deviceModel["MonitoringValue"][state]["targetKey"][firstKeyName];
                        for (const targetKey in firstObject) {
                            dp_targetkey.push(firstObject[targetKey]);
                            this.targetKeys[state].push(firstObject[targetKey]);
                        }
                    } else if (!obj && !dp_targetkey.includes(state)) {
                        continue;
                    }
                    if (state === courseType) {
                        for (const key in deviceModel["Course"]) {
                            commons[key] =
                                constants[`${this.lang}Translation`][key] != null
                                    ? constants[`${this.lang}Translation`][key]
                                    : key;
                        }
                        commons["NOT_SELECTED"] =
                            constants[`${this.lang}Translation`]["NOT_SELECTED"] != null
                                ? constants[`${this.lang}Translation`]["NOT_SELECTED"]
                                : 0;
                    }
                    if (state === smartCourseType || state === downloadedCourseType) {
                        for (const key in deviceModel["SmartCourse"]) {
                            commons[key] =
                                constants[`${this.lang}Translation`][key] != null
                                    ? constants[`${this.lang}Translation`][key]
                                    : key;
                        }
                        commons["NOT_SELECTED"] =
                            constants[`${this.lang}Translation`]["NOT_SELECTED"] != null
                                ? constants[`${this.lang}Translation`]["NOT_SELECTED"]
                                : 0;
                    }
                    if (deviceModel["MonitoringValue"][state]["valueMapping"]) {
                        if (deviceModel["MonitoringValue"][state]["valueMapping"].max) {
                            const valueDefault = deviceModel["MonitoringValue"][state]["default"]
                                ? deviceModel["MonitoringValue"][state]["default"]
                                : null;
                            common.min = 0;
                            if (state === "moreLessTime") {
                                common.max = 200;
                            } else if (state === "timeSetting") {
                                common.max = 360;
                            } else if (state === "AirPolution" || state === "airState.quality.odor") {
                                common.max = 2000000;
                            } else if (state === "airState.miscFuncState.autoDryRemainTime") {
                                common.max = 300;
                            } else if (
                                this.modelInfos[device.deviceId]["signature"] &&
                                (state === "reserveTimeMinute" ||
                                    state === "remainTimeMinute" ||
                                    state === "initialTimeMinute")
                            ) {
                                common.max = 1000;
                            } else {
                                if (
                                    valueDefault != null &&
                                    valueDefault > deviceModel["MonitoringValue"][state]["valueMapping"].max
                                ) {
                                    common.max = valueDefault;
                                } else {
                                    common.max = deviceModel["MonitoringValue"][state]["valueMapping"].max;
                                }
                            }
                            common.def = valueDefault ? parseFloat(valueDefault) : 0;
                        } else {
                            const values = Object.keys(deviceModel["MonitoringValue"][state]["valueMapping"]);
                            for (const value of values) {
                                if (deviceModel["MonitoringValue"][state]["valueMapping"][value].label != null) {
                                    const valueMap = deviceModel["MonitoringValue"][state]["valueMapping"][value];
                                    if (onlynumber.test(value)) {
                                        commons[valueMap.index] =
                                            langPack != null && langPack[valueMap.label]
                                                ? langPack[valueMap.label].toString("utf-8")
                                                : valueMap.label;
                                    } else {
                                        commons[value] =
                                            langPack != null && langPack[valueMap.label]
                                                ? langPack[valueMap.label].toString("utf-8")
                                                : valueMap.index;
                                    }
                                    if (value === "NO_ECOHYBRID") {
                                        common.def = "NO_ECOHYBRID";
                                    }
                                } else {
                                    if (value === "NO_ECOHYBRID") {
                                        common.def = "NO_ECOHYBRID";
                                    }
                                    commons[value] = value;
                                }
                            }
                        }
                    }
                    if (Object.keys(commons).length > 0) {
                        if (common["states"] != null) {
                            delete common.states;
                        }
                        common.states = commons;
                    }
                    if (common.write == null) {
                        common.write = true;
                    }
                    if (common.read == null) {
                        common.read = true;
                    }
                    if (!obj) {
                        // @ts-expect-error nothing
                        await this.setObjectNotExistsAsync(path + state, {
                            type: "state",
                            common: common,
                            native: {},
                        }).catch(error => {
                            this.log.error(error);
                        });
                    } else {
                        obj.common = common;
                        await this.setObjectAsync(path + state, obj);
                    }
                }
            }
            if (deviceModel["Value"]) {
                for (const state in deviceModel["Value"]) {
                    this.log.debug(path + state); //Problem with 401 device
                    const obj = await this.getObjectAsync(path + state);
                    if (!obj) {
                        //await this.delObjectAsync(path + state);
                        continue;
                    }
                    const common = obj.common;
                    const commons = {};
                    let valueObject = deviceModel["Value"][state]["option"]
                        ? deviceModel["Value"][state]["option"]
                        : null;
                    const valueDefault = deviceModel["Value"][state]["default"]
                        ? deviceModel["Value"][state]["default"]
                        : null;
                    if (deviceModel["Value"][state]["value_mapping"]) {
                        valueObject = deviceModel["Value"][state]["value_mapping"];
                    }
                    if (deviceModel["Value"][state]["value_validation"]) {
                        valueObject = deviceModel["Value"][state]["value_validation"];
                    }
                    if (valueObject) {
                        if (valueObject.max) {
                            //LG Signature 201 thinq1????
                            common.min = 0;
                            if (state === "moreLessTime") {
                                common.max = 200;
                            } else if (state === "timeSetting") {
                                common.max = 360;
                            } else if (state === "AirPolution" || state === "airState.quality.odor") {
                                common.max = 2000000;
                            } else if (state === "airState.miscFuncState.autoDryRemainTime") {
                                common.max = 300;
                            } else {
                                if (valueDefault != null && valueDefault > valueObject.max) {
                                    common.max = valueDefault;
                                } else {
                                    common.max = valueObject.max;
                                }
                            }
                            common.def = valueDefault ? parseFloat(valueDefault) : 0;
                        } else {
                            const values = Object.keys(valueObject);
                            for (const value of values) {
                                const content = valueObject[value];
                                if (typeof content === "string") {
                                    const new_content = content.replace("@", "");
                                    if (langPack != null && langPack[content]) {
                                        commons[value] = langPack[content].toString("utf-8");
                                    } else if (constants[`${this.lang}Translation`][new_content] != null) {
                                        commons[value] = constants[`${this.lang}Translation`][new_content];
                                    } else {
                                        commons[value] = new_content;
                                    }
                                }
                            }
                        }
                    }
                    if (Object.keys(commons).length > 0) {
                        if (common["states"] != null) {
                            delete common.states;
                        }
                        common.states = commons;
                    }
                    if (common.write == null) {
                        common.write = true;
                    }
                    if (common.read == null) {
                        common.read = true;
                    }
                    if (!obj) {
                        // @ts-expect-error nothing
                        await this.setObjectNotExistsAsync(path + state, {
                            type: "state",
                            common: common,
                            native: {},
                        }).catch(error => {
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

    async start_mqtt() {
        try {
            if (this.mqttdata.privateKey == null) {
                const mqttHost = await this.getMqttInfo(constants.MQTT_URL);
                let mqttHostParts = [];
                if (mqttHost && mqttHost.result && mqttHost.result.mqttServer) {
                    if (mqttHost.result.apiServer && !mqttHost.result.apiServer.includes("-ats.iot")) {
                        mqttHostParts = mqttHost.result.mqttServer.split(".iot.");
                        this.mqttdata["apiServer"] = `${mqttHostParts[0]}-ats.iot.${mqttHostParts[1]}`;
                    }
                    if (!mqttHost.result.mqttServer.includes("-ats.iot")) {
                        mqttHostParts = mqttHost.result.mqttServer.split(".iot.");
                        this.mqttdata["mqttServer"] = `${mqttHostParts[0]}-ats.iot.${mqttHostParts[1]}`;
                    }
                } else {
                    this.log.info("Cannot load MQTT Host");
                    return;
                }
                this.log.info("Found MQTT Host");
                this.mqttdata.mqttServer = this.resolveUrl(this.mqttdata.mqttServer, "", true);
                const mqttCer = await this.getMqttInfo(constants.MQTT_CER);
                if (!mqttCer) {
                    this.log.info("Cannot load AWS CER");
                    return;
                }
                this.mqttdata.amazon = mqttCer;
                this.log.info("Found AWS CER");
                const certGenerator = await this.getMqttInfo(constants.MQTT_AZU);
                if (certGenerator.privKey && certGenerator.csr) {
                    this.mqttdata.privateKey = certGenerator.privKey;
                    this.mqttdata.key = certGenerator.csr;
                } else {
                    const key = forge.pki.rsa.generateKeyPair(2048);
                    const keys = {};
                    keys.privateKey = forge.pki.privateKeyToPem(key.privateKey);
                    this.mqttdata.privateKey = keys.privateKey;
                    keys.publicKey = forge.pki.publicKeyToPem(key.publicKey);
                    const csr = forge.pki.createCertificationRequest();
                    csr.publicKey = forge.pki.publicKeyFromPem(keys.publicKey);
                    csr.setSubject([
                        {
                            shortName: "CN",
                            value: "AWS IoT Certificate",
                        },
                        {
                            shortName: "O",
                            value: "Amazon",
                        },
                    ]);
                    csr.sign(forge.pki.privateKeyFromPem(keys.privateKey), forge.md.sha256.create());
                    this.mqttdata.key = forge.pki.certificationRequestToPem(csr);
                }
                this.log.info("Create certification done");
            }
            await this.getUser("service/users/client", {});
            const client_certificate = await this.getUser("service/users/client/certificate", {
                csr: this.mqttdata.key,
            });
            if (!client_certificate && !client_certificate.result && !client_certificate.result.certificatePem) {
                this.log.info("Cannot load certificatePem");
                return;
            }
            if (!client_certificate && !client_certificate.result && !client_certificate.result.subscriptions) {
                this.log.info("Cannot load subscriptions");
                return;
            }
            this.mqttdata.certificatePem = client_certificate.result.certificatePem;
            this.mqttdata.subscriptions = client_certificate.result.subscriptions;
            if (this.isRestart) {
                this.log.info("Start MQTT Connection");
            }
            this.connectMqtt();
        } catch (error) {
            this.logError("error", "Create CSR ERROR: ", error);
            this.mqttC = null;
            this.isRestart = true;
            if (error && error.toString().indexOf("0110") === -1) {
                this.terms();
            }
        }
    }

    async connectMqtt() {
        try {
            let region = "eu-west-1";
            const split_mqtt = this.mqttdata.mqttServer.split(".");
            if (split_mqtt.length > 1) {
                region = split_mqtt[2];
            }
            this.log.debug(`userid: ${this.mqtt_userID}`);
            const connectData = {
                caCert: Buffer.from(this.mqttdata.amazon, "utf-8"),
                privateKey: Buffer.from(this.mqttdata.privateKey, "utf-8"),
                clientCert: Buffer.from(this.mqttdata.certificatePem, "utf-8"),
                clientId: this.mqtt_userID,
                host: this.mqttdata.mqttServer,
                username: this.userNumber,
                region: region,
                debug: !!this.log.debug,
                baseReconnectTimeMs: 10000,
                keepalive: 60,
            };
            this.mqttC = new awsIot(connectData);

            this.mqttC.on("offline", () => this.log.debug("Thinq MQTT offline"));

            this.mqttC.on("end", () => this.log.debug("Thinq MQTT end"));

            this.mqttC.on("close", () => this.log.debug("Thinq MQTT closed"));

            this.mqttC.on("disconnect", packet => {
                this.log.info(`MQTT disconnect${packet}`);
            });

            this.mqttC.on("connect", packet => {
                if (this.isRestart) {
                    this.log.info(`MQTT connected to: ${this.mqttdata.subscriptions}`);
                }
                this.isRestart = true;
                this.log.debug(`packet: ${JSON.stringify(packet)}`);
                for (const subscription of this.mqttdata.subscriptions) {
                    if (subscription != null && this.mqttC != null) {
                        this.mqttC.subscribe(subscription);
                    } else {
                        this.log.warn(`Cannot find subscription - ${JSON.stringify(this.mqttdata)}`);
                    }
                }
                this.maskingTimer();
            });

            this.mqttC.on("reconnect", () => this.log.info("Thinq MQTT reconnect"));

            this.mqttC.on("message", async (topic, message) => {
                try {
                    const monitoring = JSON.parse(message);
                    this.log.debug(`Monitoring: ${JSON.stringify(monitoring)}`);
                    if (
                        monitoring &&
                        monitoring.data &&
                        monitoring.data.state &&
                        monitoring.data.state.reported &&
                        monitoring.type &&
                        monitoring.deviceId &&
                        monitoring.type === "monitoring"
                    ) {
                        this.json2iob.parse(`${monitoring.deviceId}.snapshot`, monitoring.data.state.reported, {
                            forceIndex: true,
                            write: true,
                            preferedArrayName: null,
                            channelName: null,
                            autoCast: true,
                            checkvalue: false,
                            checkType: true,
                            firstload: true,
                        });
                        if (
                            monitoring.data.state.reported &&
                            monitoring.data.state.reported.static &&
                            monitoring.data.state.reported.static.deviceType &&
                            (monitoring.data.state.reported.static.deviceType == "406" ||
                                monitoring.data.state.reported.static.deviceType == "401" ||
                                monitoring.data.state.reported.static.deviceType == "101")
                        ) {
                            this.refreshRemote(monitoring);
                            if (
                                monitoring.data.state.reported["airState.preHeat.schedule"] != null &&
                                !this.isAdapterUpdateFor406
                            ) {
                                this.updateHeat(monitoring.deviceId);
                            }
                        }
                    }
                } catch (error) {
                    this.logError("debug", "message: ", error);
                }
            });

            this.mqttC.on("error", error => {
                this.log.error(`MQTT ERROR: ${error}`);
            });
        } catch (error) {
            this.logError("debug", "MQTT ERROR: ", error);
            this.mqttC = null;
        }
    }

    async getMqttInfo(requestUrl) {
        const headers = {
            "x-country-code": "DE",
            "x-service-phase": "OP",
        };
        return this.requestClient
            .get(requestUrl, { headers })
            .then(res => res.data)
            .catch(error => {
                this.log.error(`getMqttInfo: ${error}`);
            });
    }

    uuidv4() {
        const hex = crypto.randomBytes(16).toString("hex");
        const uuidv4 = `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(
            16,
            20,
        )}-${hex.substring(20)}`;
        return uuidv4.toUpperCase();
    }

    async getUser(uri_value, data) {
        const userUrl = this.resolveUrl(`${this.gateway.thinq2Uri}/`, uri_value);
        const headers = this.defaultHeaders;
        // @ts-expect-error nothing
        headers["x-client-id"] = this.mqtt_userID;
        return this.requestClient
            .post(userUrl, data, { headers })
            .then(resp => resp.data)
            .catch(error => {
                this.log.error(error);
            });
    }

    async sendCommandToDevice(deviceId, values, thinq1, get_sync) {
        const headers = this.defaultHeaders;
        let sync = "control-sync";
        if (get_sync) {
            sync = "control";
        }
        let controlUrl = this.resolveUrl(`${this.gateway.thinq2Uri}/`, `service/devices/${deviceId}/${sync}`);
        let data = {
            ctrlKey: "basicCtrl",
            command: "Set",
            ...values,
        };
        if (thinq1) {
            controlUrl = `${this.gateway.thinq1Uri}/rti/rtiControl`;
            data = values;
        }
        this.log.debug(`sendCommandToDevice: ${JSON.stringify(data)}`);
        this.log.debug(`sendCommandToDevice URL: ${JSON.stringify(controlUrl)}`);

        return this.requestClient
            .post(controlUrl, data, { headers })
            .then(resp => resp.data)
            .catch(error => {
                if (
                    error.response &&
                    error.response.status === 400 &&
                    data.ctrlKey === "reservationCtrl" &&
                    data.command === "Get"
                ) {
                    this.log.debug(`Bad Request: ${error.message}`);
                } else {
                    this.log.error("Send failed");
                    this.log.error(error);
                }
            });
    }

    /**
     * @param ms milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => {
            this.sleepTimer = this.setTimeout(() => {
                resolve(true);
            }, ms);
        });
    }

    /**
     * @param callback Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    async onUnload(callback) {
        try {
            this.updateInterval && this.clearInterval(this.updateInterval);
            this.qualityInterval && this.clearInterval(this.qualityInterval);
            this.refreshTokenInterval && this.clearInterval(this.refreshTokenInterval);
            this.refreshTimeout && this.clearTimeout(this.refreshTimeout);
            this.sleepTimer && this.clearTimeout(this.sleepTimer);
            this.updateThinq1Interval && this.clearInterval(this.updateThinq1Interval);
            this.updateThinq1SingleInterval && this.clearInterval(this.updateThinq1SingleInterval);
            for (const dev in this.workIds) {
                if (this.modelInfos[dev] && this.modelInfos[dev]["thinq2"] === "thinq1") {
                    const data = {
                        platformType: "thinq1",
                        deviceId: dev,
                    };
                    await this.stopMonitor(data);
                }
            }
            callback();
        } catch (e) {
            this.logError("error", "onunload: ", e);
            callback();
        }
    }

    logError(log, name, error) {
        if (error instanceof Error) {
            this.log[log](error.stack || `${name}${error.name}: ${error.message}`);
        } else {
            this.log[log](`${name}${error.toString()}`);
        }
    }

    async setAckFlag(id, value) {
        try {
            if (id) {
                this.setState(id, {
                    ack: true,
                    ...value,
                });
            }
        } catch (e) {
            this.logError("debug", "setAckFlag: ", e);
        }
    }

    DecToHex(d) {
        const hex = d.toString(16);
        return hex.length == 1 ? `0${hex}` : hex;
    }

    /**
     * @param id Is called if a subscribed state changes
     * @param state ioBroker.State | null | undefined
     */
    async onStateChange(id, state) {
        if (state) {
            if (!state.ack) {
                try {
                    const secsplit = id.split(".")[id.split(".").length - 2];
                    const lastsplit = id.split(".")[id.split(".").length - 1];
                    const deviceId = id.split(".")[2];
                    if (lastsplit === "interval") {
                        this.setAckFlag(id);
                        this.setNewInterval(state.val);
                        return;
                    }
                    let no_for = false;
                    if (lastsplit === "ownrequest") {
                        this.ownRequestThinq1(state.val, deviceId);
                        this.setAckFlag(id);
                        return;
                    }
                    if (lastsplit === "sendJSON" || lastsplit === "sendJSONNoSync") {
                        let controlsync = "/control-sync";
                        if (lastsplit === "sendJSONNoSync") {
                            controlsync = "/control";
                        }
                        const headers = this.defaultHeaders;
                        const controlUrl = this.resolveUrl(
                            `${this.gateway.thinq2Uri}/`,
                            `service/devices/${deviceId}${controlsync}`,
                        );
                        const js = state.val != null ? state.val.toString() : "";
                        let sendData;
                        try {
                            sendData = JSON.parse(js);
                        } catch (e) {
                            this.logError("debug", "sendData: ", e);
                            return;
                        }
                        this.log.debug(JSON.stringify(sendData));
                        const sendJ = await this.requestClient
                            .post(controlUrl, sendData, { headers })
                            .then(resp => resp.data)
                            .catch(error => {
                                this.log.error("Send failed");
                                this.log.error(error);
                            });
                        this.log.info(JSON.stringify(sendJ));
                        this.setAckFlag(id);
                        return;
                    }
                    if (secsplit === "weather") {
                        if (lastsplit === "device") {
                            this.setAckFlag(id);
                        } else if (lastsplit === "unit") {
                            const units = state.val === "C" ? "°C" : "F";
                            this.extendObject(`weather.temperature`, { common: { unit: units } });
                            this.setAckFlag(id);
                        } else if (lastsplit === "update") {
                            this.getWeather();
                            this.setAckFlag(id, { val: false });
                        }
                        return;
                    }
                    let response = null;
                    if (secsplit === "Course") {
                        this.courseactual[deviceId][lastsplit] = state.val;
                        this.log.debug(JSON.stringify(this.courseactual[deviceId]));
                        this.setAckFlag(id);
                        return;
                    }
                    let devType;
                    if (this.modelInfos[deviceId] && this.modelInfos[deviceId]["deviceType"]) {
                        devType = { val: this.modelInfos[deviceId]["deviceType"] };
                    } else {
                        devType = await this.getStateAsync(`${deviceId}.deviceType`);
                    }
                    if (secsplit === "Statistic" && lastsplit === "sendRequest") {
                        if (devType && devType.val > 100 && devType.val < 104) {
                            this.sendStaticRequest(deviceId, "fridge", this.modelInfos[deviceId]["thinq2"]);
                        } else if (devType && devType.val === 401 && this.modelInfos[deviceId]["thinq2"] === "thinq1") {
                            this.sendStaticRequestThinq1(deviceId, constants.API1_CLIENT_ID);
                        } else if (devType && devType.val === 401) {
                            this.sendStaticRequest(deviceId, "air", this.modelInfos[deviceId]["thinq2"]);
                        } else if (devType && devType.val === 406) {
                            this.sendStaticRequest(deviceId, "air", this.modelInfos[deviceId]["thinq2"]);
                        } else {
                            this.sendStaticRequest(deviceId, "other", "thinq2");
                        }
                        this.log.debug(JSON.stringify(this.courseactual[deviceId]));
                        this.setAckFlag(id, { val: false });
                        return;
                    } else if (secsplit === "Statistic") {
                        this.setAckFlag(id);
                        return;
                    }
                    let sync = false;
                    if (id.indexOf(".settings.") !== -1) {
                        this.setAckFlag(id);
                        return;
                    } else if (id.indexOf(".remote.") !== -1) {
                        no_for = true;
                        let action = id.split(".")[4];
                        let data = {};
                        let onoff = "";
                        let rawData = {};
                        let WMStateDL;
                        let noff;
                        if (devType && devType.val === 401 && this.modelInfos[deviceId]["thinq2"] === "thinq2") {
                            if (secsplit === "break") {
                                this.updateHoliday(deviceId, devType, id, state);
                                this.setAckFlag(id);
                                return;
                            } else if (!this.modelInfos[deviceId] || !this.modelInfos[deviceId]["ControlDevice"]) {
                                this.log.info(`Cannot found modelInfos = action: ${action}`);
                                return;
                            }
                            let checkRemote = {};
                            const obj = await this.getObjectAsync(id);
                            if (!obj || !obj.native || !obj.native.dataKey) {
                                this.log.info("Cannot found dataKey!");
                                return;
                            }
                            for (const dataRemote of this.modelInfos[deviceId].ControlDevice) {
                                if (dataRemote.ctrlKey === secsplit) {
                                    action = secsplit;
                                    checkRemote = dataRemote;
                                    break;
                                }
                            }
                            if (checkRemote && checkRemote.dataKey) {
                                if (secsplit === "allEventEnable") {
                                    sync = true;
                                }
                                action = secsplit;
                                rawData["command"] = lastsplit === "operation" ? "Operation" : "Set";
                                rawData["dataKey"] = obj.native.dataKey;
                                rawData["dataValue"] = state.val;
                                rawData["dataSetList"] = null;
                                rawData["dataGetList"] = null;
                                this.setAckFlag(id);
                            } else if (checkRemote && checkRemote.dataSetList) {
                                if (lastsplit === "jet" || lastsplit === "airClean") {
                                    action = secsplit;
                                    rawData["command"] = "Set";
                                    rawData["data"] = {};
                                    rawData["dataGetList"] = null;
                                    rawData["data"][obj.native.dataKey] = state.val;
                                } else {
                                    this.log.info(`The command is not implemented: ${secsplit}`);
                                    return;
                                }
                            } else if (secsplit === "2nd") {
                                action = "basicCtrl";
                                rawData["command"] = lastsplit === "operation" ? "Operation" : "Set";
                                rawData["dataKey"] = obj.native.dataKey;
                                rawData["dataValue"] = state.val;
                                rawData["dataSetList"] = null;
                                rawData["dataGetList"] = null;
                            } else {
                                this.log.info("The command is not implemented");
                                return;
                            }
                        } else if (devType && devType.val === 401 && this.modelInfos[deviceId]["thinq2"] === "thinq1") {
                            rawData = this.deviceControls[deviceId][action]
                                ? this.deviceControls[deviceId][action]
                                : {};
                            if (rawData.length === 0) {
                                this.log.info("Not found devicecontrol!!");
                                return;
                            }
                            data = await this.sendCommandThinq1AC(id, deviceId, rawData, action);
                        } else if (devType && devType.val === 406 && this.modelInfos[deviceId]["thinq2"] === "thinq2") {
                            if (
                                id.indexOf("_end") !== -1 ||
                                id.indexOf("_start") !== -1 ||
                                id.indexOf("_state") !== -1
                            ) {
                                this.check_reservationCtrl(id, deviceId, lastsplit, state.val);
                                this.setAckFlag(id);
                                return;
                            }
                            if (lastsplit === "add_new_schedule") {
                                this.addHeat(deviceId);
                                this.setAckFlag(id, { val: false });
                                return;
                            } else if (lastsplit === "del_new_schedule") {
                                this.delHeat(deviceId, state.val);
                                this.setAckFlag(id);
                                return;
                            } else if (lastsplit === "send_new_schedule") {
                                this.sendHeat(deviceId);
                                this.setAckFlag(id, { val: false });
                                return;
                            }
                            if (!this.modelInfos[deviceId] || !this.modelInfos[deviceId]["ControlDevice"]) {
                                this.log.info(`Cannot found modelInfos = action: ${action}`);
                                return;
                            }
                            const obj = await this.getObjectAsync(id);
                            if (!obj || !obj.native || !obj.native.dataKey) {
                                this.log.info("Cannot found dataKey!");
                                return;
                            }
                            this.log.debug(JSON.stringify(obj));
                            this.log.debug(obj.native["dataKey"]);
                            if (
                                lastsplit === "opMode" ||
                                lastsplit === "hotWaterTarget" ||
                                lastsplit === "operation" ||
                                lastsplit === "schedule"
                            ) {
                                action = secsplit;
                                rawData["command"] = lastsplit === "operation" ? "Operation" : "Set";
                                rawData["dataKey"] = obj.native.dataKey;
                                rawData["dataValue"] = state.val;
                                rawData["dataSetList"] = null;
                                rawData["dataGetList"] = null;
                                this.setAckFlag(id);
                            } else {
                                this.log.info(`The command is not implemented: ${lastsplit}`);
                                return;
                            }
                        } else if (
                            [
                                "LastCourse",
                                "Favorite",
                                "WMDownload_Select",
                                "WMStart",
                                "WMDownload",
                                "fridgeTemp",
                                "freezerTemp",
                                "expressMode",
                                "ecoFriendly",
                            ].includes(action)
                        ) {
                            let dataTemp;
                            dataTemp = await this.getStateAsync(`${deviceId}.snapshot.refState.tempUnit`);
                            if (!dataTemp) {
                                dataTemp = { val: "" };
                            }
                            switch (action) {
                                case "fridgeTemp":
                                    if (this.modelInfos[deviceId]["thinq2"] === "thinq1") {
                                        this.refrigerator(deviceId, "TempRefrigerator", state.val, uuid.v4());
                                        return;
                                    }
                                    rawData.data = { refState: { fridgeTemp: state.val, tempUnit: dataTemp.val } };
                                    action = "basicCtrl";
                                    rawData.command = "Set";

                                    break;
                                case "freezerTemp":
                                    if (this.modelInfos[deviceId]["thinq2"] === "thinq1") {
                                        this.refrigerator(deviceId, "TempFreezer", state.val, uuid.v4());
                                        return;
                                    }
                                    rawData.data = { refState: { freezerTemp: state.val, tempUnit: dataTemp.val } };
                                    action = "basicCtrl";
                                    rawData.command = "Set";

                                    break;
                                case "expressMode":
                                    if (this.modelInfos[deviceId]["thinq2"] === "thinq1") {
                                        this.refrigerator(deviceId, "IcePlus", state.val, uuid.v4());
                                        return;
                                    }
                                    noff = state.val === "IGNORE" ? "OFF" : state.val;
                                    rawData.data = { refState: { expressMode: noff, tempUnit: dataTemp.val } };
                                    action = "basicCtrl";
                                    rawData.command = "Set";

                                    break;
                                case "ecoFriendly":
                                    if (this.modelInfos[deviceId]["thinq2"] === "thinq1") {
                                        this.refrigerator(deviceId, "ecoFriendly", state.val, uuid.v4());
                                        return;
                                    }
                                    onoff = state.val ? "ON" : "OFF";
                                    rawData.data = { refState: { ecoFriendly: onoff, tempUnit: dataTemp.val } };
                                    action = "basicCtrl";
                                    rawData.command = "Set";

                                    break;
                                case "LastCourse":
                                    if (state.val != null && typeof state.val === "number" && state.val > 0) {
                                        this.setCourse(id, deviceId, state);
                                        this.setAckFlag(id);
                                    }
                                    return;
                                case "Favorite":
                                    this.setFavoriteCourse(deviceId);
                                    this.setAckFlag(id, { val: false });
                                    return;
                                case "WMDownload_Select":
                                    this.setAckFlag(id);
                                    if (state.val === "NOT_SELECTED") {
                                        return;
                                    }
                                    if (
                                        state.val != true &&
                                        state.val != false &&
                                        state.val != null &&
                                        this.deviceJson &&
                                        this.deviceJson[deviceId] &&
                                        this.deviceJson[deviceId]["Course"] &&
                                        this.deviceJson[deviceId]["Course"][state.val]
                                    ) {
                                        onoff = state.val != null && state.val != "" ? state.val.toString() : "";
                                        this.insertCourse(onoff, deviceId, "Course");
                                        return;
                                    } else if (
                                        state.val != true &&
                                        state.val != false &&
                                        state.val != null &&
                                        this.deviceJson &&
                                        this.deviceJson[deviceId] &&
                                        this.deviceJson[deviceId]["SmartCourse"] &&
                                        this.deviceJson[deviceId]["SmartCourse"][state.val]
                                    ) {
                                        onoff = state.val != null && state.val != "" ? state.val.toString() : "";
                                        this.insertCourse(onoff, deviceId, "SmartCourse");
                                        return;
                                    }
                                    this.log.warn(`Command ${action} and value ${state.val} not found`);
                                    return;

                                case "WMDownload":
                                    rawData = await this.createCourse(state, deviceId, action);
                                    this.log.debug(JSON.stringify(this.courseactual[deviceId]));
                                    this.log.debug(JSON.stringify(rawData));
                                    if (rawData.data && Object.keys(rawData).length === 0) {
                                        return;
                                    }
                                    this.setAckFlag(id);
                                    if (
                                        !this.coursedownload[deviceId] &&
                                        this.deviceJson &&
                                        rawData["current_course"] &&
                                        this.deviceJson[deviceId] &&
                                        this.deviceJson[deviceId]["Course"] &&
                                        this.deviceJson[deviceId]["Course"][rawData["current_course"]]
                                    ) {
                                        return;
                                    }
                                    if (this.modelInfos[deviceId]["signature"]) {
                                        return;
                                    }
                                    break;
                                case "WMStart":
                                    this.setAckFlag(id);
                                    WMStateDL = await this.getStateAsync(`${deviceId}.remote.WMDownload_Select`);
                                    if (!WMStateDL) {
                                        this.log.warn("Datapoint WMDownload_Select is not exists!");
                                        return;
                                    } else if (WMStateDL.val === "NOT_SELECTED") {
                                        this.log.warn("Datapoint WMDownload_Select is empty!");
                                        return;
                                    }
                                    rawData = await this.createCourse(state, deviceId, action);
                                    this.log.debug(JSON.stringify(rawData));
                                    await this.setState(`${deviceId}.remote.WMDownload_Select`, {
                                        val: "NOT_SELECTED",
                                        ack: true,
                                    });
                                    if (Object.keys(rawData).length === 0) {
                                        return;
                                    }
                                    break;
                                default:
                                    this.log.info(`Command ${action} not found`);
                                    return;
                            }
                            no_for = false;
                            response = "";
                        } else {
                            rawData = this.deviceControls[deviceId][action]
                                ? this.deviceControls[deviceId][action]
                                : {};
                        }
                        if (rawData && rawData.command && rawData.data) {
                            data = { ctrlKey: action, command: rawData.command, dataSetList: rawData.data };
                        }

                        if (rawData && rawData.command && (rawData.dataKey || rawData.dataGetList)) {
                            data = {
                                ctrlKey: action,
                                command: rawData.command,
                                dataKey: rawData.dataKey,
                                dataValue: rawData.dataValue,
                                dataSetList: rawData.dataSetList,
                                dataGetList: rawData.dataGetList,
                            };
                        }

                        if (action === "WMStop" || action === "WMOff") {
                            data.ctrlKey = "WMControl";
                        }

                        this.log.debug(JSON.stringify(data));

                        if (data.dataSetList && no_for) {
                            const type = Object.keys(data.dataSetList)[0];
                            if (type) {
                                for (const dataElement of Object.keys(data.dataSetList[type])) {
                                    if (!dataElement.startsWith("control")) {
                                        const dataState = await this.getStateAsync(
                                            `${deviceId}.snapshot.${type}.${dataElement}`,
                                        );
                                        if (dataState) {
                                            data.dataSetList[dataElement] = dataState.val;
                                        }
                                    }
                                }
                            }
                        }
                        this.setAckFlag(id);
                        if (data && data.command && (rawData.dataKey || rawData.dataGetList)) {
                            this.log.debug(JSON.stringify(data));
                            response = await this.sendCommandToDevice(deviceId, data, false, sync);
                        } else if (data && data.command && data.dataSetList) {
                            this.log.debug(JSON.stringify(data));
                            response = await this.sendCommandToDevice(deviceId, data);
                        } else if (data && data.cmd && data.cmdOpt) {
                            this.log.debug(`rawData: ${JSON.stringify(data)}`);
                            if (data && data.cmdOpt && data.cmdOpt === "Operation") {
                                data.value = data.value ? "Start" : "Stop";
                            }
                            data = {
                                lgedmRoot: {
                                    deviceId: deviceId,
                                    workId: uuid.v4(),
                                    ...data,
                                    isControlFree: "Y",
                                },
                            };
                            this.log.debug(JSON.stringify(data));
                            response = await this.sendCommandToDevice(deviceId, data, true);
                        } else {
                            rawData.value = rawData.value.replace("{Operation}", state.val ? "Start" : "Stop");
                            data = {
                                lgedmRoot: {
                                    deviceId: deviceId,
                                    workId: uuid.v4(),
                                    cmd: rawData.cmd,
                                    cmdOpt: "Set",
                                    value: rawData.value,
                                    data: "",
                                },
                            };
                            this.log.debug(JSON.stringify(data));
                            response = await this.sendCommandToDevice(deviceId, data, true);
                        }

                        this.log.debug(JSON.stringify(response));

                        if (
                            (response && response.resultCode && response.resultCode !== "0000") ||
                            (response && response.lgedmRoot && response.lgedmRoot.returnCd !== "0000")
                        ) {
                            this.log.error("Command not succesful");
                            this.log.error(JSON.stringify(response));
                        }
                    } else {
                        const object = await this.getObjectAsync(id);
                        const name = object ? JSON.stringify(object.common.name) : "";
                        const data = { ctrlKey: "basicCtrl", command: "Set", dataKey: name, dataValue: state.val };
                        if (name != null && name != "" && name.indexOf(".operation") !== -1) {
                            data.command = "Operation";
                        }
                        this.log.debug(JSON.stringify(data));
                        const response = await this.sendCommandToDevice(deviceId, data);
                        this.log.debug(JSON.stringify(response));
                        if (response && response.resultCode !== "0000") {
                            this.log.error("Command not succesful");
                            this.log.error(JSON.stringify(response));
                        }
                    }
                    this.refreshTimeout = this.setTimeout(async () => {
                        await this.updateDevices();
                    }, 10 * 1000);
                } catch (e) {
                    this.logError("debug", "onStateChange: ", e);
                }
            } else {
                const idArray = id.split(".");
                const lastElement = idArray.pop();
                if (this.targetKeys[lastElement]) {
                    if (id.indexOf(".remote.") === -1) {
                        this.targetKeys[lastElement].forEach(element => {
                            this.setState(`${idArray.join(".")}.${element}`, state.val, true);
                        });
                    }
                }
            }
        }
    }

    async setNewInterval(state) {
        if (!state) {
            return;
        }
        this.updateThinq1Interval && this.clearInterval(this.updateThinq1Interval);
        this.updateThinq1Interval = null;
        await this.sleep(1000);
        if (state === 0) {
            this.config.interval_thinq1 = 0;
        } else {
            this.config.interval_thinq1 = state;
            this.startPollMonitor();
        }
    }

    async cleanupQuality() {
        this.log.debug("Start check quality");
        const quality = {
            0: "0x00 - good",
            1: "0x01 - general problem",
            2: "0x02 - no connection problem",
            16: "0x10 - substitute value from controller",
            17: "0x11 - general problem by instance",
            18: "0x12 - instance not connected",
            32: "0x20 - substitute initial value",
            64: "0x40 - substitute value from device or instance",
            65: "0x41 - general problem by device",
            66: "0x42 - device not connected",
            68: "0x44 - device reports error",
            128: "0x80 - substitute value from sensor",
            129: "0x81 - general problem by sensor",
            130: "0x82 - sensor not connected",
            132: "0x84 - sensor reports error",
        };
        try {
            const devices = await this.getDevicesAsync();
            for (const device of devices) {
                const deviceId = device._id.split(".").pop();
                const all_dp = await this.getObjectListAsync({
                    startkey: `${this.namespace}.${deviceId}.`,
                    endkey: `${this.namespace}.${deviceId}.\u9999`,
                });
                const dp_array = [];
                if (all_dp && all_dp.rows) {
                    let role;
                    for (const dp of all_dp.rows) {
                        if (dp.value.type === "state") {
                            const states = await this.getStateAsync(dp.id);
                            if (states && states.q != null && states.q != 0) {
                                this.log.debug(`Datapoint: ${dp.id} - ${JSON.stringify(states)}`);
                                if (quality[states.q]) {
                                    const isfind = dp_array.find(mes => mes.message === quality[states.q]);
                                    if (isfind) {
                                        this.log.debug(`Found: ${JSON.stringify(isfind)}`);
                                        ++isfind.counter;
                                        isfind.dp[isfind.counter] = dp.id;
                                    } else {
                                        this.log.debug(`Not Found`);
                                        const new_array = {
                                            message: quality[states.q],
                                            quality: states.q,
                                            counter: 1,
                                            dp: { 1: dp.id },
                                        };
                                        dp_array.push(new_array);
                                    }
                                    if (
                                        dp.value &&
                                        dp.value.common &&
                                        dp.value.common.role != null &&
                                        dp.value.common.role.toString().match(/button/gi) != null
                                    ) {
                                        role = { val: false };
                                    } else {
                                        role = null;
                                    }
                                    if (quality[states.q] === "0x20 - substitute initial value") {
                                        await this.setState(`${dp.id}`, {
                                            ack: true,
                                            ...role,
                                        });
                                    }
                                } else {
                                    this.log.debug(`Missing quality: ${states.q}`);
                                }
                            }
                        }
                    }
                }
                await this.setState(`${deviceId}.quality`, {
                    val:
                        Object.keys(dp_array).length > 0
                            ? JSON.stringify(dp_array)
                            : JSON.stringify({ message: "No Message" }),
                    ack: true,
                });
            }
        } catch (e) {
            this.logError("debug", "cleanupQuality: ", e);
        }
    }

    async cleanOldVersion() {
        const cleanOldVersion = await this.getObjectAsync("oldVersionCleaned");

        if (!cleanOldVersion) {
            try {
                const devices = await this.getDevicesAsync();
                for (const element of devices) {
                    const id = element["_id"].split(".").pop();
                    await this.delObjectAsync(`${id}`, { recursive: true });
                }
            } catch (e) {
                this.logError("debug", "Cannot delete a folder: ", e);
            }
            await this.setObjectNotExistsAsync("oldVersionCleaned", {
                type: "state",
                common: {
                    name: {
                        en: "Version check",
                        de: "Versionskontrolle",
                        ru: "Проверка версии",
                        pt: "Verificação da versão",
                        nl: "Versie controle",
                        fr: "Vérification de la version",
                        it: "Controllo della versione",
                        es: "Verificación de la versión",
                        pl: "Kontrola",
                        uk: "Перевірка версій",
                        "zh-cn": "检查",
                    },
                    type: "string",
                    role: "meta.version",
                    write: false,
                    read: true,
                },
                native: {},
            });
            this.log.info("Done with cleaning");
        }
        if (this.version == null) {
            this.version = "1.0.2";
        }
        await this.setState("oldVersionCleaned", this.version, true);
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param options [options={}]
     */
    module.exports = options => new LgThinq(options);
} else {
    // @ts-expect-error otherwise start the instance directly
    new LgThinq();
}
