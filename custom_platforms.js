// Changes in the platforms configuration:
//
// Temporary excluding cosmetic rules with modifiers from iOS and Safari:
// https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#non-basic-rules-modifiers
// The regular expression that does it is: "^\\[.+?\\].*#(\\$|\\@|\\?|\\@){0,2}#"
// TODO: should be removed after iOS and Safari versions are updated with
// SafariConverterLib v2.0.28 or higher.
//
// Replacing :has with :-abp-has in all filters.
// TODO: remove this when ExtCSS v2.0 is released to all AG products.

module.exports = {
    "WINDOWS": {
        "platform": "windows",
        "path": "windows",
        "configuration": {
            "ignoreRuleHints": false,
            "replacements": [
                {
                    "from": ":has\\(",
                    "to": ":-abp-has("
                }
            ]
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
            "replacements": [
                {
                    "from": ":has\\(",
                    "to": ":-abp-has("
                }
            ]
        },
        "defines": {
            "adguard": true,
            "adguard_app_mac": true
        }
    },
    "MAC_V2": {
        "platform": "mac",
        "path": "mac_v2",
        "configuration": {
            "ignoreRuleHints": false,
            "replacements": [
                {
                    "from": ":has\\(",
                    "to": ":-abp-has("
                }
            ]
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
            "replacements": [
                {
                    "from": ":has\\(",
                    "to": ":-abp-has("
                }
            ]
        },
        "defines": {
            "adguard": true,
            "adguard_app_android": true
        }
    },

    "IOS": {
        "platform": "ios",
        "path": "ios",
        "configuration": {
            "removeRulePatterns": [
                "\\$\\$|\\$\\@\\$",
                "\\$(.*,)?mp4",
                "\\$(.*,)?replace=",
                "\\$stealth",
                ",stealth",
                "\\$cookie",
                ",cookie",
                "important,replace=",
                "\\$(.*,)?app",
                "\\$protobuf",
                "important,protobuf",
                "\\$redirect=",
                ",redirect=",
                "\\$redirect-rule=",
                ",redirect-rule=",
                "\\$empty",
                ",empty",
                "\\$webrtc",
                "\\$csp=",
                "\\$network",
                "^\\[.+?\\].*#(\\$|\\@|\\?|\\@){0,2}#"
            ],
            "replacements": [
                {
                    "from": ":has\\(",
                    "to": ":-abp-has("
                }
            ],
            "ignoreRuleHints": false
        },
        "defines": {
            "adguard": true,
            "adguard_app_ios": true
        }
    },

    "EXTENSION_CHROMIUM": {
        "platform": "ext_chromium",
        "path": "extension/chromium",
        "configuration": {
            "removeRulePatterns": [
                "\\$\\$|\\$\\@\\$",
                "\\$(.*,)?replace=",
                "important,replace=",
                "\\$(.*,)?app",
                "\\$network",
                "\\$protobuf",
                "important,protobuf",
                "\\$extension",
                ",extension"
            ],
            "replacements": [
                {
                    "from": ":has\\(",
                    "to": ":-abp-has("
                }
            ],
            "ignoreRuleHints": false
        },
        "defines": {
            "adguard": true,
            "adguard_ext_chromium": true
        }
    },
    "EXTENSION_FIREFOX": {
        "platform": "ext_ff",
        "path": "extension/firefox",
        "configuration": {
            "removeRulePatterns": [
                "\\$(.*,)?app",
                "\\$network",
                "\\$protobuf",
                "important,protobuf",
                "\\$extension",
                ",extension",
                "\\$\\$|\\$\\@\\$",
                "\\$(.*,)?replace=",
                "important,replace="
            ],
            "replacements": [
                {
                    "from": ":has\\(",
                    "to": ":-abp-has("
                }
            ],
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
                "\\$\\$|\\$\\@\\$",
                "\\$(.*,)?mp4",
                "\\$(.*,)?replace=",
                "\\$stealth",
                ",stealth",
                "\\$cookie",
                ",cookie",
                "important,replace=",
                "\\$(.*,)?app",
                "\\$network",
                "\\$protobuf",
                "important,protobuf",
                "\\$csp",
                "\\$extension",
                ",extension",
                "\\$redirect=",
                ",redirect=",
                "\\$redirect-rule=",
                ",redirect-rule=",
                "\\$empty",
                ",empty",
                "\\$webrtc",
                "^\\[.+?\\].*#(\\$|\\@|\\?|\\@){0,2}#"
            ],
            "replacements": [
                {
                    "from": ":has\\(",
                    "to": ":-abp-has("
                }
            ],
            "ignoreRuleHints": false
        },
        "defines": {
            "adguard": true,
            "adguard_ext_safari": true
        }
    },
    "EXTENSION_EDGE": {
        "platform": "ext_edge",
        "path": "extension/edge",
        "configuration": {
            "removeRulePatterns": [
                "\\$\\$|\\$\\@\\$",
                "\\$(.*,)?mp4",
                "\\$(.*,)?replace=",
                "important,replace=",
                "\\$(.*,)?app",
                "\\$network",
                "\\$protobuf",
                "important,protobuf",
                "\\$extension",
                ",extension",
                "\\$redirect=",
                ",redirect=",
                "\\$redirect-rule=",
                ",redirect-rule=",
                "\\$empty=",
                ",empty=",
                "#%#//scriptlet"
            ],
            "replacements": [
                {
                    "from": ":has\\(",
                    "to": ":-abp-has("
                }
            ],
            "ignoreRuleHints": false
        },
        "defines": {
            "adguard": true,
            "adguard_ext_edge": true
        }
    },
    "EXTENSION_OPERA": {
        "platform": "ext_opera",
        "path": "extension/opera",
        "configuration": {
            "removeRulePatterns": [
                "\\$\\$|\\$\\@\\$",
                "\\$(.*,)?replace=",
                "important,replace=",
                "\\$(.*,)?app",
                "\\$network",
                "\\$protobuf",
                "important,protobuf",
                "\\$extension",
                ",extension"
            ],
            "replacements": [
                {
                    "from": ":has\\(",
                    "to": ":-abp-has("
                }
            ],
            "ignoreRuleHints": false
        },
        "defines": {
            "adguard": true,
            "adguard_ext_opera": true
        }
    },

    "EXTENSION_ANDROID_CONTENT_BLOCKER": {
        "platform": "ext_android_cb",
        "path": "extension/android-content-blocker",
        "configuration": {
            "removeRulePatterns": [
                "\\$\\$|\\$\\@\\$",
                "#%#",
                "#@%#",
                "#\\$#",
                "#@\\$#",
                "\\$(.*,)?mp4",
                "\\$(.*,)?replace=",
                "\\$stealth",
                ",stealth",
                "\\$cookie",
                ",cookie",
                "\\$empty",
                "important,replace=",
                "\\$(.*,)?app",
                "\\$protobuf",
                "important,protobuf",
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
                "^\\[.+?\\].*#(\\$|\\@|\\?|\\@){0,2}#"
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
                "\\$\\$|\\$\\@\\$",
                "\\$(.*,)?mp4",
                "\\$(.*,)?replace=",
                "\\$stealth",
                ",stealth",
                "\\$cookie",
                ",cookie",
                "important,replace=",
                "\\$(.*,)?app",
                "\\$network",
                "\\$protobuf",
                "important,protobuf",
                "\\$extension",
                ",extension",
                "\\$jsinject",
                ",jsinject",
                "\\$urlblock",
                ",urlblock",
                "\\$content",
                ",content",
                "$webrtc",
                "#\\$#@media "
            ],
            "ignoreRuleHints": false,
            "adbHeader": "![Adblock Plus 2.0]"
        },
        "defines": {
            "ext_ublock": true
        }
    }
}
