(function() {
    // Function to detect if the browser is likely a bot or headless
    function isBot() {
        return navigator.webdriver || window.outerWidth === 0 || navigator.hardwareConcurrency === 0;
    }

    // Function to detect the browser type
    async function getBrowser() {
        var userAgent = navigator.userAgent;

        if (userAgent.indexOf("Edg") > -1) {
            return "Edge";
        } else if (userAgent.indexOf("Firefox") > -1) {
            return "Firefox";
        } else if (userAgent.indexOf("OPR") > -1 || userAgent.indexOf("Opera") > -1) {
            return "Opera";
        } else if (userAgent.indexOf("Vivaldi") > -1) {
            return "Vivaldi";
        } else if (userAgent.indexOf("Brave") > -1 || (navigator.brave && await navigator.brave.isBrave())) {
            return "Brave";
        } else if (userAgent.indexOf("Safari") > -1 && userAgent.indexOf("Chrome") === -1) {
            return "Safari";
        } else if (userAgent.indexOf("Chrome") > -1) {
            return "Chrome";
        } else if (userAgent.indexOf("Trident") > -1 || userAgent.indexOf("MSIE") > -1) {
            return "Internet Explorer";
        } else {
            return "Other";
        }
    }

    function getEventNameFromRequestURL() {
        const params = new URLSearchParams(document.currentScript.src.split('?')[1]);
        const eventName = params.get('event_name');
        return eventName || 'unknown_event';
    }

    function getValueFromRequestURL() {
        const params = new URLSearchParams(document.currentScript.src.split('?')[1]);
        const eventValue = params.get('event_value');
        return eventValue || '';
    }

    function checkScriptBlocked(url) {
        return new Promise((resolve) => {
            var script = document.createElement('script');
            script.src = url;
            script.onload = function() {
                resolve(0); // Not blocked
            };
            script.onerror = function() {
                // Script failed to load, blocked or unavailable
                resolve(1); // Blocked
            };
            document.head.appendChild(script);
        });
    }

    // Utility function to get the value of a cookie by name
    function getCookie(name) {
        var value = "; " + document.cookie;
        var parts = value.split("; " + name + "=");
        if (parts.length === 2) return parts.pop().split(";").shift();
        return "";
    }

    function checkCollectRequestBlocked() {
        return Promise.resolve(0); // Always return 0 (not blocked)
    }

    // Function to check if Google Analytics scripts are blocked (robust version)
    function checkGoogleAnalyticsBlocked() {
        return new Promise((resolve) => {
            checkScriptBlocked('https://www.google-analytics.com/analytics.js').then((analyticsJsBlocked) => {
                checkScriptBlocked('https://www.googletagmanager.com/gtag/js?id=G-111111111').then((gtagJsBlocked) => {
                    var allScriptsBlocked = (analyticsJsBlocked === 1 || gtagJsBlocked === 1) ? 1 : 0;

                    var xhr = new XMLHttpRequest();
                    var collectURL = 'https://www.google-analytics.com/collect?v=1&t=pageview&tid=G-111111111';
                    xhr.open("POST", collectURL, true);
                    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                    xhr.timeout = 2000;
                    xhr.ontimeout = function() {
                        console.warn("Google Analytics collect request timed out.");
                        resolve(1);
                    };
                    xhr.onload = function() {
                        if (xhr.status === 200 || xhr.status === 204) {
                            resolve(allScriptsBlocked === 1 ? 1 : 0);
                        } else {
                            resolve(1);
                        }
                    };
                    xhr.onerror = function() {
                        resolve(1);
                    };
                    xhr.send(null);
                });
            });
        });
    }

function checkFacebookBlocked() {
    return new Promise((resolve) => {
        checkScriptBlocked('https://connect.facebook.net/en_US/fbevents.js').then((fbJsBlocked) => {
            resolve(fbJsBlocked);
        });
    });
}

    // Function to check if Google Ads scripts are blocked (robust version)
    function checkGoogleAdsBlocked() {
        return new Promise((resolve) => {
            // Check if the adsbygoogle.js script is blocked
            checkScriptBlocked('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js').then((adsJsBlocked) => {
                // If the script is blocked, we assume ads are blocked
                resolve(adsJsBlocked);
            });
        });
    }

    function checkGTMBlocked() {
        return new Promise((resolve) => {
            checkScriptBlocked('https://www.googletagmanager.com/gtm.js?id=GTM-T74JQSCZ').then((gtmJsBlocked) => {
                var xhr = new XMLHttpRequest();
                var gtmCollectURL = 'https://www.googletagmanager.com/gtm.js?id=GTM-T74JQSCZ'; // Example GTM request
        
                xhr.open("GET", gtmCollectURL, true);
                xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                xhr.timeout = 2000;
                xhr.ontimeout = function() {
                    console.warn("GTM request timed out.");
                    resolve(1);
                };
                
                xhr.onload = function() {
                    if (xhr.status === 200 || xhr.status === 204) {
                        resolve(gtmJsBlocked === 1 ? 1 : 0);
                    } else {
                        resolve(1); // Blocked
                    }
                };
        
                xhr.onerror = function() {
                    resolve(1); // Blocked
                };
        
                xhr.send(null);  // Send the request
            });
        });
    }

    // Variables to store check results
    var adBlockDetected = 0;

    // Log or use browser information to adjust behavior
    getBrowser().then(browser => {

        var isBotDetected = isBot() ? 1 : 0;

        var event_name = getEventNameFromRequestURL();
        var event_value = getValueFromRequestURL();

        function once(fn) {
            let called = false;
            return function(...args) {
                if (called) return;
                called = true;
                return fn.apply(this, args);
            }
        }

        const sendResult = once(function(results) {
            var [
                gtmRequestBlocked,
                facebookRequestBlocked,
                googleAnalyticsRequestBlocked,
                googleAdsRequestBlocked,
                bingAdsRequestBlocked,
                collectRequestBlocked
            ] = results;

            var data = {
                adBlockDetected: adBlockDetected,
                facebookRequestBlocked: facebookRequestBlocked,
                googleAnalyticsRequestBlocked: googleAnalyticsRequestBlocked,
                googleAdsRequestBlocked: googleAdsRequestBlocked,
                bingAdsRequestBlocked: bingAdsRequestBlocked,
                gtmRequestBlocked: gtmRequestBlocked,
                collectRequestBlocked: collectRequestBlocked,
                browser: browser,
                gacookie: getCookie('_ga'),
                hostname: window.location.hostname,
                pageURL: window.location.href,
                event_name: event_name,
                value: event_value,
                isBotDetected: isBotDetected
            };

            var xhr = new XMLHttpRequest();
            xhr.open("POST", "https://adblock-data-collector-922954175378.europe-west1.run.app", true);
            xhr.setRequestHeader("Content-Type", "application/json");
            const sendErrorToSheet = function(errorMessage) {
                const sheetWebhookURL = "tbd";
                const payload = {
                    time: new Date().toISOString(),
                    domain: window.location.hostname,
                    event: event_name,
                    message: JSON.stringify(errorMessage)
                };
                fetch(sheetWebhookURL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                }).catch(err => {
                    console.error("Failed to notify Google Sheets:", err);
                });
            };

            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4 && xhr.status !== 200 && xhr.status !== 0) {
                    console.error("Failed to send data to the server. Status: " + xhr.status);
                    const errorDetails = {
                        reason: "HTTP Status Error",
                        status: xhr.status,
                        statusText: xhr.statusText,
                        responseText: xhr.responseText.substring(0, 500) // Limit response text length
                    };
                    sendErrorToSheet(errorDetails);
                }
            };
            xhr.onerror = function () {
                console.error("An error occurred while sending data to the server (network error).");
                const errorDetails = {
                    reason: "Network Error",
                    message: "XHR onerror event triggered. Likely a network failure or request was blocked."
                };
                sendErrorToSheet(errorDetails);
            };
            xhr.send(JSON.stringify(data));
        });

        var bait = document.createElement('div');
        bait.innerHTML = '&nbsp;';
        bait.className = 'pub_300x250 pub_728x90 text-ad textAd text_ad text_ads text-ads text-ad-links';
        bait.style.width = '1px';
        bait.style.height = '1px';
        bait.style.position = 'absolute';
        bait.style.left = '-10000px';
        bait.style.top = '-10000px';

        document.body.appendChild(bait);

        setTimeout(function() {
            if (bait.offsetHeight === 0 || bait.offsetWidth === 0 || window.getComputedStyle(bait).display === 'none') {
                adBlockDetected = 1;
            }

            document.body.removeChild(bait);

            // Fallback utility for promise with timeout
            function withFallbackTimeout(promise, ms = 2000) {
                return new Promise((resolve) => {
                    let settled = false;
                    promise.then((v) => {
                        settled = true;
                        resolve(v);
                    }).catch(() => {
                        settled = true;
                        resolve(1);
                    });
                    setTimeout(() => {
                        if (!settled) {
                            console.warn("Fallback timeout fired.");
                            resolve(1);
                        }
                    }, ms);
                });
            }

            Promise.all([
                withFallbackTimeout(checkGTMBlocked()),
                withFallbackTimeout(checkFacebookBlocked()),
                withFallbackTimeout(checkGoogleAnalyticsBlocked()),
                withFallbackTimeout(checkGoogleAdsBlocked()),
                withFallbackTimeout(checkScriptBlocked('https://bat.bing.com/bat.js')),
                withFallbackTimeout(checkCollectRequestBlocked())
            ]).then(results => {
                sendResult(results);
            });
        }, 200);
    });
})();
