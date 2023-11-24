/**
 * @file Overwrite default FilterCompiler's platforms configuration.
 * @see {@link https://github.com/AdguardTeam/FiltersCompiler/blob/master/platforms.json}
 *
 * IMPORTANT: During making any changes in this file,
 * the default configuration should also be updated through PR on BitBucket.
 */

/**
 * Pattern to check if rule contains `$domain` modifier with regular expression
 *
 * In Safari, `if-domain` and `unless-domain` do not support regexps, only `*`
 * https://github.com/AdguardTeam/FiltersRegistry/pull/806
 *
 * @example
 * ```[$domain=/^inattv\d+\.pro$/]#%#//scriptlet('set-constant', 'config.adv', 'emptyObj')```
 */
const DOMAIN_WITH_REGEXPS_PATTERNS = [
    "\\$domain=\/",
    ",domain=\/",
];

/**
 * Pattern to check if rule contains `$all` modifier
 *
 * @example
 * ```/?t=popunder&$all```
 */
const ALL_MODIFIER_PATTERNS = [
    "\\$all",
];

/**
 * Pattern to check if rule contains `$mp4` modifier
 *
 * @example
 * ```Deprecated, use $redirect=noopmp4-1s instead```
 */
const MP4_MODIFIER_PATTERNS = [
    "\\$(.*,)?mp4",
];

/**
 * Pattern to check if rule contains `$network` modifier
 *
 * @example
 * ```57.128.71.215$network```
 */
const NETWORK_MODIFIER_PATTERNS = [
    "\\$network",
];

/**
 * Pattern to check if rule contains `$webrtc` modifier
 *
 * @example
 * ```Removed and no longer supported```
 */
const WEBRTC_MODIFIER_PATTERNS = [
    "\\$webrtc",
];

/**
 * Pattern to check if rule contains `$csp` modifier
 *
 * @example
 * ```||deloplen.com^$csp=script-src 'none'```
 */
const CSP_MODIFIER_PATTERNS = [
    "\\$csp",
];

/**
 * Pattern to check if rule contains `$$` modifier
 *
 * Do not exclude scriptlets which contain '$$' when excluding '$$' and '$@$' rules
 * https://github.com/AdguardTeam/FiltersRegistry/issues/731
 *
 * @example
 * ```mail.com$$script[tag-content="uabp"][min-length="20000"][max-length="300000"]```
 */
const HTML_FILTERING_MODIFIER_PATTERNS = [
    "^((?!#%#).)*\\$\\$|\\$\\@\\$",
];

/**
 * Pattern to check if rule contains `$protobuf` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!((path|domain)=.*])).*` — negative lookahead to exclude rules like `[$path=...]##.textad,protobuf`
 * - `.*protobuf` — protobuf modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$protobuf` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * Currently it is not supported, but it can be added in the future
 * https://github.com/AdguardTeam/CoreLibs/issues/1778
 */
const PROTOBUF_MODIFIER_PATTERNS = [
    "\\$(?!((path|domain)=.*])).*protobuf(,|=|$)",
];

/**
 * Pattern to check if rule contains `$app` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!((path|domain)=.*])).*` — negative lookahead to exclude rules like `[$path=...]##.textad,[app="ads"]`
 * - `.*app=` — app= modifier itself
 *
 * @example
 * ```@@||imasdk.googleapis.com^$app=tv.htv.app```
 */
const APP_MODIFIER_PATTERNS = [
    "\\$(?!((path|domain)=.*])).*app=",
];

/**
 * Pattern to check if rule contains `$extension` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!((path|domain)=.*])).*` — negative lookahead to exclude rules like `[$path=...]##.textad,extension`
 * - `.*extension` — extension modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$extension` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```@@||radar.cloudflare.com^$elemhide,extension,content```
 */
const EXTENSION_MODIFIER_PATTERNS = [
    "\\$(?!((path|domain)=.*])).*extension(,|=|$)",
];

/**
 * Pattern to check if rule contains only `$content` modifier.
 *
 * @example
 * ```@@||telegram.hr^$content```
 */
const ONLY_CONTENT_MODIFIER_PATTERNS = [
    "\\$content$",
];

/**
 * Pattern to check if rule contains `$content` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!((path|domain)=.*])).*` — negative lookahead to exclude rules like `[$path=...]##.textad,content`
 * - `.*content` — content modifier itself
 * - `(,|$)` — end of line or modifiers divider, as `$content` can be followed by other modifiers (`,`).
 *
 * @example
 * ```@@||dnsleaktest.com^$content,elemhide,jsinject```
 */
const CONTENT_MODIFIER_PATTERNS = [
    "\\$(?!((path|domain)=.*])).*content(,|$)",
];

