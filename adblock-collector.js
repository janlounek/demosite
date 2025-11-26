(function() {
    // 🔴 CONFIGURATION: Put your Cloudflare Turnstile Site Key here
    const TURNSTILE_SITE_KEY = "0x4AAAAAACDB4EPBzvAxPOxV";

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

    // --- 1. The Passive Network Check ---
    async function checkResourceBlocked(url) {
        try {
            await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store' });
            return 0; 
        } catch (error) {
            return 1; 
        }
    }

    function getScriptParams() {
        if (document.currentScript) {
            return new URLSearchParams(document.currentScript.src.split('?')[1]);
        }
        const script = document.querySelector('script[src*="adblock-collector.js"]') || 
                       document.querySelector('script[src*="adblock-tracker.js"]');
        if (script && script.src.includes('?')) {
            return new URLSearchParams(script.src.split('?')[1]);
        }
        return new URLSearchParams();
    }

    const scriptParams = getScriptParams();

    // --- 2. Turnstile Loader (Visible for Debugging) ---
    function loadTurnstileToken() {
        return new Promise((resolve) => {
            const container = document.createElement('div');
            container.id = 'turnstile-container';
            
            // 🟢 CHANGED: Widget is now fully visible at the bottom of the body
            // We removed the absolute positioning/opacity hacks
            container.style.marginTop = '20px';
            container.style.marginBottom = '20px';
            
            document.body.appendChild(container);

            const script = document.createElement('script');
            script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
            script.async = true;
            script.defer = true;
            script.onerror = () => resolve(null);
            document.head.appendChild(script);

            const checkTurnstile = () => {
                if (window.turnstile) {
                    try {
                        window.turnstile.render('#turnstile-container', {
                            sitekey: TURNSTILE_SITE_KEY,
                            appearance: 'always', // Force visible
                            callback: function(token) {
                                resolve(token);
                                // Don't remove container yet so you can see it worked
                                // try { document.body.removeChild(container); } catch(e){}
                            },
                            'error-callback': function() {
                                resolve(null);
                            }
                        });
                    } catch (e) {
                        resolve(null);
                    }
                } else {
                    setTimeout(checkTurnstile, 100);
                }
            };
            
            checkTurnstile();
            // Timeout after 8 seconds (give you time to solve it if needed)
            setTimeout(() => { resolve(null); }, 8000); 
        });
    }

    // --- 3. Main Execution ---
    var adBlockDetected = 0;

    getBrowser().then(async browser => {
        
        const turnstilePromise = loadTurnstileToken();
        const checksPromise = Promise.all([
            checkResourceBlocked('https://www.googletagmanager.com/gtm.js?id=GTM-TEST'),
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
        
        const [turnstileToken, networkResults] = await Promise.all([turnstilePromise, checksPromise]);

        if (bait.offsetHeight === 0 || bait.offsetWidth === 0 || window.getComputedStyle(bait).display === 'none') {
            adBlockDetected = 1;
        }
        document.body.removeChild(bait);

        var [gtmRequestBlocked, facebookRequestBlocked, googleAnalyticsRequestBlocked, googleAdsRequestBlocked, bingAdsRequestBlocked] = networkResults;

        function getQueryParam(name) {
            const params = new URLSearchParams(window.location.search);
            return params.get(name) || '';
        }

        var data = {
            recaptchaToken: turnstileToken,
            browser: browser,
            adBlockDetected: adBlockDetected,
            facebookRequestBlocked: facebookRequestBlocked,
            googleAnalyticsRequestBlocked: googleAnalyticsRequestBlocked,
            googleAdsRequestBlocked: googleAdsRequestBlocked,
            bingAdsRequestBlocked: bingAdsRequestBlocked,
            gtmRequestBlocked: gtmRequestBlocked,
            hostname: window.location.hostname,
            pageURL: window.location.href,
            event_name: scriptParams.get('event_name') || 'unknown_event',
            value: scriptParams.get('event_value') || '',
            referrer: document.referrer || '(direct)',
            utm_source: getQueryParam('utm_source'),
            utm_medium: getQueryParam('utm_medium'),
            utm_campaign: getQueryParam('utm_campaign')
        };

        var xhr = new XMLHttpRequest();
        // 🔴 REPLACE WITH YOUR CLOUD FUNCTION URL
        xhr.open("POST", "https://adblock-data-collector-922954175378.europe-west1.run.app", true);
        xhr.setRequestHeader("Content-Type", "application/json");

        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    var response = JSON.parse(xhr.responseText);
                    window.dataLayer = window.dataLayer || [];
                    window.dataLayer.push({
                        'event': 'turnstile_verified', 
                        'bot_score': response.recaptcha_score, 
                        'ad_block_detected': adBlockDetected
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
