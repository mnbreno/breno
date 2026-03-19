// MMacaulay - 2019-08-07 - Basic wrappers for security functions some of which are currently not used
// JScript File
// The JavaScript mimicks the classic asp file eLead-V45\elead_track\IncludeFiles\SafeRequest.asp
//
// Master function that calls the four sub security functions

const SafeRequestSectionEnum = {
    FeatureFlags: 0,
    SafeSQL: 1,
    SafeHTML: 2,
    SafeJavaScript: 3,
    General: 4,
    SafeURL: 5
};

const SafeRequestKeyName = {
    BlackList: 0,
    Logging: 1,
    PreCheckRegEx: 2,
    RegEx: 3,
    SafeHTML: 4,
    SafeJavaScript: 5,
    SafeRequest: 6,
    SafeSQL: 7,
    SafeURL: 8,
    Whitelist: 9,
    WhiteList1: 10,
    WhiteList2: 11,
    WhiteList3: 12
};

function SafeRequest(value) {
    return SafeRequestForce(value, false);
}

function SafeRequestForce(value, bForce) {
    try {
        if (GetConfigurationValue(SafeRequestSectionEnum.FeatureFlags, SafeRequestKeyName.SafeRequest) === "1") {
            value = SafeSQL(value);
            value = SafeHTMLForce(value, bForce);
            value = SafeURL(value);
            value = SafeJavaScript(value);
        }
        return value;

    } catch (e) { return value; }
}

// Envisioned to secure SQL if there are any direct SQL AJAX calls
// value: String contents to validate
// TO DO: SPIKE investigate SQL AJAX calls
function SafeSQL(value) {
    try {
        if (GetConfigurationValue(SafeRequestSectionEnum.FeatureFlags, SafeRequestKeyName.SafeSQL) === "1") {
            value = SafeSQL(value);

        }
        return value;

    } catch (e) { return value; }
}

// Used to secure any directly executed HTML 
// TO DO: Will need to parse and only parse the contents within <script> tags
// value - contents to be checked
// bForce if true entire value string will be escaped
// TO DO: if false only <script> contents within the value will be escaped.
function SafeHTMLForce(value, bForce) {
    try {
        if (GetConfigurationValue(SafeRequestSectionEnum.FeatureFlags, SafeRequestKeyName.SafeHTML) === "1") {
            value = escape(value);
        }
        return value;

    } catch (e) { return value; }
}

function SafeHTML(value) {
    return SafeHTMLForce(value, false);
}

// Used to escape JavaScript generated URLS
// value: String contents to validate
// TODO Add logging
function SafeURL(value) {
    try {
        if (GetConfigurationValue(SafeRequestSectionEnum.FeatureFlags, SafeRequestKeyName.SafeURL) === "1") {
            if (GetConfigurationValue(SafeRequestSectionEnum.SafeURL, SafeRequestKeyName.Logging) === "2") {
                LogUrl(value);
            }
            else {
                // check if URL is whitelisted
                if (FindUrl(SafeRequestSectionEnum.SafeURL, SafeRequestKeyName.Whitelist, value) === "False") {
                    value = ""; //This will need to be changed - probably come from the config. Currently wipe out bad urls
                }
            }
        }
        return value;

    } catch (e) { return value; }
}

function ClearSafeRequestCache() {
    blocalStorage = storageAvailable('localStorage');
    if (blocalStorage) {
        localStorage.removeItem("NextFetch");
        localStorage.removeItem("SafeRequest_" + SafeRequestSectionEnum.FeatureFlags.toString() + "_" + SafeRequestKeyName.SafeURL.toString());
        localStorage.removeItem("SafeRequest_" + SafeRequestSectionEnum.SafeURL.toString() + "_" + SafeRequestKeyName.Logging.toString());
    }
}

