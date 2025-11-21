(function() {
    // 🔴 CONFIGURATION: Put your reCAPTCHA v3 Site Key here
    const RECAPTCHA_SITE_KEY = "6LfrOxQsAAAAAGJGmBAgA4P7vJBUG0ERPxCLKbQN";

    // --- 1. Silent Detection Utilities ---
    function isBot() {
        return navigator.webdriver || window.outerWidth === 0 || navigator.hardwareConcurrency === 0;
    }

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
            await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store' });
            return 0; 
        } catch (error) {
            return 1; 
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

    // --- 3. reCAPTCHA Loader ---
    function loadRecaptchaToken() {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
            script.async = true;
            script.onerror = () => resolve(null);
            document.head.appendChild(script);

            const waitForGrecaptcha = () => {
                if (window.grecaptcha && window.grecaptcha.execute) {
                    window.grecaptcha.ready(() => {
                        window.grecaptcha.execute(RECAPTCHA_SITE_KEY, {action: 'adblock_check'})
                            .then(token => resolve(token))
                            .catch(() => resolve(null));
                    });
                } else {
                    setTimeout(waitForGrecaptcha, 100);
                }
            };
            
            waitForGrecaptcha();
            setTimeout(() => { resolve(null); }, 2000); 
        });
    }

    // --- 4. Main Execution ---
    var adBlockDetected = 0;

    getBrowser().then(async browser => {
        var isBotDetected = isBot() ? 1 : 0;
        var event_name = getEventNameFromRequestURL();
        var event_value = getValueFromRequestURL();

        const recaptchaPromise = loadRecaptchaToken();

        const checksPromise = Promise.all([
            checkResourceBlocked('https://www.googletagmanager.com/gtm.js?id=GTM-TQP4WV7B'),
            checkResourceBlocked('https://connect.facebook.net/en_US/fbevents.js'),
            checkResourceBlocked('https://www.google-analytics.com/analytics.js'),
            checkResourceBlocked('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'),
            checkResourceBlocked('https://bat.bing.com/bat.js')
        ]);

        var bait = document.createElement('div');
        bait.innerHTML = '&nbsp;';
        bait.className = 'pub_300x250 pub_728x90 text-ad textAd text_ad text_ads text-ads text-ad-links';
        bait.style.cssText = 'width:1px;height:1px;position:absolute;left:-10000px;top:-10000px;';
        document.body.appendChild(bait);
        
        const [recaptchaToken, networkResults] = await Promise.all([recaptchaPromise, checksPromise]);

        if (bait.offsetHeight === 0 || bait.offsetWidth === 0 || window.getComputedStyle(bait).display === 'none') {
            adBlockDetected = 1;
        }
        document.body.removeChild(bait);

        var [gtmRequestBlocked, facebookRequestBlocked, googleAnalyticsRequestBlocked, googleAdsRequestBlocked, bingAdsRequestBlocked] = networkResults;

        var data = {
            recaptchaToken: recaptchaToken,
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

        // --- 🚀 NEW: Receive Score & Push to DataLayer ---
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    var response = JSON.parse(xhr.responseText);
                    
                    // Initialize dataLayer if it doesn't exist
                    window.dataLayer = window.dataLayer || [];
                    
                    // Push the event
                    window.dataLayer.push({
                        'event': 'recaptcha_verified',
                        'recaptcha_score': response.recaptcha_score, // The score (0.0 - 1.0)
                        'ad_block_detected': adBlockDetected, // Useful for GTM triggers
                        'is_bot_flag': isBotDetected
                    });

                } catch (e) {
                    console.warn("Failed to parse analytics response", e);
                }
            }
        };

        xhr.onerror = function () { console.warn("Analytics upload failed"); };
        xhr.send(JSON.stringify(data));
    });
})();