/**
 * Pattern to check if rule contains `$jsinject` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!((path|domain)=.*])).*` — negative lookahead to exclude rules like `[$path=...]##.textad,jsinject`
 * - `.*jsinject` — jsinject modifier itself
 * - `(,|$)` — end of line or modifiers divider, as `$jsinject` can be followed by other modifiers (`,`).
 *
 * @example
 * ```@@://www.atlassian.com^$elemhide,jsinject,extension```
 */
const JSINJECT_MODIFIER_PATTERNS = [
    "\\$(?!((path|domain)=.*])).*jsinject(,|$)",
];

/**
 * Pattern to check if rule contains `$urlblock` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!((path|domain)=.*])).*` — negative lookahead to exclude rules like `[$path=...]##.textad,urlblock`
 * - `.*urlblock` — urlblock modifier itself
 * - `(,|$)` — end of line or modifiers divider, as `$urlblock` can be followed by other modifiers (`,`).
 *
 * @example
 * ```@@||google.com/settings/ads/onweb$urlblock```
 */
const URLBLOCK_MODIFIER_PATTERNS = [
    "\\$(?!((path|domain)=.*])).*urlblock(,|$)",
];

/**
 * Pattern to check if rule contains `$referrerpolicy` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!((path|domain)=.*])).*` — negative lookahead to exclude rules like `[$path=...]##.textad,referrerpolicy`
 * - `.*referrerpolicy` — referrerpolicy modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$referrerpolicy` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```||yallo.tv^$referrerpolicy=origin```
 */
const REFERRERPOLICY_MODIFIER_PATTERNS = [
    "\\$(?!((path|domain)=.*])).*referrerpolicy(,|=|$)",
];

/**
 * Pattern to check if rule contains `$replace` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!((path|domain)=.*])).*` — negative lookahead to exclude rules like `[$path=...]##.textad,[replace="ads"]`
 * - `.*replace` — replace modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$replace` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```||pubads.g.doubleclick.net/gampad/live/ads?correlator=$replace=/(<VAST[\s\S]*?>)[\s\S]*<\/VAST>/\$1<\/VAST>/```
 */
const REPLACE_MODIFIER_PATTERNS = [
    "\\$(?!((path|domain)=.*])).*replace(,|=|$)",
];

/**
 * Pattern to check if rule contains `$hls` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!((path|domain)=.*])).*` — negative lookahead to exclude rules like `[$path=...]##.textad,[hls="ads"]`
 * - `.*hls` — hls modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$hls` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```||pubads.g.doubleclick.net/ondemand/hls/*.m3u8$hls=/redirector\.googlevideo\.com\/videoplayback[\s\S]*?dclk_video_ads/,domain=10play.com.au```
 */
const HLS_MODIFIER_PATTERNS = [
    "\\$(?!((path|domain)=.*])).*hls(,|=|$)",
];

/**
 * Pattern to check if rule contains `$jsonprune` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!((path|domain)=.*])).*` — negative lookahead to exclude rules like `[$path=...]##.textad,[jsonprune="ads"]`
 * - `.*jsonprune` — jsonprune modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$jsonprune` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```.com/watch?v=$xmlhttprequest,jsonprune=\$..[adPlacements\, adSlots\, playerAds],domain=youtubekids.com|youtube-nocookie.com|youtube.com```
 */
const JSONPRUNE_MODIFIER_PATTERNS = [
    "\\$(?!((path|domain)=.*])).*jsonprune(,|=|$)",
];

/**
 * Pattern to check if rule contains `$removeparam` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!((path|domain)=.*])).*` — negative lookahead to exclude rules like `[$path=...]##.textad,[removeparam="ads"]`
 * - `.*removeparam` — removeparam modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$removeparam` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```$removeparam=fb_ref```
 */
const REMOVEPARAM_MODIFIER_PATTERNS = [
    "\\$(?!((path|domain)=.*])).*removeparam(,|=|$)",
];

/**
 * Pattern to check if rule contains `$removeheader` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!((path|domain)=.*])).*` — negative lookahead to exclude rules like `[$path=...]##.textad,[removeheader="ads"]`
 * - `.*removeheader` — removeheader modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$removeheader` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```||dubznetwork.com^$removeheader=refresh```
 */
const REMOVEHEADER_MODIFIER_PATTERNS = [
    "\\$(?!((path|domain)=.*])).*removeheader(,|=|$)",
];

/**
 * Pattern to check if rule contains `$stealth` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!((path|domain)=.*])).*` — negative lookahead to exclude rules like `[$path=...]##.textad,[stealth="ads"]`
 * - `.*stealth` — stealth modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$stealth` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```@@.php?play_vid=$subdocument,stealth=referrer,domain=xyflv.cc```
 */
const STEALTH_MODIFIER_PATTERNS = [
    "\\$(?!((path|domain)=.*])).*stealth(,|=|$)",
];

