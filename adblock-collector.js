(function() {
    // --- 1. Silent Detection Utilities ---

    // Detects Bot/Headless browsers
    function isBot() {
        return navigator.webdriver || window.outerWidth === 0 || navigator.hardwareConcurrency === 0;
    }

    // Detects Browser Type
    async function getBrowser() {
        var userAgent = navigator.userAgent;
        if (userAgent.indexOf("Edg") > -1) return "Edge";
        if (userAgent.indexOf("Firefox") > -1) return "Firefox";
        if (userAgent.indexOf("OPR") > -1 || userAgent.indexOf("Opera") > -1) return "Opera";
        if (userAgent.indexOf("Vivaldi") > -1) return "Vivaldi";
        if (userAgent.indexOf("Brave") > -1 || (navigator.brave && await navigator.brave.isBrave())) return "Brave";
        if (userAgent.indexOf("Safari") > -1 && userAgent.indexOf("Chrome") === -1) return "Safari";
        if (userAgent.indexOf("Chrome") > -1) return "Chrome";
        if (userAgent.indexOf("Trident") > -1 || userAgent.indexOf("MSIE") > -1) return "Internet Explorer";
        return "Other";
    }

    // --- 2. The Passive Network Check ---
    
    async function checkResourceBlocked(url) {
        try {
            await fetch(url, { 
                method: 'GET', 
                mode: 'no-cors', 
                cache: 'no-store'
            });
            return 0; // Success: Network path is open
        } catch (error) {
            return 1; // Error: Network path blocked
        }
    }


    function getEventNameFromRequestURL() {
        const params = new URLSearchParams(document.currentScript.src.split('?')[1]);
        return params.get('event_name') || 'unknown_event';
    }

    function getValueFromRequestURL() {
        const params = new URLSearchParams(document.currentScript.src.split('?')[1]);
        return params.get('event_value') || '';
    }

    // --- 4. Main Execution ---

    var adBlockDetected = 0;

    getBrowser().then(browser => {
        var isBotDetected = isBot() ? 1 : 0;
        var event_name = getEventNameFromRequestURL();
        var event_value = getValueFromRequestURL();

        const checks = [
            checkResourceBlocked('https://www.googletagmanager.com/gtm.js?id=GTM-TEST'),
            checkResourceBlocked('https://connect.facebook.net/en_US/fbevents.js'),
            checkResourceBlocked('https://www.google-analytics.com/analytics.js'),
            checkResourceBlocked('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'),
            checkResourceBlocked('https://bat.bing.com/bat.js')
        ];

        var bait = document.createElement('div');
        bait.innerHTML = '&nbsp;';
        bait.className = 'pub_300x250 pub_728x90 text-ad textAd text_ad text_ads text-ads text-ad-links';
        bait.style.cssText = 'width:1px;height:1px;position:absolute;left:-10000px;top:-10000px;';
        document.body.appendChild(bait);

        setTimeout(function() {
            if (bait.offsetHeight === 0 || bait.offsetWidth === 0 || window.getComputedStyle(bait).display === 'none') {
                adBlockDetected = 1;
            }
            document.body.removeChild(bait);

            Promise.all(checks).then(results => {
                var [
                    gtmRequestBlocked,
                    facebookRequestBlocked,
                    googleAnalyticsRequestBlocked,
                    googleAdsRequestBlocked,
                    bingAdsRequestBlocked
                ] = results;

                var data = {
                    adBlockDetected: adBlockDetected,
                    facebookRequestBlocked: facebookRequestBlocked,
                    googleAnalyticsRequestBlocked: googleAnalyticsRequestBlocked,
                    googleAdsRequestBlocked: googleAdsRequestBlocked,
                    bingAdsRequestBlocked: bingAdsRequestBlocked,
                    gtmRequestBlocked: gtmRequestBlocked,
                    browser: browser,
                    hostname: window.location.hostname,
                    pageURL: window.location.href,
                    event_name: event_name,
                    value: event_value,
                    isBotDetected: isBotDetected
                };

                var xhr = new XMLHttpRequest();
                xhr.open("POST", "https://adblock-data-collector-922954175378.europe-west1.run.app", true);
                xhr.setRequestHeader("Content-Type", "application/json");
                xhr.onerror = function () { console.warn("Analytics upload failed"); };
                xhr.send(JSON.stringify(data));
            });
        }, 200);
    });
})();
