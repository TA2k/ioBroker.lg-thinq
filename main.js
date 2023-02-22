"use strict";

/*
 * Created with @iobroker/create-adapter v1.34.1
 * Based on https://github.com/nVuln/homebridge-lg-thinq
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const axios = require("axios");
const crypto = require("crypto");
const uuid = require("uuid");
const qs = require("qs");
const { DateTime } = require("luxon");
const { extractKeys } = require("./lib/extractKeys");
const constants = require("./lib/constants");
const { URL } = require("url");
const helper = require("./lib/helper");
const air = require("./lib/air_conditioning");
const awsIot = require("aws-iot-device-sdk");
const forge = require("node-forge");

class LgThinq extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: "lg-thinq",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.requestClient = axios.create();
        this.updateInterval = null;
        this.session = {};
        this.modelInfos = {};
        this.auth = {};
        this.workIds = [];
        this.deviceControls = {};
        this.extractKeys = extractKeys;
        this.targetKeys = {};
        this.createDataPoint = helper.createDataPoint;
        this.setDryerBlindStates = helper.setDryerBlindStates;
        this.createFridge = helper.createFridge;
        this.createStatistic = helper.createStatistic;
        this.createremote = helper.createremote;
        this.lastDeviceCourse = helper.lastDeviceCourse;
        this.insertCourse = helper.insertCourse;
        this.setCourse = helper.setCourse;
        this.setFavoriteCourse = helper.setFavoriteCourse;
        this.checkdate = helper.checkdate;
        this.sendStaticRequest = helper.sendStaticRequest;
        this.createCourse = helper.createCourse;
        this.createAirRemoteStates = air.createAirRemoteStates;
        this.updateHoliday = air.updateHoliday;
        this.checkHolidayDate = air.checkHolidayDate;
        this.mqttdata = {};
        this.mqttC = {};
        this.lang = "de";
        this.deviceJson = {};
        this.courseJson = {};
        this.courseactual = {};
        this.coursetypes = {};
        this.coursedownload = {};
        this.mqtt_userID = "";
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        this.setState("info.connection", false, true);
        if (this.config.interval < 0.5) {
            this.log.info("Set interval to minimum 0.5");
            this.config.interval = 0.5;
        }
        // @ts-ignore
        await this.getForeignObject("system.config", async (err, data) => {
            if (data && data.common && data.common.language) {
                this.lang = data.common.language === this.lang ? this.lang : "en";
            }
        });
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
        this.subscribeStates("*");

        this.gateway = await this.requestClient
            .get(constants.GATEWAY_URL, { headers: this.defaultHeaders })
            .then((res) => res.data.result)
            .catch((error) => {
                this.log.error(error);
            });
        if (this.gateway) {
            this.lgeapi_url = `https://${this.gateway.countryCode.toLowerCase()}.lgeapi.com/`;

            this.session = await this.login(this.config.user, this.config.password).catch((error) => {
                this.log.error(error);
            });
            if (this.session && this.session.access_token) {
                this.log.debug(JSON.stringify(this.session));
                this.setState("info.connection", true, true);
                this.log.info("Login successful");
                this.refreshTokenInterval = setInterval(() => {
                    this.refreshNewToken();
                }, (this.session.expires_in - 100) * 1000);
                this.userNumber = await this.getUserNumber();
                const hash = crypto.createHash("sha256");
                const clientID = this.userNumber ? this.userNumber : constants.API_CLIENT_ID;
                this.mqtt_userID = hash.update(clientID + new Date().getTime()).digest("hex");
                this.defaultHeaders["x-user-no"] = this.userNumber;
                this.defaultHeaders["x-emp-token"] = this.session.access_token;
                const listDevices = await this.getListDevices();
                if (listDevices && listDevices === "TERMS") {
                    this.setState("info.connection", false, true);
                    //this.terms = await this.Term();
                    return;
                } else if (listDevices && listDevices === "BLOCKED") {
                    return;
                }

                this.log.info("Found: " + listDevices.length + " devices");
                let isThinq2 = false;
                for (const element of listDevices) {
                    await this.setObjectNotExistsAsync(element.deviceId, {
                        type: "device",
                        common: {
                            name: element.alias,
                            role: "state",
                        },
                        native: {},
                    });
                    this.extractKeys(this, element.deviceId, element, null, false, true);

                    this.modelInfos[element.deviceId] = await this.getDeviceModelInfo(element);
                    if (element.platformType && element.platformType === "thinq2") {
                        this.modelInfos[element.deviceId]["thinq2"] = element.platformType;
                        isThinq2 = true;
                    }
                    if (element.deviceType) {
                        this.modelInfos[element.deviceId]["deviceType"] = element.deviceType;
                        isThinq2 = true;
                    }
                    await this.pollMonitor(element);
                    await this.sleep(2000);
                    this.extractValues(element);
                }
                this.log.debug(JSON.stringify(listDevices));
                if (isThinq2) {
                    this.start_mqtt();
                }
                this.updateInterval = setInterval(async () => {
                    await this.updateDevices();
                }, this.config.interval * 60 * 1000);
            }
        }
    }

    async updateDevices() {
        const listDevices = await this.getListDevices().catch((error) => {
            this.log.error(error);
        });

        listDevices.forEach(async (element) => {
            this.extractKeys(this, element.deviceId, element);
            this.pollMonitor(element);
        });
        this.log.debug(JSON.stringify(listDevices));
    }

    async getDeviceEnergy(path) {
        const headers = this.defaultHeaders;
        const deviceUrl = this.resolveUrl(this.gateway.thinq2Uri + "/", path);

        return this.requestClient
            .get(deviceUrl, { headers })
            .then((res) => res.data.result)
            .catch((error) => {
                if (error.message && error.message === "Request failed with status code 400") {
                    return 400;
                }
                this.log.debug("getDeviceEnergy: " + error);
                return 500;
            });
    }

    async login(username, password) {
        // get signature and timestamp in login form
        const loginForm = await this.requestClient.get(await this.getLoginUrl()).then((res) => res.data);
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
        const loginUrl = this.gateway.empTermsUri + "/" + "emp/v2.0/account/session/" + encodeURIComponent(username);
        const res = await this.requestClient
            .post(loginUrl, qs.stringify(data), { headers })
            .then((res) => res.data)
            .catch((err) => {
                if (!err.response) {
                    this.log.error(err);
                    return;
                }
                this.log.error(JSON.stringify(err.response.data));
                const { code, message } = err.response.data.error;
                if (code === "MS.001.03") {
                    this.log.error("Double-check your country in configuration");
                }
                return;
            });
        if (!res) {
            return;
        }
        // dynamic get secret key for emp signature
        const empSearchKeyUrl = this.gateway.empSpxUri + "/" + "searchKey?key_name=OAUTH_SECRETKEY&sever_type=OP";
        const secretKey = await this.requestClient
            .get(empSearchKeyUrl)
            .then((res) => res.data)
            .then((data) => data.returnData);

        const timestamp = DateTime.utc().toRFC2822();
        const empData = {
            account_type: res.account.userIDType,
            client_id: constants.CLIENT_ID,
            country_code: res.account.country,
            username: res.account.userID,
        };
        const empUrl = "/emp/oauth2/token/empsession" + qs.stringify(empData, { addQueryPrefix: true });
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
            .then((res) => res.data)
            .catch((err) => {
                this.log.error(err.response.data.error.message);
                return;
            });
        if (token.status !== 1) {
            this.log.error(token.message);
            return;
        }

        this.lgeapi_url = token.oauth2_backend_url || this.lgeapi_url;

        return token;
    }

    async pollMonitor(device) {
        if (device.platformType === "thinq1") {
            this.log.debug("start polling");
            let result = new Uint8Array(1024);
            try {
                if (!(device.deviceId in this.workIds)) {
                    this.log.debug(device.deviceId + " is connecting");
                    await this.startMonitor(device);
                    await this.sleep(5000);
                }
                result = await this.getMonitorResult(device.deviceId, this.workIds[device.deviceId]);
                if (result && typeof result === "object") {
                    let resultConverted;
                    if (this.modelInfos[device.deviceId].Monitoring.type === "BINARY(BYTE)") {
                        resultConverted = this.decodeMonitorBinary(
                            result,
                            this.modelInfos[device.deviceId].Monitoring.protocol,
                        );
                    }
                    if (this.modelInfos[device.deviceId].Monitoring.type === "JSON") {
                        resultConverted = JSON.parse(result.toString("utf-8"));
                    }
                    this.log.debug(JSON.stringify(resultConverted));
                    await extractKeys(this, device.deviceId + ".snapshot", resultConverted);
                    return resultConverted;
                } else {
                    this.log.debug("No data:" + JSON.stringify(result) + " " + device.deviceId);
                }
                await this.stopMonitor(device);
            } catch (err) {
                this.log.debug(err);
            }
        }
    }
    async startMonitor(device) {
        try {
            if (device.platformType === "thinq1") {
                const sendId = uuid.v4();
                const returnWorkId = await this.sendMonitorCommand(device.deviceId, "Start", sendId).then(
                    (data) => data.workId,
                );
                this.workIds[device.deviceId] = returnWorkId;
            }
        } catch (err) {
            this.log.debug(err);
        }
    }

    async stopMonitor(device) {
        if (device.platformType === "thinq1" && device.deviceId in this.workIds) {
            try {
                await this.sendMonitorCommand(device.deviceId, "Stop", this.workIds[device.deviceId]);
                delete this.workIds[device.deviceId];
            } catch (err) {
                this.log.debug(err);
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
        const tokenUrl = this.lgeapi_url + "oauth2/token";
        const data = {
            grant_type: "refresh_token",
            refresh_token: this.session.refresh_token,
        };

        const timestamp = DateTime.utc().toRFC2822();

        const requestUrl = "/oauth2/token" + qs.stringify(data, { addQueryPrefix: true });
        const signature = this.signature(`${requestUrl}\n${timestamp}`, constants.OAUTH_SECRET_KEY);

        const headers = {
            "lgemp-x-app-key": constants.CLIENT_ID,
            "lgemp-x-signature": signature,
            "lgemp-x-date": timestamp,
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        };
        const resp = await this.requestClient
            .post(tokenUrl, qs.stringify(data), { headers })
            .then((resp) => resp.data)
            .catch((error) => {
                this.log.error(error);
                return;
            });
        this.log.debug(JSON.stringify(resp));
        if (this.session && resp && resp.access_token) {
            this.session.access_token = resp.access_token;
            this.defaultHeaders["x-emp-token"] = this.session.access_token;
            this.refreshTokenInterval && clearInterval(this.refreshTokenInterval);
            this.refreshTokenInterval = setInterval(() => {
                this.refreshNewToken();
            }, (this.session.expires_in - 100) * 1000);
        }
    }

    async getUserNumber() {
        const profileUrl = this.lgeapi_url + "users/profile";
        const timestamp = DateTime.utc().toRFC2822();
        const signature = this.signature(`/users/profile\n${timestamp}`, constants.OAUTH_SECRET_KEY);

        const headers = {
            Accept: "application/json",
            Authorization: "Bearer " + this.session.access_token,
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
            .then((resp) => resp.data)
            .catch((error) => {
                this.log.error(error);
            });
        if (!resp) {
            return;
        }
        this.extractKeys(this, "general", resp);
        this.log.debug(JSON.stringify(resp));
        if (!resp.account) {
            this.log.error("No account found");
            this.log.error(JSON.stringify(resp));
            return;
            deviceModel["MonitoringValue"];
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
            redirect_uri: this.gateway.empSpxUri + "/" + "login/iabClose",
            show_thirdparty_login: "LGE,MYLG",
            division: "ha:T20",
            callback_url: this.gateway.empSpxUri + "/" + "login/iabClose",
        };

        return this.gateway.empSpxUri + "/" + "login/signIn" + qs.stringify(params, { addQueryPrefix: true });
    }

    async sendMonitorCommand(deviceId, cmdOpt, workId) {
        const headers = Object.assign({}, this.defaultHeaders);
        headers["x-client-id"] = constants.API1_CLIENT_ID;
        const data = {
            cmd: "Mon",
            cmdOpt,
            deviceId,
            workId,
        };
        return await this.requestClient
            .post(this.gateway.thinq1Uri + "/" + "rti/rtiMon", { lgedmRoot: data }, { headers })
            .then((res) => res.data.lgedmRoot)
            .then((data) => {
                if ("returnCd" in data) {
                    const code = data.returnCd;
                    if (code === "0106") {
                        this.log.debug(data.returnMsg || "");
                    } else if (code !== "0000") {
                        this.log.debug(code + " - " + data.returnMsg || "");
                    }
                }
                this.log.debug(JSON.stringify(data));
                return data;
            })
            .catch((error) => {
                this.log.error("SendMonitorCommand");
                this.log.error(error);
            });
    }

    async getMonitorResult(device_id, work_id) {
        const headers = Object.assign({}, this.defaultHeaders);
        headers["x-client-id"] = constants.API1_CLIENT_ID;
        const workList = [{ deviceId: device_id, workId: work_id }];
        return await this.requestClient
            .post(this.gateway.thinq1Uri + "/" + "rti/rtiResult", { lgedmRoot: { workList } }, { headers })
            .then((resp) => resp.data.lgedmRoot)
            .then((data) => {
                if ("returnCd" in data) {
                    const code = data.returnCd;
                    if (code === "0106") {
                        return code;
                    } else if (code !== "0000") {
                        this.log.debug(code + " - " + data.returnMsg || "");
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

                return Buffer.from(workList.returnData, "base64");
            })
            .catch((error) => {
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
        } else {
            const url = new URL(to, from);
            return url.href;
        }
    }
    async getDeviceInfo(deviceId) {
        const headers = this.defaultHeaders;
        const deviceUrl = this.resolveUrl(this.gateway.thinq2Uri + "/", "service/devices/" + deviceId);

        return this.requestClient
            .get(deviceUrl, { headers })
            .then((res) => res.data.result)
            .catch((error) => {
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
            } else if (home_result && home_result.result && home_result.resultCode === "0110") {
                this.log.error("Could not receive homes. Please check your app and accept new agreements");
                return "TERMS";
            } else if (!home_result || !home_result.result || !home_result.result.item) {
                return "BLOCKED";
            }
            if (!home_result || !home_result.result || !home_result.result.item) {
                this.log.error("Could not receive homes");
                return;
            }
            this.homes = home_result.result.item;
            this.extractKeys(this, "homes", this.homes);
        }
        const headers = this.defaultHeaders;
        const devices = [];
        if (!this.homes) {
            this.log.error("No homes found");
            return [];
        }
        // get all devices in home
        for (let i = 0; i < this.homes.length; i++) {
            const homeUrl = this.resolveUrl(this.gateway.thinq2Uri + "/", "service/homes/" + this.homes[i].homeId);
            const resp = await this.requestClient
                .get(homeUrl, { headers })
                .then((res) => res.data)
                .catch((error) => {
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
            const homesUrl = this.resolveUrl(this.gateway.thinq2Uri + "/", "service/homes");
            this._homes = await this.requestClient
                .get(homesUrl, { headers })
                .then((res) => res.data)
                .then((data) => {
                    this.log.debug(JSON.stringify(data));
                    return data;
                })
                .catch((error) => {
                    this.log.error(error);
                    error.response && this.log.error(JSON.stringify(error.response.data));
                });
        }

        return this._homes;
    }

    async getDeviceModelInfo(device) {
        if (!device.modelJsonUri) {
            return;
        }
        this.log.debug("Get Device Model Info");
        this.log.debug(JSON.stringify(device));
        const deviceModel = await this.requestClient
            .get(device.modelJsonUri)
            .then((res) => res.data)
            .catch((error) => {
                this.log.error(error);
                return;
            });
        if (deviceModel) {
            await this.setObjectNotExistsAsync(device.deviceId + ".remote", {
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
                    : "";
            }
            if (device.deviceType === 401) {
                if (device.platformType == "thinq2") {
                    await this.createAirRemoteStates(device, deviceModel);
                    await this.createStatistic(device.deviceId);
                    const dataKeys = deviceModel["ControlDevice"];
                    if (deviceModel && dataKeys[0] && dataKeys[0].dataKey) {
                        try {
                            const arr_dataKey = dataKeys[0].dataKey.split("|").pop();
                            deviceModel["folder"] = arr_dataKey.split(".")[0];
                        } catch (error) {
                            this.log.info("Cannot find the snapshot folder!");
                        }
                    }
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
                    this.log.debug("Cannot find the folder!");
                }
                if (deviceModel["ControlWifi"].action) {
                    controlWifi = deviceModel["ControlWifi"].action;
                }
                this.deviceControls[device.deviceId] = controlWifi;
                this.deviceJson[device.deviceId] = deviceModel;

                const controlId = deviceModel["Info"].productType + "Control";
                await this.setObjectNotExistsAsync(device.deviceId + ".remote", {
                    type: "channel",
                    common: {
                        name: "remote control device",
                        role: "state",
                    },
                    native: {},
                });
                if (deviceModel["Info"] && deviceModel["Info"].productType === "REF") {
                    await this.createFridge(device);
                    await this.createStatistic(device.deviceId, 101);
                } else {
                    controlWifi &&
                        Object.keys(controlWifi).forEach(async (control) => {
                            if (control === "WMDownload" && device.platformType === "thinq2") {
                                await this.createremote(device.deviceId, control, deviceModel);
                            }
                            await this.setObjectNotExistsAsync(device.deviceId + ".remote." + control, {
                                type: "state",
                                common: {
                                    name: control,
                                    type: "boolean",
                                    role: "boolean",
                                    write: true,
                                    read: true,
                                },
                                native: {},
                            });
                        });
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
                .then((res) => res.data)
                .catch((error) => {
                    this.log.info("langPackProductTypeUri: " + error);
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
            const thinq2 = deviceModel["thinq2"] ? deviceModel["thinq2"] : "";
            let path = device.deviceId + ".snapshot.";
            if (type) {
                path = path + type + ".";
            }
            if (deviceType === 202) {
                await this.setDryerBlindStates(path);
            }
            const downloadedCourseType = this.coursetypes[device.deviceId].downloadedCourseType
                ? this.coursetypes[device.deviceId].downloadedCourseType
                : "WASHERANDDRYER";
            const smartCourseType = this.coursetypes[device.deviceId].smartCourseType
                ? this.coursetypes[device.deviceId].smartCourseType
                : "WASHERANDDRYER";
            const courseType = this.coursetypes[device.deviceId].courseType
                ? this.coursetypes[device.deviceId].courseType
                : "WASHERANDDRYER";
            const onlynumber = /^-?[0-9]+$/;
            deviceModel["MonitoringValue"] &&
                Object.keys(deviceModel["MonitoringValue"]).forEach(async (state) => {
                    this.getObject(path + state, async (err, obj) => {
                        let common = {
                            name: state,
                            type: "mixed",
                            write: false,
                            read: true,
                        };
                        if (obj) {
                            common = obj.common;
                        }
                        const commons = {};
                        if (deviceModel["MonitoringValue"][state]["targetKey"]) {
                            this.targetKeys[state] = [];
                            const firstKeyName = Object.keys(deviceModel["MonitoringValue"][state]["targetKey"])[0];
                            const firstObject = deviceModel["MonitoringValue"][state]["targetKey"][firstKeyName];
                            Object.keys(firstObject).forEach((targetKey) => {
                                this.targetKeys[state].push(firstObject[targetKey]);
                            });
                        }
                        if (state === courseType) {
                            Object.keys(deviceModel["Course"]).forEach(async (key) => {
                                commons[key] =
                                    constants[this.lang + "Translation"][key] != null
                                        ? constants[this.lang + "Translation"][key]
                                        : key;
                            });
                            commons["NOT_SELECTED"] =
                                constants[this.lang + "Translation"]["NOT_SELECTED"] != null
                                    ? constants[this.lang + "Translation"]["NOT_SELECTED"]
                                    : 0;
                        }
                        if (state === smartCourseType || state === downloadedCourseType) {
                            Object.keys(deviceModel["SmartCourse"]).forEach(async (key) => {
                                commons[key] =
                                    constants[this.lang + "Translation"][key] != null
                                        ? constants[this.lang + "Translation"][key]
                                        : key;
                            });
                            commons["NOT_SELECTED"] =
                                constants[this.lang + "Translation"]["NOT_SELECTED"] != null
                                    ? constants[this.lang + "Translation"]["NOT_SELECTED"]
                                    : 0;
                        }
                        if (deviceModel["MonitoringValue"][state]["valueMapping"]) {
                            if (deviceModel["MonitoringValue"][state]["valueMapping"].max) {
                                common.min = 0; // deviceModel["MonitoringValue"][state]["valueMapping"].min; //reseverdhour has wrong value
                                if (state === "moreLessTime") {
                                    common.max = 200;
                                } else if (state === "timeSetting") {
                                    common.max = 360;
                                } else if (state === "ActiveSavingStatus") {
                                    common.max = 255;
                                } else {
                                    common.max = deviceModel["MonitoringValue"][state]["valueMapping"].max;
                                }
                                common.def = 0;
                            } else {
                                const values = Object.keys(deviceModel["MonitoringValue"][state]["valueMapping"]);
                                values.forEach((value) => {
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
                                        if (value === "NO_ECOHYBRID") common.def = "NO_ECOHYBRID";
                                    } else {
                                        if (value === "NO_ECOHYBRID") common.def = "NO_ECOHYBRID";
                                        commons[value] = value;
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
                            // @ts-ignore
                            await this.setObjectNotExistsAsync(path + state, {
                                type: "state",
                                common: common,
                                native: {},
                            }).catch((error) => {
                                this.log.error(error);
                            });
                        } else {
                            // @ts-ignore
                            obj.common = common;
                            const res = await this.setForeignObjectAsync(this.namespace + "." + path + state, obj);
                        }
                    });
                });
            deviceModel["Value"] &&
                Object.keys(deviceModel["Value"]).forEach((state) => {
                    this.log.debug(path + state); //Problem with 401 device
                    this.getObject(path + state, async (err, obj) => {
                        if (obj) {
                            const common = obj.common;
                            const commons = {};
                            let valueObject = deviceModel["Value"][state]["option"]
                                ? deviceModel["Value"][state]["option"]
                                : null;
                            let valueDefault = deviceModel["Value"][state]["default"]
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
                                    common.min = 0; // deviceModel["MonitoringValue"][state]["valueMapping"].min; //reseverdhour has wrong value
                                    if (state === "moreLessTime") {
                                        common.max = 200;
                                    } else if (state === "timeSetting") {
                                        common.max = 360;
                                    } else if (state === "ActiveSavingStatus") {
                                        common.max = 255;
                                    } else {
                                        common.max = valueObject.max;
                                    }
                                    common.def = valueDefault ? parseFloat(valueDefault) : 0;
                                } else {
                                    const values = Object.keys(valueObject);
                                    values.forEach((value) => {
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
                                // @ts-ignore
                                await this.setObjectNotExistsAsync(path + state, {
                                    type: "state",
                                    common: common,
                                    native: {},
                                }).catch((error) => {
                                    this.log.error(error);
                                });
                            } else {
                                // @ts-ignore
                                obj.common = common;
                                const res = await this.setForeignObjectAsync(this.namespace + "." + path + state, obj);
                            }
                        }
                    });
                });
        }
    }

    async start_mqtt() {
        try {
            const mqttHost = await this.getMqttInfo(constants.MQTT_URL);
            let mqttHostParts = [];
            if (mqttHost && mqttHost.result && mqttHost.result.mqttServer) {
                if (mqttHost.result.apiServer && !mqttHost.result.apiServer.includes("-ats.iot")) {
                    mqttHostParts = mqttHost.result.mqttServer.split(".iot.");
                    this.mqttdata["apiServer"] = mqttHostParts[0] + "-ats.iot." + mqttHostParts[1];
                }
                if (!mqttHost.result.mqttServer.includes("-ats.iot")) {
                    mqttHostParts = mqttHost.result.mqttServer.split(".iot.");
                    this.mqttdata["mqttServer"] = mqttHostParts[0] + "-ats.iot." + mqttHostParts[1];
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
            const client_request = await this.getUser("service/users/client", {});
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
            this.log.info("Start MQTT Connection");
            this.connectMqtt();
        } catch (error) {
            this.log.error("Create CSR ERROR: " + error);
            this.mqttC = {};
        }
    }

    async connectMqtt() {
        try {
            let region = "eu-west-1";
            const split_mqtt = this.mqttdata.mqttServer.split(".");
            if (split_mqtt.length > 1) {
                region = split_mqtt[2];
            }
            this.log.debug("userid: " + this.mqtt_userID);
            const connectData = {
                caCert: Buffer.from(this.mqttdata.amazon, "utf-8"),
                privateKey: Buffer.from(this.mqttdata.privateKey, "utf-8"),
                clientCert: Buffer.from(this.mqttdata.certificatePem, "utf-8"),
                clientId: this.mqtt_userID,
                host: this.mqttdata.mqttServer,
                username: this.userNumber,
                region: region,
                baseReconnectTimeMs: 5000,
            };
            this.mqttC = awsIot.device(connectData);

            this.mqttC.on("offline", () => {
                this.log.info("Thinq MQTT offline");
                this.mqttC.end();
                this.log.debug("MQTT offline! Reconnection in 60 seconds!");
                setTimeout(async () => {
                    this.start_mqtt();
                }, 60000);
            });

            this.mqttC.on("end", () => {
                this.log.info("mqtt end");
            });

            this.mqttC.on("close", () => {
                this.log.info("mqtt closed");
            });

            this.mqttC.on("disconnect", (packet) => {
                this.log.info("MQTT disconnect" + packet);
            });

            this.mqttC.on("connect", () => {
                this.log.info("MQTT connected to: " + this.mqttdata.subscriptions);
                for (const subscription of this.mqttdata.subscriptions) {
                    this.mqttC.subscribe(subscription);
                }
            });

            this.mqttC.on("reconnect", () => {
                this.log.info("MQTT reconnect");
            });

            this.mqttC.on("message", async (topic, message) => {
                try {
                    const monitoring = JSON.parse(message);
                    if (monitoring["data"]) {
                        this.log.debug("Monitoring: " + JSON.stringify(monitoring));
                    }
                    this.log.debug("Monitoring Other: " + JSON.stringify(monitoring));
                    if (
                        monitoring &&
                        monitoring.data &&
                        monitoring.data.state &&
                        monitoring.data.state.reported &&
                        monitoring.type &&
                        monitoring.deviceId &&
                        monitoring.type === "monitoring"
                    ) {
                        this.extractKeys(this, monitoring.deviceId + ".snapshot", monitoring.data.state.reported);
                    }
                } catch (error) {
                    this.log.info("message: " + error);
                }
            });

            this.mqttC.on("error", (error) => {
                this.log.error("MQTT ERROR: " + error);
            });
        } catch (error) {
            this.log.error("MQTT ERROR: " + error);
            this.mqttC = {};
        }
    }

    async getMqttInfo(requestUrl) {
        const headers = {
            "x-country-code": "DE",
            "x-service-phase": "OP",
        };
        return this.requestClient
            .get(requestUrl, { headers })
            .then((res) => res.data)
            .catch((error) => {
                this.log.error("getMqttInfo: " + error);
            });
    }

    async getUser(uri_value, data) {
        const userUrl = this.resolveUrl(this.gateway.thinq2Uri + "/", uri_value);
        const headers = this.defaultHeaders;
        headers["x-client-id"] = this.mqtt_userID;
        return this.requestClient
            .post(userUrl, data, { headers })
            .then((resp) => resp.data)
            .catch((error) => {
                this.log.error(error);
            });
    }

    async sendCommandToDevice(deviceId, values, thinq1, get_sync) {
        const headers = this.defaultHeaders;
        let sync = "control-sync";
        if (get_sync) {
            sync = "control";
        }
        let controlUrl = this.resolveUrl(this.gateway.thinq2Uri + "/", "service/devices/" + deviceId + "/" + sync);
        let data = {
            ctrlKey: "basicCtrl",
            command: "Set",
            ...values,
        };
        if (thinq1) {
            controlUrl = this.gateway.thinq1Uri + "/" + "rti/rtiControl";
            data = values;
        }

        this.log.debug(JSON.stringify(data));

        return this.requestClient
            .post(controlUrl, data, { headers })
            .then((resp) => resp.data)
            .catch((error) => {
                this.log.error("Send failed");
                this.log.error(error);
            });
    }

    sleep(ms) {
        return new Promise((resolve) => {
            this.sleepTimer = setTimeout(resolve, ms);
        });
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            this.updateInterval && clearInterval(this.updateInterval);
            this.refreshTokenInterval && clearInterval(this.refreshTokenInterval);
            this.refreshTimeout && clearTimeout(this.refreshTimeout);
            this.sleepTimer && clearTimeout(this.sleepTimer);

            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    async onStateChange(id, state) {
        if (state) {
            if (!state.ack) {
                try {
                    const secsplit = id.split(".")[id.split(".").length - 2];
                    const lastsplit = id.split(".")[id.split(".").length - 1];
                    const deviceId = id.split(".")[2];
                    if (lastsplit === "sendJSON") {
                        const headers = this.defaultHeaders;
                        const controlUrl = this.resolveUrl(
                            this.gateway.thinq2Uri + "/",
                            "service/devices/" + deviceId + "/control-sync",
                        );
                        const sendData = JSON.parse(state.val);
                        this.log.debug(JSON.stringify(sendData));
                        const sendJ = await this.requestClient
                            .post(controlUrl, sendData, { headers })
                            .then((resp) => resp.data)
                            .catch((error) => {
                                this.log.error("Send failed");
                                this.log.error(error);
                            });
                        this.log.info(JSON.stringify(sendJ));
                        return;
                    }
                    if (secsplit === "Course") {
                        this.courseactual[deviceId][lastsplit] = state.val;
                        this.log.debug(JSON.stringify(this.courseactual[deviceId]));
                        return;
                    }
                    let devType = {};
                    if (this.modelInfos[deviceId] && this.modelInfos[deviceId]["deviceType"]) {
                        devType["val"] = this.modelInfos[deviceId]["deviceType"];
                    } else {
                        devType = await this.getStateAsync(deviceId + ".deviceType");
                    }
                    if (secsplit === "Statistic" && lastsplit === "sendRequest") {
                        if (devType.val > 100 && devType.val < 104) {
                            this.sendStaticRequest(deviceId, "fridge");
                        } else if (devType.val === 401) {
                            this.sendStaticRequest(deviceId, "air");
                        } else {
                            this.sendStaticRequest(deviceId, "other");
                        }
                        this.log.debug(JSON.stringify(this.courseactual[deviceId]));
                        return;
                    } else if (secsplit === "Statistic") {
                        return;
                    }
                    let response = null;
                    let sync = false;
                    if (id.indexOf(".remote.") !== -1) {
                        let no_for = true;
                        let action = id.split(".")[4];
                        let data = {};
                        let onoff = "";
                        let rawData = {};
                        let dev = "";
                        if (devType.val === 401) {
                            if (secsplit === "break") {
                                this.updateHoliday(deviceId, devType, id, state);
                                return;
                            } else if (!this.modelInfos[deviceId] || !this.modelInfos[deviceId]["ControlDevice"]) {
                                this.log.info("Cannot found modelInfos = action: " + action);
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
                            } else if (checkRemote && checkRemote.dataSetList) {
                                this.log.info("The command is not implemented: " + secsplit);
                                return;
                            } else {
                                this.log.info("The command is not implemented");
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
                            const dataTemp = await this.getStateAsync(deviceId + ".snapshot.refState.tempUnit");
                            switch (action) {
                                case "fridgeTemp":
                                    rawData.data = { refState: { fridgeTemp: state.val, tempUnit: dataTemp.val } };
                                    action = "basicCtrl";
                                    rawData.command = "Set";
                                    break;
                                case "freezerTemp":
                                    rawData.data = { refState: { freezerTemp: state.val, tempUnit: dataTemp.val } };
                                    action = "basicCtrl";
                                    rawData.command = "Set";
                                    break;
                                case "expressMode":
                                    const noff = state.val === "IGNORE" ? "OFF" : state.val;
                                    rawData.data = { refState: { expressMode: noff, tempUnit: dataTemp.val } };
                                    action = "basicCtrl";
                                    rawData.command = "Set";
                                    break;
                                case "ecoFriendly":
                                    onoff = state.val ? "ON" : "OFF";
                                    rawData.data = { refState: { ecoFriendly: onoff, tempUnit: dataTemp.val } };
                                    action = "basicCtrl";
                                    rawData.command = "Set";
                                    break;
                                case "LastCourse":
                                    if (state.val > 0) {
                                        this.setCourse(id, deviceId, state);
                                    }
                                    return;
                                case "Favorite":
                                    this.setFavoriteCourse(deviceId);
                                    return;
                                case "WMDownload_Select":
                                    if (state.val === "NOT_SELECTED") {
                                        return;
                                    }
                                    if (
                                        this.deviceJson &&
                                        this.deviceJson[deviceId] &&
                                        this.deviceJson[deviceId]["Course"] &&
                                        this.deviceJson[deviceId]["Course"][state.val]
                                    ) {
                                        this.insertCourse(state.val, deviceId, "Course");
                                        return;
                                    } else if (
                                        this.deviceJson &&
                                        this.deviceJson[deviceId] &&
                                        this.deviceJson[deviceId]["SmartCourse"] &&
                                        this.deviceJson[deviceId]["SmartCourse"][state.val]
                                    ) {
                                        this.insertCourse(state.val, deviceId, "SmartCourse");
                                        return;
                                    } else {
                                        this.log.warn("Command " + action + " and value " + state.val + " not found");
                                        return;
                                    }
                                case "WMDownload":
                                    rawData = await this.createCourse(state, deviceId, action);
                                    this.log.debug(JSON.stringify(this.courseactual[deviceId]));
                                    this.log.debug(JSON.stringify(rawData));
                                    if (rawData.data && Object.keys(rawData).length === 0) {
                                        return;
                                    }
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
                                    break;
                                case "WMStart":
                                    const WMStateDL = await this.getStateAsync(deviceId + ".remote.WMDownload_Select");
                                    if (!WMStateDL) {
                                        this.log.warn("Datapoint WMDownload_Select is not exists!");
                                        return;
                                    } else if (WMStateDL.val === "NOT_SELECTED") {
                                        this.log.warn("Datapoint WMDownload_Select is empty!");
                                        return;
                                    }
                                    rawData = await this.createCourse(state, deviceId, action);
                                    this.log.debug(JSON.stringify(rawData));
                                    await this.setStateAsync(deviceId + ".remote.WMDownload_Select", {
                                        val: "NOT_SELECTED",
                                        ack: true,
                                    });
                                    if (Object.keys(rawData).length === 0) {
                                        return;
                                    }
                                    break;
                                default:
                                    this.log.info("Command " + action + " not found");
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
                                            deviceId + ".snapshot." + type + "." + dataElement,
                                        );
                                        if (dataState) {
                                            data.dataSetList[dataElement] = dataState.val;
                                        }
                                    }
                                }
                            }
                        }

                        if (data && data.command && (rawData.dataKey || rawData.dataGetList)) {
                            this.log.debug(JSON.stringify(data));
                            response = await this.sendCommandToDevice(deviceId, data, false, sync);
                        } else if (data && data.command && data.dataSetList) {
                            this.log.debug(JSON.stringify(data));
                            response = await this.sendCommandToDevice(deviceId, data);
                        } else {
                            rawData.value = rawData.value.replace("{Operation}", state.val ? "Start" : "Stop");
                            data = {
                                lgedmRoot: {
                                    deviceId: deviceId,
                                    workId: uuid.v4(),
                                    cmd: rawData.cmd,
                                    cmdOpt: rawData.cmdOpt,
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
                        const name = object.common.name;
                        const data = { ctrlKey: "basicCtrl", command: "Set", dataKey: name, dataValue: state.val };
                        if (name.indexOf(".operation") !== -1) {
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
                    this.refreshTimeout = setTimeout(async () => {
                        await this.updateDevices();
                    }, 10 * 1000);
                } catch (e) {
                    this.log.error("onStateChange: " + e);
                }
            } else {
                const idArray = id.split(".");
                const lastElement = idArray.pop();
                if (this.targetKeys[lastElement]) {
                    this.targetKeys[lastElement].forEach((element) => {
                        this.setState(idArray.join(".") + "." + element, state.val, true);
                    });
                }
            }
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new LgThinq(options);
} else {
    // otherwise start the instance directly
    new LgThinq();
}
