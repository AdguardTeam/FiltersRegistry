// Aborts execution of a script when it attempts to write the specified property.
// Based on AG_defineProperty (https://github.com/AdguardTeam/deep-override)
//
// Examples:
// AG_abortOnPropertyWrite('String.fromCharCode');
//
// @param property property or properties chain
// @param debug optional, if true - we will print warning when script is aborted.
var AG_abortOnPropertyWrite = function(property, debug) {
    var magic = Math.random().toString(36).substr(2, 8);
    AG_defineProperty(property, {
        beforeSet: function() {
            if (debug) {
                console.warn('AdGuard aborted property write: ' + property);
            }
            throw new ReferenceError(magic);
        }
    });

    var baseOnError = window.onerror;
    window.onerror = function(msg) {
        if (typeof msg === 'string' && msg.indexOf(magic) !== -1) {
            if (debug) {
                console.warn('AdGuard has caught window.onerror: ' + property);
            }
            return true;
        }
        if (baseOnError instanceof Function) {
            return baseOnError.apply(this, arguments);
        }
    };
}

// Aborts execution of a script when it attempts to read the specified property.
// Based on AG_defineProperty (https://github.com/AdguardTeam/deep-override)
//
// Examples:
// AG_abortOnPropertyRead('String.fromCharCode');
//
// @param property property or properties chain
// @param debug optional, if true - we will print warning when script is aborted.
var AG_abortOnPropertyRead = function(property, debug) {
    var magic = Math.random().toString(36).substr(2, 8);
    AG_defineProperty(property, {
        beforeGet: function() {
            if (debug) {
                console.warn('AdGuard aborted property read: ' + property);
            }
            throw new ReferenceError(magic);
        }
    });

    var baseOnError = window.onerror;
    window.onerror = function(msg) {
        if (typeof msg === 'string' && msg.indexOf(magic) !== -1) {
            if (debug) {
                console.warn('AdGuard has caught window.onerror: ' + property);
            }
            return true;
        }
        if (baseOnError instanceof Function) {
            return baseOnError.apply(this, arguments);
        }
    };
}

// Aborts execution of an inline script when it attempts to access the specified property 
// AND content of the <script> element matches specified regular expression.
// Based on AG_defineProperty (https://github.com/AdguardTeam/deep-override)
//
// Examples:
// AG_abortInlineScript(/zfgloadedpopup|zfgloadedpushopt/, 'String.fromCharCode');
//
// @param regex regular expression that the inline script contents must match
// @param property property or properties chain
// @param debug optional, if true - we will print warning when script is aborted.
var AG_abortInlineScript = function(regex, property, debug) {
    var getCurrentScript = function() {
        if ('currentScript' in document) {
            return document.currentScript;
        } else {
            var scripts = document.getElementsByTagName('script');
            return scripts[scripts.length - 1];
        }
    }

    var magic = Math.random().toString(36).substr(2, 8);
    var ourScript = getCurrentScript();
    AG_defineProperty(property, {
        beforeGet: function() {
            var currentScript = getCurrentScript();
            if (currentScript instanceof HTMLScriptElement &&
                currentScript !== ourScript &&
                currentScript.src === '' &&
                regex.test(currentScript.textContent)) {

                if (debug) {
                    console.warn('AdGuard aborted execution of an inline script');
                }
                throw new ReferenceError(magic);
            }
        }
    });

    var baseOnError = window.onerror;
    window.onerror = function(msg) {
        if (typeof msg === 'string' && msg.indexOf(magic) !== -1) {
            if (debug) {
                console.warn('AdGuard has caught window.onerror: ' + property);
            }
            return true;
        }
        if (baseOnError instanceof Function) {
            return baseOnError.apply(this, arguments);
        }
    };
}

// Examples:
// AG_removeCookie('/REGEX/')
// AG_removeCookie('part of the cookie name')
var AG_removeCookie = function(pattern) {
    var regex = /./;
    if (/^\/.+\/$/.test(pattern)) {
        regex = new RegExp(pattern.slice(1, -1));
    } else if (pattern !== '') {
        regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }

    var removeCookieFromHost = function(cookieName, hostName) {
        var cookieSpec = cookieName + '=';
        var domain1 = '; domain=' + hostName;
        var domain2 = '; domain=.' + hostName;
        var path = '; path=/';
        var expiration = '; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = cookieSpec + expiration;
        document.cookie = cookieSpec + domain1 + expiration;
        document.cookie = cookieSpec + domain2 + expiration;
        document.cookie = cookieSpec + path + expiration;
        document.cookie = cookieSpec + domain1 + path + expiration;
        document.cookie = cookieSpec + domain2 + path + expiration;
    }

    var removeCookie = function() {
        var cookies = document.cookie.split(';');
        var iCookies = cookies.length;

        while (iCookies--) {
            cookieStr = cookies[iCookies];
            var pos = cookieStr.indexOf('=');
            if (pos === -1) {
                continue;
            }
            var cookieName = cookieStr.slice(0, pos).trim();
            if (!regex.test(cookieName)) {
                continue;
            }

            var hostParts = document.location.hostname.split('.');
            for (var i = 0; i < hostParts.length - 1; i++) {
                var hostName = hostParts.slice(i).join('.');
                if (hostName) {
                    removeCookieFromHost(cookieName, hostName);
                }
            }
        }
    };
    removeCookie();
    window.addEventListener('beforeunload', removeCookie);
};

// Examples
// AG_setConstant('property.chain', 'const value')
// AG_setConstant('property.chain', 'true') // defines boolean (true), same for false;
// AG_setConstant('property.chain', '123') // defines Number 123;
// AG_setConstant('property.chain', 'noopFunc') // defines function(){};
// AG_setConstant('property.chain', 'trueFunc') // defines function(){return true};
// AG_setConstant('property.chain', 'falseFunc') // defines function(){return false};
var AG_setConstant = function(property, value) {
    if (value === 'undefined') {
        value = undefined;
    } else if (value === 'false') {
        value = false;
    } else if (value === 'true') {
        value = true;
    } else if (value === 'noopFunc') {
        value = function() {};
    } else if (value === 'trueFunc') {
        value = function() {
            return true;
        };
    } else if (value === 'falseFunc') {
        value = function() {
            return false;
        };
    } else if (/^\d+$/.test(value)) {
        value = parseFloat(value);
        if (isNaN(value)) {
            return;
        }
        if (Math.abs(value) > 0x7FFF) {
            return;
        }
    } else {
        return;
    }

    var aborted = false;
    var mustAbort = function(newValue) {
        if (aborted) {
            return true;
        }
        if (newValue !== undefined && value !== undefined && typeof newValue !== typeof value) {
            aborted = true;
        }
        return aborted;
    };

    AG_defineProperty(property, {
        get: function() {
            return value;
        },
        set: function(newValue) {
            if (mustAbort(newValue)) {
                value = newValue;
            }
        }
    });
}