// Used to escape JavaScript/HTML generated parameters of URLS
// value: String contents to validatea
function SafeURLParameter(value) {
    try {
        if (GetConfigurationValue(SafeRequestSectionEnum.FeatureFlags, SafeRequestKeyName.SafeURL) === "1") {
            value = encodeURIComponent(value);
            value = value.replace("'", "%27");
        }
        return value;

    } catch (e) { return value; }
}

// Envisioned to secure any directly executed JavaScript
// value: String contents to validate
function SafeJavaScript(value) {
    try {
        if (GetConfigurationValue(SafeRequestSectionEnum.FeatureFlags, SafeRequestKeyName.SafeJavaScript) === "1") {
            value = escape(value);
        }
        return value;

    } catch (e) { return value; }
}

// Function executes async call to the ConfigurationBridge 
// GetConfigurationBridge if value is not in cache
// This function is invoked within the promise created in CallConfigurationBridge
// as httpReq.send() is async
function DispatchConfigurationBridge(szQueryString) {
    var rtnVal = "unknown";

    try {
        if (szQueryString.charAt(0) !== "?") {
            szQueryString = "?" + szQueryString;
        }

        var httpReq = new XMLHttpRequest();
        httpReq.withCredentials = true;
        httpReq.onreadystatechange = function () {
            // 0: UNINITIALIZED
            // 1: LOADING
            // 2: LOADED
            // 3: INTERACTIVE
            // 4: COMPLETED
            if (httpReq.readyState === 4 && httpReq.status === 200) {
                return this.responseText;
            }
        };

        // httpReq.setOption 2, 13056 // ignore ssl/cert errors
        var url = GetConfigurationBridgeUrl() + szQueryString;
        httpReq.open("GET", url, false); //, true); //false caused InvalidAccessError, true = async
        //httpReq.timeout = 5000;  // set only after open
        //httpReq.setRequestHeader("Host", window.location.hostname);
        //httpReq.setRequestHeader("Cookie", document.cookie);

        httpReq.send();

    }
    catch (e) {
        return rtnVal;
    }

}

// As the XMLHttpRequest send is async invoke a promise
// so as to invoke the callback assigning the return value from the onreadystatechange event
// defined in DispatchConfigurationBridge
//function CallConfigurationBridge(szQueryString) {
//    return new Promise(resolve => {
//        DispatchConfigurationBridge(szQueryString, resolve);
//    });

//}
var rtnVal = "unknown";