/**
 * Pattern to check if rule contains `$cookie` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!((path|domain)=.*])).*` — negative lookahead to exclude rules like `[$path=...]##.textad,cookie`
 * - `.*cookie` — cookie modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$cookie` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```$cookie=_ga```
 */
const COOKIE_MODIFIER_PATTERNS = [
    "\\$(?!((path|domain)=.*])).*cookie(,|=|$)",
];

/**
 * Pattern to check if rule contains `$redirect` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!((path|domain)=.*])).*` — negative lookahead to exclude rules like `[$path=...]##.textad,redirect`
 * - `.*redirect` — redirect modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$redirect` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```||google-analytics.com/analytics.js$script,redirect=google-analytics,domain=~olx.*|~banki.ru|~bigc.co.th```
 */
const REDIRECT_MODIFIER_PATTERNS = [
    "\\$(?!((path|domain)=.*])).*redirect(,|=|$)",
];

/**
 * Pattern to check if rule contains `$redirect-rule` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!((path|domain)=.*])).*` — negative lookahead to exclude rules like `[$path=...]##.textad,redirect-rule`
 * - `.*redirect-rule` — redirect-rule modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$redirect-rule` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```$script,third-party,redirect-rule=noopjs,domain=paraphraser.io```
 */
const REDIRECT_RULE_MODIFIER_PATTERNS = [
    "\\$(?!((path|domain)=.*])).*redirect-rule(,|=|$)",
];

/**
 * Pattern to check if rule contains `$empty` modifier
 * and does not contain non-basic modifiers like `$domain` or `$path`.
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!((path|domain)=.*])).*` — negative lookahead to exclude rules like `[$path=...]##.textad,empty`
 * - `.*empty` — empty modifier itself
 * - `(,|$)` — end of line or modifiers divider, as `$empty` can be followed by other modifiers (`,`).
 *
 * @example
 * ```Deprecated, use $redirect=nooptext instead```
 */
const EMPTY_MODIFIER_PATTERNS = [
    "\\$(?!((path|domain)=.*])).*empty(,|$)",
];

/**
 * Pattern to detect scriptlets and JavaScript rules
 *
 * @example
 * ```w3resource.com#%#//scriptlet('prevent-setTimeout', 'ins.adsbygoogle')```
 * @example
 * ```meczyki.pl#%#!function(){window.YLHH={bidder:{startAuction:function(){}}};}();```
 */
const JAVASCRIPT_RULES_PATTERNS = [
    "#%#",
    "#@%#",
];

/**
 * Pattern to detect CSS rules
 *
 * @example
 * ```windowslite.net#$#body { overflow: auto !important; }```
 */
const CSS_RULES_PATTERNS = [
    "#%#",
    "#@%#",
];

/**
 * Pattern to detect CSS rules with `@media` queries
 *
 * @example
 * ```windowslite.net#$#body { overflow: auto !important; }```
 */
const CSS_MEDIA_RULES_PATTERNS = [
    "#\\$#@media ",
];

/**
 * Pattern to detect Extended CSS rules
 *
 * @example
 * ```xup.in#?##xupab```
 * @example
 * ```lunar.az#?#.sagpanel div[class^="yenisb"]:contains(Reklam)```
 * @example
 * ```haal.fashion#?#div:has(> div > div > div.dfp-ad-unit)```
 */
const EXTENDED_CSS_RULES_PATTERNS = [
    "\\[-ext-",
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
];

/**
 * Used for `EXTENSION_CHROMIUM`, `EXTENSION_EDGE`, and `EXTENSION_OPERA` platforms.
 */
const CHROMIUM_BASED_EXTENSION_PATTERNS = [
    ...HTML_FILTERING_MODIFIER_PATTERNS,
    ...REPLACE_MODIFIER_PATTERNS,
    ...APP_MODIFIER_PATTERNS,
    ...NETWORK_MODIFIER_PATTERNS,
    ...PROTOBUF_MODIFIER_PATTERNS,
    ...EXTENSION_MODIFIER_PATTERNS,
    ...HLS_MODIFIER_PATTERNS,
    ...JSONPRUNE_MODIFIER_PATTERNS,
    ...REFERRERPOLICY_MODIFIER_PATTERNS,
    ...CONTENT_MODIFIER_PATTERNS,
];

/**
 * Used for `EXTENSION_SAFARI` and `IOS` platforms.
 */
