/**
 * @file Overwrite default FilterCompiler's platforms configuration.
 * @see {@link https://github.com/AdguardTeam/FiltersCompiler/blob/master/platforms.json}
 *
 * IMPORTANT: During making any changes in this file,
 * the default configuration should also be updated through PR on BitBucket.
 */

module.exports = {
    "WINDOWS": {
        "platform": "windows",
        "path": "windows",
        "expires": "12 hours",
        "configuration": {
            "ignoreRuleHints": false,
            "replacements": null,
        },
        "defines": {
            "adguard": true,
            "adguard_app_windows": true
        }
    },
    "MAC": {
        "platform": "mac",
        "path": "mac",
        "configuration": {
            "ignoreRuleHints": false,
            "replacements": null,
        },
        "defines": {
            "adguard": true,
            "adguard_app_mac": true
        }
    },
    "MAC_V2": {
        "platform": "mac",
        "path": "mac_v2",
        "expires": "12 hours",
        "configuration": {
            "ignoreRuleHints": false,
            "replacements": null,
        },
        "defines": {
            "adguard": true,
            "adguard_app_mac": true
        }
    },

    "ANDROID": {
        "platform": "android",
        "path": "android",
        "configuration": {
            "ignoreRuleHints": false,
            "replacements": null,
        },
        "defines": {
            "adguard": true,
            "adguard_app_android": true
        }
    },
    "EXTENSION_CHROMIUM": {
        "platform": "ext_chromium",
        "path": "extension/chromium",
        "configuration": {
            "removeRulePatterns": [
                // Do not exclude scriptlets which contain '$$' when excluding '$$' and '$@$' rules
                // https://github.com/AdguardTeam/FiltersRegistry/issues/731
                "^((?!#%#).)*\\$\\$|\\$\\@\\$",
                "\\$(.*,)?replace=",
                "important,replace=",
                "\\$(?!((path|domain)=.*])).*app=",
                "\\$network",
                "\\$(?!((path|domain)=.*])).*protobuf(,|=|$)",
                "\\$(?!((path|domain)=.*])).*extension(,|=|$)",
                "\\$hls=",
                ",hls=",
                "\\$jsonprune=",
                ",jsonprune=",
                "\\$(?!((path|domain)=.*])).*referrerpolicy(,|=|$)",
                "\\$(?!((path|domain)=.*])).*content(,|$)"
            ],
            "replacements": null,
            "ignoreRuleHints": false
        },
        "defines": {
            "adguard": true,
            "adguard_ext_chromium": true
        }
    },
    "EXTENSION_EDGE": {
        "platform": "ext_edge",
        "path": "extension/edge",
        "configuration": {
            "removeRulePatterns": [
                // Do not exclude scriptlets which contain '$$' when excluding '$$' and '$@$' rules
                // https://github.com/AdguardTeam/FiltersRegistry/issues/731
                "^((?!#%#).)*\\$\\$|\\$\\@\\$",
                "\\$(.*,)?replace=",
                "important,replace=",
                "\\$(?!((path|domain)=.*])).*app=",
                "\\$network",
                "\\$(?!((path|domain)=.*])).*protobuf(,|=|$)",
                "\\$(?!((path|domain)=.*])).*extension(,|=|$)",
                "\\$hls=",
                ",hls=",
                "\\$jsonprune=",
                ",jsonprune=",
                "\\$(?!((path|domain)=.*])).*referrerpolicy(,|=|$)",
                "\\$(?!((path|domain)=.*])).*content(,|$)"
            ],
            "replacements": null,
            "ignoreRuleHints": false
        },
        "defines": {
            "adguard": true,
            "adguard_ext_edge": true,
            "adguard_ext_chromium": true
        }
    },
    "EXTENSION_OPERA": {
        "platform": "ext_opera",
        "path": "extension/opera",
        "configuration": {
            "removeRulePatterns": [
                // Do not exclude scriptlets which contain '$$' when excluding '$$' and '$@$' rules
                // https://github.com/AdguardTeam/FiltersRegistry/issues/731
                "^((?!#%#).)*\\$\\$|\\$\\@\\$",
                "\\$(.*,)?replace=",
                "important,replace=",
                "\\$(?!((path|domain)=.*])).*app=",
                "\\$network",
                "\\$(?!((path|domain)=.*])).*protobuf(,|=|$)",
                "\\$(?!((path|domain)=.*])).*extension(,|=|$)",
                "\\$hls=",
                ",hls=",
                "\\$jsonprune=",
                ",jsonprune=",
                "\\$(?!((path|domain)=.*])).*referrerpolicy(,|=|$)",
                "\\$(?!((path|domain)=.*])).*content(,|$)"
            ],
            "replacements": null,
            "ignoreRuleHints": false
        },
        "defines": {
            "adguard": true,
            "adguard_ext_opera": true,
            "adguard_ext_chromium": true
        }
    },
    "EXTENSION_FIREFOX": {
        "platform": "ext_ff",
        "path": "extension/firefox",
        "configuration": {
            "removeRulePatterns": [
                // Do not exclude scriptlets which contain '$$' when excluding '$$' and '$@$' rules
                // https://github.com/AdguardTeam/FiltersRegistry/issues/731
                "^((?!#%#).)*\\$\\$|\\$\\@\\$",
                "\\$(?!((path|domain)=.*])).*app=",
                "\\$network",
                "\\$(?!((path|domain)=.*])).*protobuf(,|=|$)",
                "\\$(?!((path|domain)=.*])).*extension(,|=|$)",
                "\\$hls=",
                ",hls=",
                "\\$jsonprune=",
                ",jsonprune=",
                "\\$(?!((path|domain)=.*])).*referrerpolicy(,|=|$)"

            ],
            "replacements": null,
            "ignoreRuleHints": false
        },
        "defines": {
            "adguard": true,
            "adguard_ext_firefox": true
        }
    },
    "EXTENSION_SAFARI": {
        "platform": "ext_safari",
        "path": "extension/safari",
        "configuration": {
            "removeRulePatterns": [
                // In Safari, 'if-domain' and 'unless-domain' do not support regexps, only '*'
                // https://github.com/AdguardTeam/FiltersRegistry/pull/806
                "\\$domain=\/",
                ",domain=\/",
                // Do not exclude scriptlets which contain '$$' when excluding '$$' and '$@$' rules
                // https://github.com/AdguardTeam/FiltersRegistry/issues/731
                "^((?!#%#).)*\\$\\$|\\$\\@\\$",
                "\\$(?!((path|domain)=.*])).*extension(,|=|$)",
                "\\$(?!((path|domain)=.*])).*removeparam(,|=|$)",
                "\\$(?!((path|domain)=.*])).*removeheader(,|=|$)",
                "\\$(.*,)?mp4",
                "\\$(.*,)?replace=",
                "\\$(?!((path|domain)=.*])).*stealth(,|=|$)",
                "\\$(?!((path|domain)=.*])).*cookie(,|=|$)",
                "important,replace=",
                "\\$(?!((path|domain)=.*])).*app=",
                "\\$(?!((path|domain)=.*])).*protobuf(,|=|$)",
                "\\$redirect=",
                ",redirect=",
                "\\$redirect-rule=",
                ",redirect-rule=",
                "\\$(?!((path|domain)=.*])).*empty(,|$)",
                "\\$webrtc",
                "\\$csp",
                "\\$content$",
                "\\$network",
                "\\$(?!((path|domain)=.*])).*referrerpolicy(,|=|$)",
                "\\$hls=",
                ",hls=",
                "\\$jsonprune=",
                ",jsonprune="
            ],
            "replacements": null,
            "ignoreRuleHints": false
        },
        "defines": {
            "adguard": true,
            "adguard_ext_safari": true
        }
    },
    "IOS": {
        "platform": "ios",
        "path": "ios",
        "configuration": {
            "removeRulePatterns": [
                // In Safari, 'if-domain' and 'unless-domain' do not support regexps, only '*'
                // https://github.com/AdguardTeam/FiltersRegistry/pull/806
                "\\$domain=\/",
                ",domain=\/",
                // Do not exclude scriptlets which contain '$$' when excluding '$$' and '$@$' rules
                // https://github.com/AdguardTeam/FiltersRegistry/issues/731
                "^((?!#%#).)*\\$\\$|\\$\\@\\$",
                "\\$(?!((path|domain)=.*])).*extension(,|=|$)",
                "\\$(?!((path|domain)=.*])).*removeparam(,|=|$)",
                "\\$(?!((path|domain)=.*])).*removeheader(,|=|$)",
                "\\$(.*,)?mp4",
                "\\$(.*,)?replace=",
                "\\$(?!((path|domain)=.*])).*stealth(,|=|$)",
                "\\$(?!((path|domain)=.*])).*cookie(,|=|$)",
                "important,replace=",
                "\\$(?!((path|domain)=.*])).*app=",
                "\\$(?!((path|domain)=.*])).*protobuf(,|=|$)",
                "\\$redirect=",
                ",redirect=",
                "\\$redirect-rule=",
                ",redirect-rule=",
                "\\$(?!((path|domain)=.*])).*empty(,|$)",
                "\\$webrtc",
                "\\$csp",
                "\\$content$",
                "\\$network",
                "\\$(?!((path|domain)=.*])).*referrerpolicy(,|=|$)",
                "\\$hls=",
                ",hls=",
                "\\$jsonprune=",
                ",jsonprune="
            ],
            "replacements": null,
            "ignoreRuleHints": false
        },
        "defines": {
            "adguard": true,
            "adguard_app_ios": true
        }
    },
    "EXTENSION_ANDROID_CONTENT_BLOCKER": {
        "platform": "ext_android_cb",
        "path": "extension/android-content-blocker",
        "configuration": {
            "removeRulePatterns": [
                // AdGuard Content Blocker does not support regexps in '$domain', only '*'
                // https://github.com/AdguardTeam/FiltersRegistry/pull/806
                "\\$domain=\/",
                ",domain=\/",
                // Do not exclude scriptlets which contain '$$' when excluding '$$' and '$@$' rules
                // https://github.com/AdguardTeam/FiltersRegistry/issues/731
                "^((?!#%#).)*\\$\\$|\\$\\@\\$",
                "\\$(?!((path|domain)=.*])).*extension(,|=|$)",
                "\\$(?!((path|domain)=.*])).*removeparam(,|=|$)",
                "\\$(?!((path|domain)=.*])).*removeheader(,|=|$)",
                "#%#",
                "#@%#",
                "#\\$#",
                "#@\\$#",
                "\\$(.*,)?mp4",
                "\\$(.*,)?replace=",
                "\\$(?!((path|domain)=.*])).*stealth(,|=|$)",
                "\\$(?!((path|domain)=.*])).*cookie(,|=|$)",
                "\\$(?!((path|domain)=.*])).*empty(,|$)",
                "important,replace=",
                "\\$(?!((path|domain)=.*])).*app=",
                "\\$(?!((path|domain)=.*])).*protobuf(,|=|$)",
                "\\[-ext-",
                "\\$csp",
                ":has\\(",
                ":has-text\\(",
                ":contains\\(",
                ":matches-css\\(",
                ":matches-attr\\(",
                ":matches-property\\(",
                ":xpath\\(",
                ":nth-ancestor\\(",
                ":upward\\(",
                ":remove\\(",
                ":matches-css-before\\(",
                ":matches-css-after\\(",
                ":-abp-has\\(",
                ":-abp-contains\\(",
                "#\\?#",
                "#\\$\\?#",
                "#@\\?#",
                "#@\\$\\?#",
                "\\$redirect=",
                ",redirect=",
                "\\$redirect-rule=",
                ",redirect-rule=",
                "\\$content$",
                "\\$all",
                "\\$network",
                "\\$(?!((path|domain)=.*])).*referrerpolicy(,|=|$)",
                "\\$hls=",
                ",hls=",
                "\\$jsonprune=",
                ",jsonprune="
            ],
            "ignoreRuleHints": false
        },
        "defines": {
            "adguard": true,
            "adguard_ext_android_cb": true
        }
    },
    "EXTENSION_UBLOCK": {
        "platform": "ext_ublock",
        "path": "extension/ublock",
        "configuration": {
            "removeRulePatterns": [
                // Do not exclude scriptlets which contain '$$' when excluding '$$' and '$@$' rules
                // https://github.com/AdguardTeam/FiltersRegistry/issues/731
                "^((?!#%#).)*\\$\\$|\\$\\@\\$",
                "\\$(.*,)?mp4",
                "\\$(.*,)?replace=",
                "\\$(?!((path|domain)=.*])).*stealth(,|=|$)",
                "\\$(?!((path|domain)=.*])).*cookie(,|=|$)",
                "important,replace=",
                "\\$(?!((path|domain)=.*])).*app=",
                "\\$network",
                "\\$(?!((path|domain)=.*])).*protobuf(,|=|$)",
                "\\$(?!((path|domain)=.*])).*extension(,|=|$)",
                "\\$(?!((path|domain)=.*])).*jsinject(,|$)",
                "\\$(?!((path|domain)=.*])).*urlblock(,|$)",
                "\\$(?!((path|domain)=.*])).*content(,|$)",
                "$webrtc",
                "#\\$#@media ",
                "\\$hls=",
                ",hls=",
                "\\$(?!((path|domain)=.*])).*referrerpolicy(,|=|$)",
                "\\$jsonprune=",
                ",jsonprune="
            ],
            "ignoreRuleHints": false,
            "adbHeader": "![Adblock Plus 2.0]"
        },
        "defines": {
            "ext_ublock": true
        }
    }
}