function CallConfigurationBridge(szQueryString) {

    try {
        if (szQueryString.charAt(0) !== "?") {
            szQueryString = "?" + szQueryString;
        }

        var httpReq = new XMLHttpRequest();
        httpReq.withCredentials = true;
        httpReq.onreadystatechange = function () {
            // 0: UNINITIALIZED
            // 1: LOADING
            // 2: LOADED
            // 3: INTERACTIVE
            // 4: COMPLETED
            if (httpReq.readyState === 4 && httpReq.status === 200) {
                rtnVal = this.responseText;
                return rtnVal;
            }
        };

        // httpReq.setOption 2, 13056 // ignore ssl/cert errors
        var url = GetConfigurationBridgeUrl() + szQueryString;
        httpReq.open("GET", url, false); //, true); //false caused InvalidAccessError, true = async
        //httpReq.timeout = 5000; // set only after open
        //httpReq.setRequestHeader("Host", window.location.hostname);
        //httpReq.setRequestHeader("Cookie", document.cookie);

        httpReq.send();

    }
    catch (e) {
        return rtnVal;
    }

    return rtnVal;
}
// Test if localStorage is available
// usage: storageAvailable('localStorage')
// returns: true if provided storage type is available
function storageAvailable(type) {
    var storage;
    try {
        storage = window[type];
        var x = '__storage_test__';
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    }
    catch (e) {
        return e instanceof DOMException && (
            // everything except Firefox
            e.code === 22 ||
            // Firefox
            e.code === 1014 ||
            // test name field too, because code might not be present
            // everything except Firefox
            e.name === 'QuotaExceededError' ||
            // Firefox
            e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
            // acknowledge QuotaExceededError only if there's something already stored
            (storage && storage.length !== 0);
    }
}

// Given a SectionName and a KeyName Fetch the Configuration Value
// First check localStorage cache: localStorage(SectionName|KeyName)
// Then check (via the ConnectionBridge) .Net Cache for XMLNode
// Finally via the ConnectionBridge call the sp
// This function is defined async as the call to CallConfigurationBridge is async 
// and invoked via await.
//async function GetConfigurationValue(SectionName, KeyName) {
function GetConfigurationValue(SectionName, KeyName) {
    // Check cache before we call the bridge
    var bFetch;
    var configValue;
    var cacheKey;
    var nextFetch;
    var sectionNameKeyName;
    var bLocalStorage;
    var rtnValue;

    bFetch = false;
    rtnValue = "";
    cacheKey = "SafeRequest_" + SectionName.toString() + "_" + KeyName.toString();
    blocalStorage = storageAvailable('localStorage');
    if (blocalStorage) {
        nextFetch = localStorage.getItem("NextFetch");
        sectionNameKeyName = localStorage.getItem(cacheKey);

        if (nextFetch == null) {
            bFetch = true;
        }
        else {
            if (new Date() > nextFetch) {
                bFetch = true;
            }
            else {
                if (sectionNameKeyName == null) {
                    bFetch = true;
                }
                else {
                    if (sectionNameKeyName === "unknown" || sectionNameKeyName === "undefined") { //Unknown signifies previous bad xml fetch attempt, retry
                        bFetch = true;
                    }
                }
            }
        }
    }
    else {
        bFetch = true;
    }

    if (bFetch) {
        // note Calling the ConfigurationBriage is invoked using await as CallConfigurationBridge is async
        // configValue = await CallConfigurationBridge("?Type=1&SEC=" + SectionName + "&KEY=" + KeyName);
        CallConfigurationBridge("?Type=1&SEC=" + SectionName.toString() + "&KEY=" + KeyName.toString());
        if (blocalStorage) {

            localStorage.setItem("NextFetch", dateAdd(new Date(), "minute", 60));
            localStorage.setItem(cacheKey, rtnVal);
        }
        rtnValue = rtnVal;
    }
    else {
        if (blocalStorage) {
            rtnValue = localStorage.getItem(cacheKey);
        }

    }
    return rtnValue;
}

//Given a SectionName, KeyName, and Url determine if URL is listed
// First check asp cache: Application(SectionName|KeyName|Url)
// Then check .Net Cache for XMLNode
// Finally via the ConnectionBridge call the sp
//async function FindUrl(SectionName, KeyName, Url) {
function FindUrl(SectionName, KeyName, Url) {
    // Check cache before we call the bridge
    var bFetch;
    var configValue;
    var cacheKey;
    var nextFetch;
    var sectionNameKeyName;
    var bLocalStorage;
    var rtnValue;

    bFetch = false;
    rtnValue = false;
    cacheKey = "SafeRequest_" + SectionName.toString() + "_" + KeyName.toString() + "_" + Url;
    blocalStorage = storageAvailable('localStorage');
    if (blocalStorage) {
        nextFetch = localStorage.getItem("NextFetch");
        sectionNameKeyName = localStorage.getItem(cacheKey);

        if (nextFetch == null) {
            bFetch = true;
        }
        else {
            if (new Date() > nextFetch) {
                bFetch = true;
            }
            else {
                if (sectionNameKeyName == null) {
                    bFetch = true;
                }
                else {
                    if (sectionNameKeyName === "unknown" || sectionNameKeyName === "undefined") { //Unknown signifies previous bad xml fetch attempt, retry
                        bFetch = true;
                    }
                }
            }
        }
    }
    else {
        bFetch = true;
    }

    if (bFetch) {
        // note Calling the ConfigurationBriage is invoked using await as CallConfigurationBridge is async
        //will return true bool, 1=GetValue, 2=GetValues,3=ClearCache,4=FindUrl,5=Log
        //configValue = await CallConfigurationBridge("?Type=4&SEC=" + SectionName + "&KEY=" + KeyName + "&URL=" + Url);
        configValue = CallConfigurationBridge("?Type=4&SEC=" + SectionName.toString() + "&KEY=" + KeyName.toString() + "&URL=" + encodeURIComponent(Url));
        if (blocalStorage) {

            localStorage.setItem("NextFetch", dateAdd(new Date(), "minute", 60));
            localStorage.setItem(cacheKey, configValue);
        }
        rtnValue = configValue;
    }
    else {
        if (blocalStorage) {
            rtnValue = localStorage.getItem(cacheKey);
        }

    }
    return rtnValue;
}

// Log the given url via the ConnectionBridge 
//async function LogUrl(Url) {
function LogUrl(Url) {
    // note Calling the ConfigurationBriage is invoked using await as CallConfigurationBridge is async
    // AppID:  SafeRequest = 0, SafeSQL = 1, SafeHTML = 2, SafeURL = 3, SafeJavaScript = 4  
    WriteEntryToDB(3, Url);
}

// Log the given url via the ConnectionBridge 
//async function WriteEntryToDB(AppID, Message) {
function WriteEntryToDB(AppID, Message) {
    // note Calling the ConfigurationBriage is invoked using await as CallConfigurationBridge is async
    // Type: 1=GetValue, 2=GetValues,3=ClearCache,4=FindUrl,5=Log
    //await CallConfigurationBridge("?Type=5&APP=" + AppID + "&MSG=" + Message);
    CallConfigurationBridge("?Type=5&APP=" + AppID + "&MSG=" + Message);
}

function GetConfigurationBridgeUrl() {
    var url;
    // gets absolute url of configurationbridge regardless of environment
    // 5 signifies the amount of fluff url array segments we can cull to get to the parent level
    // IE doesn't recogonize string.repeat
    var slash;
    slash = "../";

    
    var i;
    var urldirpath = "";
    var loopcnt = window.location.href.split("/").length - 5;
    for (i = 1; i <= loopcnt; i++) {
        urldirpath += slash;
    }
    return urldirpath + "fresh/elead-v45/elead_track/includefiles/Configurationbridge.aspx";
}

/**
 * Adds time to a date. Modelled after MySQL DATE_ADD function.
 * Example: dateAdd(new Date(), 'minute', 30)  //returns 30 minutes from now.
 * https://stackoverflow.com/a/1214753/18511
 * 
 * @param date  Date to start with
 * @param interval  One of: year, quarter, month, week, day, hour, minute, second
 * @param units  Number of units of the given interval to add.
 */
function dateAdd(date, interval, units) {
    if (!(date instanceof Date))
        return undefined;
    var ret = new Date(date); //don't change original date
    var checkRollover = function () { if (ret.getDate() != date.getDate()) ret.setDate(0); };
    switch (String(interval).toLowerCase()) {
        case 'year': ret.setFullYear(ret.getFullYear() + units); checkRollover(); break;
        case 'quarter': ret.setMonth(ret.getMonth() + 3 * units); checkRollover(); break;
        case 'month': ret.setMonth(ret.getMonth() + units); checkRollover(); break;
        case 'week': ret.setDate(ret.getDate() + 7 * units); break;
        case 'day': ret.setDate(ret.getDate() + units); break;
        case 'hour': ret.setTime(ret.getTime() + units * 3600000); break;
        case 'minute': ret.setTime(ret.getTime() + units * 60000); break;
        case 'second': ret.setTime(ret.getTime() + units * 1000); break;
        default: ret = undefined; break;
    }
    return ret;
}

