//v1.7
/*
options:
write //set common write variable to true
forceIndex //instead of trying to find names for array entries, use the index as the name
channelName //set name of the root channel
preferedArrayName //set key to use this as an array entry name
autoCast (true false) // make JSON.parse to parse numbers correctly
descriptions: Object of names for state keys
checkvalue (true false) // write only when there are changes
checkType (true false) // Change data point type
firstload (true false) actual checkType
*/
const JSONbig = require("json-bigint")({ storeAsString: true });
module.exports = class Json2iob {
    constructor(adapter) {
        this.adapter = adapter;
        this.alreadyCreatedObjects = {};
        this.checkTypes = {};
        this.checkValues = {};
    }

    async parse(path, element, options) {
        try {
            if (element === null || element === undefined) {
                this.adapter.log.debug("Cannot extract empty: " + path);
                return;
            }

            const objectKeys = Object.keys(element);
            let obj_state = null;
            if (!options || !options.write) {
                if (!options) {
                    options = { write: false };
                } else {
                    options["write"] = false;
                }
            }

            if (typeof element === "string" || typeof element === "number") {
                const lastPathElement = path.split(".").pop();
                //only e2-openwebif
                if (element === "false") element = false;
                if (element === "true") element = true;
                //only e2-openwebif
                if (!this.alreadyCreatedObjects[path]) {
                    await this.adapter
                        .setObjectNotExistsAsync(path, {
                            type: "state",
                            common: {
                                name: lastPathElement,
                                role: this.getRole(element, options.write),
                                type: element != null ? typeof element : "mixed",
                                write: options.write,
                                read: true,
                            },
                            native: {},
                        })
                        .then(() => {
                            this.alreadyCreatedObjects[path] = true;
                            this.checkTypes[path] = element != null ? typeof element : "mixed";
                        })
                        .catch((error) => {
                            this.adapter.log.error(error);
                        });
                }
                if ((this.checkValues[path] != null && this.checkValues[path] != element) || !options.checkvalue) {
                    this.checkValues[path] = element;
                    const types = element != null ? typeof element : "mixed";
                    if (options.firstload) {
                        obj_state = await this.adapter.getObjectAsync(path);
                        if (obj_state && obj_state.common && obj_state.common.type) {
                            this.checkTypes[path] = obj_state.common.type;
                        }
                    }
                    if (options.checkType && this.checkTypes[path] != null && this.checkTypes[path] != types) {
                        try {
                            if (!options.firstload || !obj_state) {
                                obj_state = await this.adapter.getObjectAsync(path);
                            }
                            obj_state.common.type = types;
                            await this.adapter.setObjectAsync(path, obj_state);
                            this.checkTypes[path] = types;
                            this.adapter.log.debug(this.checkTypes[path] + " Change " + types + " - " + path);
                        } catch (error) {
                            this.adapter.log.error("Error change types: " + path + " " + JSON.stringify(element));
                            this.adapter.log.error(error);
                        }
                    }
                    this.adapter.setState(path, element, true);
                }

                return;
            }
            if (!this.alreadyCreatedObjects[path]) {
                await this.adapter
                    .setObjectNotExistsAsync(path, {
                        type: "folder",
                        common: {
                            name: options.channelName || path.split(".").pop(),
                            write: false,
                            read: true,
                        },
                        native: {},
                    })
                    .then(() => {
                        this.alreadyCreatedObjects[path] = true;
                        options.channelName = null;
                    })
                    .catch((error) => {
                        this.adapter.log.error(error);
                    });
            }
            if (Array.isArray(element)) {
                await this.extractArray(element, "", path, options);
                return;
            }

            for (const key of objectKeys) {
                if (this.isJsonString(element[key]) && options.autoCast) {
                    try {
                        element[key] = JSONbig.parse(element[key]);
                    } catch (e) {
                        this.adapter.log.warn("JSONbig: " + e);
                    }
                }
                const path_key = path + "." + key;
                if (Array.isArray(element[key])) {
                    await this.extractArray(element, key, path, options);
                } else if (element[key] != null && typeof element[key] === "object") {
                    await this.parse(path_key, element[key], options);
                } else {
                    //only e2-openwebif
                    if (element[key] == "false") element[key] = false;
                    if (element[key] == "true") element[key] = true;
                    //only e2-openwebif
                    obj_state = null;
                    const type = element[key] != null ? typeof element[key] : "mixed";
                    if (!this.alreadyCreatedObjects[path_key]) {
                        let objectName = key;
                        if (options.descriptions && options.descriptions[key]) {
                            objectName = options.descriptions[key];
                        }
                        const common = {
                            name: objectName,
                            role: this.getRole(element[key], options.write),
                            type: type,
                            write: options.write,
                            read: true,
                        };
                        await this.adapter
                            .setObjectNotExistsAsync(path_key, {
                                type: "state",
                                common: common,
                                native: {},
                            })
                            .then(() => {
                                this.alreadyCreatedObjects[path_key] = true;
                                this.checkTypes[path_key] = type;
                            })
                            .catch((error) => {
                                this.adapter.log.error(error);
                            });
                    }
                    //only e2-openwebif
                    if (key === "longdesc") {
                        try {
                            element[key] = element[key].toString().replace(/&quot;/g, '"');
                        } catch (e) {
                            this.adapter.log.error("Replace: " + e);
                        }
                    }
                    //only e2-openwebif
                    if (
                        (this.checkValues[path_key] != null && this.checkValues[path_key] != element[key]) ||
                        !options.checkvalue
                    ) {
                        this.checkValues[path_key] = element[key];
                        if (options.firstload) {
                            obj_state = await this.adapter.getObjectAsync(path_key);
                            if (obj_state && obj_state.common && obj_state.common.type) {
                                this.checkTypes[path_key] = obj_state.common.type;
                            }
                        }
                        if (
                            this.checkTypes[path_key] != null &&
                            this.checkTypes[path_key] != type &&
                            options.checkType
                        ) {
                            try {
                                if (!options.firstload || !obj_state) {
                                    obj_state = await this.adapter.getObjectAsync(path_key);
                                }
                                obj_state.common.type = type;
                                await this.adapter.setObjectAsync(path_key, obj_state);
                                this.checkTypes[path_key] = type;
                                this.adapter.log.debug(
                                    this.checkTypes[path_key] + " Change " + type + " - " + path_key,
                                );
                            } catch (error) {
                                this.adapter.log.error("Error change types: " + path + " " + JSON.stringify(element));
                                this.adapter.log.error(error);
                            }
                        }
                        this.adapter.setState(path_key, element[key], true);
                    }
                }
            }
        } catch (error) {
            this.adapter.log.error("Error extract keys: " + path + " " + JSON.stringify(element));
            this.adapter.log.error(error);
        }
    }
    async extractArray(element, key, path, options) {
        try {
            if (key) {
                element = element[key];
            }
            for (let index in element) {
                const arrayElement = element[index];
                // @ts-ignore
                index = parseInt(index) + 1;
                // @ts-ignore
                if (index < 10) {
                    index = "0" + index;
                }
                let arrayPath = key + index;

                if (typeof arrayElement === "string" && key != "") {
                    await this.parse(path + "." + key + "." + arrayElement, arrayElement, options);
                    continue;
                }
                if (typeof arrayElement[Object.keys(arrayElement)[0]] === "string") {
                    arrayPath = arrayElement[Object.keys(arrayElement)[0]];
                }
                for (const keyName of Object.keys(arrayElement)) {
                    if (keyName.endsWith("Id") && arrayElement[keyName] != null) {
                        if (arrayElement[keyName] && arrayElement[keyName].replace) {
                            arrayPath = arrayElement[keyName].replace(/\./g, "");
                        } else {
                            arrayPath = arrayElement[keyName];
                        }
                    }
                }
                for (const keyName in Object.keys(arrayElement)) {
                    if (keyName.endsWith("Name")) {
                        if (arrayElement[keyName] && arrayElement[keyName].replace) {
                            arrayPath = arrayElement[keyName].replace(/\./g, "");
                        } else {
                            arrayPath = arrayElement[keyName];
                        }
                    }
                }

                if (arrayElement.id) {
                    if (arrayElement.id.replace) {
                        arrayPath = arrayElement.id.replace(/\./g, "");
                    } else {
                        arrayPath = arrayElement.id;
                    }
                }
                if (arrayElement.name) {
                    arrayPath = arrayElement.name.replace(/\./g, "");
                }
                if (arrayElement.label) {
                    arrayPath = arrayElement.label.replace(/\./g, "");
                }
                if (arrayElement.labelText) {
                    arrayPath = arrayElement.labelText.replace(/\./g, "");
                }
                if (arrayElement.start_date_time) {
                    arrayPath = arrayElement.start_date_time.replace(/\./g, "");
                }
                if (options.preferedArrayName && options.preferedArrayName.indexOf("+") !== -1) {
                    const preferedArrayNameArray = options.preferedArrayName.split("+");
                    if (arrayElement[preferedArrayNameArray[0]]) {
                        const element0 = arrayElement[preferedArrayNameArray[0]].replace(/\./g, "").replace(/ /g, "");
                        let element1 = "";
                        if (preferedArrayNameArray[1].indexOf("/") !== -1) {
                            const subArray = preferedArrayNameArray[1].split("/");
                            const subElement = arrayElement[subArray[0]];
                            if (subElement && subElement[subArray[1]] !== undefined) {
                                element1 = subElement[subArray[1]];
                            } else if (arrayElement[subArray[1]] !== undefined) {
                                element1 = arrayElement[subArray[1]];
                            }
                        } else {
                            element1 = arrayElement[preferedArrayNameArray[1]].replace(/\./g, "").replace(/ /g, "");
                        }
                        arrayPath = element0 + "-" + element1;
                    }
                } else if (options.preferedArrayName && options.preferedArrayName.indexOf("/") !== -1) {
                    const preferedArrayNameArray = options.preferedArrayName.split("/");
                    const subElement = arrayElement[preferedArrayNameArray[0]];
                    if (subElement) {
                        arrayPath = subElement[preferedArrayNameArray[1]].replace(/\./g, "").replace(/ /g, "");
                    }
                } else if (options.preferedArrayName && arrayElement[options.preferedArrayName]) {
                    arrayPath = arrayElement[options.preferedArrayName].replace(/\./g, "");
                }

                if (options.forceIndex) {
                    arrayPath = key + index;
                }
                //special case array with 2 string objects
                if (
                    !options.forceIndex &&
                    Object.keys(arrayElement).length === 2 &&
                    typeof Object.keys(arrayElement)[0] === "string" &&
                    typeof Object.keys(arrayElement)[1] === "string" &&
                    typeof arrayElement[Object.keys(arrayElement)[0]] !== "object" &&
                    typeof arrayElement[Object.keys(arrayElement)[1]] !== "object" &&
                    arrayElement[Object.keys(arrayElement)[0]] !== "null"
                ) {
                    let subKey = arrayElement[Object.keys(arrayElement)[0]];
                    let subValue = arrayElement[Object.keys(arrayElement)[1]];
                    const subName = Object.keys(arrayElement)[0] + " " + Object.keys(arrayElement)[1];
                    if (key) {
                        subKey = key + "." + subKey;
                    }
                    //only e2-openwebif
                    if (subValue === "false") subValue = false;
                    if (subValue === "true") subValue = true;
                    //only e2-openwebif
                    const key_subkey = path + "." + subKey;
                    if (!this.alreadyCreatedObjects[key_subkey]) {
                        await this.adapter
                            .setObjectNotExistsAsync(key_subkey, {
                                type: "state",
                                common: {
                                    name: subName,
                                    role: this.getRole(subValue, options.write),
                                    type: subValue != null ? typeof subValue : "mixed",
                                    write: options.write,
                                    read: true,
                                },
                                native: {},
                            })
                            .then(() => {
                                this.alreadyCreatedObjects[key_subkey] = true;
                                this.checkTypes[key_subkey] = subValue != null ? typeof subValue : "mixed";
                            });
                    }
                    if (
                        (this.checkValues[key_subkey] != null && this.checkValues[key_subkey] != subValue) ||
                        !options.checkvalue
                    ) {
                        this.checkValues[key_subkey] = subValue;
                        const types = typeof subValue;
                        let obj_state;
                        if (options.firstload) {
                            obj_state = await this.adapter.getObjectAsync(key_subkey);
                            if (obj_state && obj_state.common && obj_state.common.type) {
                                this.checkTypes[key_subkey] = obj_state.common.type;
                            }
                        }
                        if (
                            this.checkTypes[key_subkey] != null &&
                            this.checkTypes[key_subkey] != types &&
                            options.checkType
                        ) {
                            try {
                                if (!options.firstload || !obj_state) {
                                    obj_state = await this.adapter.getObjectAsync(key_subkey);
                                }
                                obj_state.common.type = types;
                                await this.adapter.setObjectAsync(key_subkey, obj_state);
                                this.checkTypes[key_subkey] = types;
                                this.adapter.log.debug(
                                    this.checkTypes[key_subkey] + " Change " + types + " - " + key_subkey,
                                );
                            } catch (error) {
                                this.adapter.log.error(
                                    "Error change types: " + key_subkey + " " + JSON.stringify(subValue),
                                );
                                this.adapter.log.error(error);
                            }
                        }
                        this.adapter.setState(key_subkey, subValue, true);
                    }
                    continue;
                }
                await this.parse(path + "." + arrayPath, arrayElement, options);
            }
        } catch (error) {
            this.adapter.log.error("Cannot extract array " + path);
            this.adapter.log.error(error);
        }
    }
    isJsonString(str) {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }
    getRole(element, write) {
        if (typeof element === "boolean" && !write) {
            return "indicator";
        }
        if (typeof element === "boolean" && write) {
            return "switch";
        }
        if (typeof element === "number" && !write) {
            return "value";
        }
        if (typeof element === "number" && write) {
            return "level";
        }
        if (typeof element === "string") {
            return "text";
        }
        if (typeof element === "object") {
            return "json";
        }
        return "state";
    }
};