const SAFARI_BASED_EXTENSION_PATTERNS = [
    ...DOMAIN_WITH_REGEXPS_PATTERNS,
    ...HTML_FILTERING_MODIFIER_PATTERNS,
    ...EXTENSION_MODIFIER_PATTERNS,
    ...REMOVEPARAM_MODIFIER_PATTERNS,
    ...REMOVEHEADER_MODIFIER_PATTERNS,
    ...MP4_MODIFIER_PATTERNS,
    ...REPLACE_MODIFIER_PATTERNS,
    ...STEALTH_MODIFIER_PATTERNS,
    ...COOKIE_MODIFIER_PATTERNS,
    ...APP_MODIFIER_PATTERNS,
    ...PROTOBUF_MODIFIER_PATTERNS,
    ...REDIRECT_MODIFIER_PATTERNS,
    ...REDIRECT_RULE_MODIFIER_PATTERNS,
    ...EMPTY_MODIFIER_PATTERNS,
    ...WEBRTC_MODIFIER_PATTERNS,
    ...CSP_MODIFIER_PATTERNS,
    ...ONLY_CONTENT_MODIFIER_PATTERNS,
    ...NETWORK_MODIFIER_PATTERNS,
    ...REFERRERPOLICY_MODIFIER_PATTERNS,
    ...HLS_MODIFIER_PATTERNS,
    ...JSONPRUNE_MODIFIER_PATTERNS,
];

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
            "removeRulePatterns": CHROMIUM_BASED_EXTENSION_PATTERNS,
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
            "removeRulePatterns": CHROMIUM_BASED_EXTENSION_PATTERNS,
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
            "removeRulePatterns": CHROMIUM_BASED_EXTENSION_PATTERNS,
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
                ...HTML_FILTERING_MODIFIER_PATTERNS,
                ...APP_MODIFIER_PATTERNS,
                ...NETWORK_MODIFIER_PATTERNS,
                ...PROTOBUF_MODIFIER_PATTERNS,
                ...EXTENSION_MODIFIER_PATTERNS,
                ...HLS_MODIFIER_PATTERNS,
                ...JSONPRUNE_MODIFIER_PATTERNS,
                ...REFERRERPOLICY_MODIFIER_PATTERNS,

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
            "removeRulePatterns": SAFARI_BASED_EXTENSION_PATTERNS,
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
            "removeRulePatterns": SAFARI_BASED_EXTENSION_PATTERNS,
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
                ...DOMAIN_WITH_REGEXPS_PATTERNS,
                ...HTML_FILTERING_MODIFIER_PATTERNS,
                ...EXTENSION_MODIFIER_PATTERNS,
                ...REMOVEPARAM_MODIFIER_PATTERNS,
                ...REMOVEHEADER_MODIFIER_PATTERNS,
                ...JAVASCRIPT_RULES_PATTERNS,
                ...CSS_RULES_PATTERNS,
                ...MP4_MODIFIER_PATTERNS,
                ...REPLACE_MODIFIER_PATTERNS,
                ...STEALTH_MODIFIER_PATTERNS,
                ...COOKIE_MODIFIER_PATTERNS,
                ...EMPTY_MODIFIER_PATTERNS,
                ...APP_MODIFIER_PATTERNS,
                ...PROTOBUF_MODIFIER_PATTERNS,
                ...CSP_MODIFIER_PATTERNS,
                ...EXTENDED_CSS_RULES_PATTERNS,
                ...REDIRECT_MODIFIER_PATTERNS,
                ...REDIRECT_RULE_MODIFIER_PATTERNS,
                ...ONLY_CONTENT_MODIFIER_PATTERNS,
                ...ALL_MODIFIER_PATTERNS,
                ...NETWORK_MODIFIER_PATTERNS,
                ...REFERRERPOLICY_MODIFIER_PATTERNS,
                ...HLS_MODIFIER_PATTERNS,
                ...JSONPRUNE_MODIFIER_PATTERNS,
                ...JSINJECT_MODIFIER_PATTERNS,
                ...URLBLOCK_MODIFIER_PATTERNS,
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
                ...HTML_FILTERING_MODIFIER_PATTERNS,
                ...MP4_MODIFIER_PATTERNS,
                ...REPLACE_MODIFIER_PATTERNS,
                ...STEALTH_MODIFIER_PATTERNS,
                ...COOKIE_MODIFIER_PATTERNS,
                ...APP_MODIFIER_PATTERNS,
                ...NETWORK_MODIFIER_PATTERNS,
                ...PROTOBUF_MODIFIER_PATTERNS,
                ...EXTENSION_MODIFIER_PATTERNS,
                ...JSINJECT_MODIFIER_PATTERNS,
                ...URLBLOCK_MODIFIER_PATTERNS,
                ...CONTENT_MODIFIER_PATTERNS,
                ...WEBRTC_MODIFIER_PATTERNS,
                ...CSS_MEDIA_RULES_PATTERNS,
                ...HLS_MODIFIER_PATTERNS,
                ...REFERRERPOLICY_MODIFIER_PATTERNS,
                ...JSONPRUNE_MODIFIER_PATTERNS,
            ],
            "ignoreRuleHints": false,
            "adbHeader": "![Adblock Plus 2.0]"
        },
        "defines": {
            "ext_ublock": true
        }
    }
}
