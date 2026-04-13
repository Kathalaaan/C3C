(function () {
    var SUPABASE_CONFIG = window.CA365_SUPABASE_CONFIG || {
        url: "https://mccyabufvrtrnxezomqz.supabase.co",
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jY3lhYnVmdnJ0cm54ZXpvbXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTM2ODAsImV4cCI6MjA5MDA4OTY4MH0.l4T8iaeIIDUU7keh72E_Z4m2i1xhx1apN-ctZkeU9RE"
    };

    var hasSupabaseConfig =
        SUPABASE_CONFIG.url &&
        SUPABASE_CONFIG.anonKey &&
        !SUPABASE_CONFIG.url.includes("YOUR_PROJECT") &&
        !SUPABASE_CONFIG.anonKey.includes("YOUR_SUPABASE_ANON_KEY");

    var guardModalId = "ca365-auth-guard-modal";
    var guardStylesId = "ca365-auth-guard-styles";
    var authReturnStorageKey = "ca365-auth-return-to";
    var authReturnQueryKey = "returnTo";

    function normalizeReturnUrl(candidate) {
        if (!candidate) return "";

        try {
            var parsed = new URL(candidate, window.location.href);
            if (parsed.origin !== window.location.origin) return "";
            return parsed.toString();
        } catch (error) {
            console.error("Unable to normalize auth return URL", error);
            return "";
        }
    }

    function persistReturnUrl(value) {
        var normalized = normalizeReturnUrl(value);

        try {
            if (normalized) {
                window.sessionStorage.setItem(authReturnStorageKey, normalized);
                window.localStorage.setItem(authReturnStorageKey, normalized);
                return normalized;
            }

            window.sessionStorage.removeItem(authReturnStorageKey);
            window.localStorage.removeItem(authReturnStorageKey);
        } catch (error) {
            console.error("Unable to persist auth return URL", error);
        }

        return normalized;
    }

    function getInAppBrowserName() {
        var userAgent = navigator.userAgent || "";

        var checks = [
            { name: "Instagram", match: /Instagram/i.test(userAgent) },
            { name: "Facebook", match: /FBAN|FBAV|FB_IAB|FBIOS/i.test(userAgent) },
            { name: "Messenger", match: /Messenger/i.test(userAgent) },
            { name: "Telegram", match: /Telegram/i.test(userAgent) },
            { name: "LinkedIn", match: /LinkedInApp/i.test(userAgent) },
            { name: "Snapchat", match: /Snapchat/i.test(userAgent) },
            { name: "TikTok", match: /BytedanceWebview|musical_ly|TikTok/i.test(userAgent) },
            { name: "WhatsApp", match: /WhatsApp/i.test(userAgent) },
            { name: "Gmail", match: /GSA|Gmail/i.test(userAgent) },
            { name: "Line", match: /Line/i.test(userAgent) }
        ];

        for (var i = 0; i < checks.length; i += 1) {
            if (checks[i].match) return checks[i].name;
        }

        var isEmbeddedIosWebKit =
            /iPhone|iPad|iPod/i.test(userAgent) &&
            /AppleWebKit/i.test(userAgent) &&
            !/Safari/i.test(userAgent);

        var isGenericAndroidWebView =
            /Android/i.test(userAgent) &&
            (/; wv\)/i.test(userAgent) || /\bVersion\/[\d.]+/i.test(userAgent)) &&
            !/Chrome\/[\d.]+ Mobile Safari\/[\d.]+/i.test(userAgent);

        if (isEmbeddedIosWebKit || isGenericAndroidWebView) return "embedded browser";
        return "";
    }

    function getDeviceLabel() {
        var userAgent = navigator.userAgent || "";
        if (/iPhone|iPad|iPod/i.test(userAgent)) return "iPhone or iPad";
        if (/Android/i.test(userAgent)) return "Android phone";
        return "browser";
    }

    function getBrowserLabel() {
        var userAgent = navigator.userAgent || "";
        if (/Edg\//i.test(userAgent)) return "Microsoft Edge";
        if (/OPR\//i.test(userAgent)) return "Opera";
        if (/Firefox\//i.test(userAgent)) return "Firefox";
        if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) return "Google Chrome";
        if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return "Safari";
        return "your browser";
    }

    function getLoginPromptConfig() {
        var inAppBrowserName = getInAppBrowserName();
        var browserLabel = getBrowserLabel();
        var deviceLabel = getDeviceLabel();

        if (inAppBrowserName) {
            return {
                eyebrow: "Login Blocked",
                title: "Open In Your Main Browser",
                copy: "Google sign-in is blocked inside " + (inAppBrowserName === "embedded browser" ? "this in-app browser" : inAppBrowserName + "'s in-app browser") + ". Open this page in Safari, Chrome, or Edge first, then log in to continue.",
                actionLabel: "Open Login Page",
                helper: "If nothing opens, use the app menu and choose Open in browser or Open externally.",
                steps: [
                    "Open the menu in this app browser.",
                    "Choose Open in browser or Open externally.",
                    "When Safari, Chrome, or Edge opens, log in again to access this page."
                ]
            };
        }

        return {
            eyebrow: "Login Required",
            title: "Login Before Access",
            copy: "Please log in before accessing this page. This login gate now appears for desktop browsers and mobile browsers too, including " + browserLabel + " on " + deviceLabel + ".",
            actionLabel: "Go To Login",
            helper: "After login, return here and the page will open normally.",
            steps: [
                "Tap or click the button below.",
                "Sign in with your Google account on the login page.",
                "Come back to this page after login to continue."
            ]
        };
    }

    function tryOpenUrlInMainBrowser(targetUrl) {
        var userAgent = navigator.userAgent || "";
        var encodedUrl = encodeURIComponent(targetUrl);
        var scheme = window.location.protocol.replace(":", "") || "https";
        var plainUrl = targetUrl.replace(/^https?:\/\//i, "");

        if (/Android/i.test(userAgent)) {
            window.location.href = "intent://" + plainUrl + "#Intent;scheme=" + scheme + ";package=com.android.chrome;end";
            window.setTimeout(function () {
                window.location.href = "googlechrome://navigate?url=" + encodedUrl;
            }, 280);
            window.setTimeout(function () {
                window.open(targetUrl, "_blank", "noopener,noreferrer");
            }, 650);
            return;
        }

        if (/iPhone|iPad|iPod/i.test(userAgent)) {
            window.location.href = "googlechromes://" + plainUrl;
            return;
        }

        window.location.href = targetUrl;
    }

    function ensureGuardStyles() {
        if (document.getElementById(guardStylesId)) return;

        var style = document.createElement("style");
        style.id = guardStylesId;
        style.textContent = [
            "body.ca365-auth-guard-open{overflow:hidden !important;}",
            "#" + guardModalId + "{position:fixed;inset:0;z-index:999999;display:none;place-items:center;font-family:'Space Grotesk','Segoe UI',sans-serif;}",
            "#" + guardModalId + ".is-visible{display:grid;}",
            "#" + guardModalId + " .ca365-auth-guard-backdrop{position:absolute;inset:0;background:rgba(5,7,10,.78);backdrop-filter:blur(8px);}",
            "#" + guardModalId + " .ca365-auth-guard-card{position:relative;z-index:1;width:min(92vw,440px);padding:1.15rem 1.15rem 1.35rem;border-radius:28px;background:radial-gradient(circle at top, rgba(204,255,0,.14), transparent 34%), linear-gradient(180deg,#101317 0%,#090b0d 100%);border:1px solid rgba(255,255,255,.12);box-shadow:0 30px 80px rgba(0,0,0,.35);color:#f6f8fb;}",
            "#" + guardModalId + " .ca365-auth-guard-eyebrow{margin:0;color:#cbff20;font-size:.72rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;}",
            "#" + guardModalId + " .ca365-auth-guard-title{margin:.6rem 0 0;font-size:clamp(1.05rem,2.8vw,1.45rem);line-height:1.3;color:#ffffff;}",
            "#" + guardModalId + " .ca365-auth-guard-copy{margin:.95rem 0 0;color:rgba(246,248,251,.82);font-size:.98rem;line-height:1.6;}",
            "#" + guardModalId + " .ca365-auth-guard-steps{display:grid;gap:.72rem;margin-top:1.1rem;}",
            "#" + guardModalId + " .ca365-auth-guard-step{display:grid;grid-template-columns:34px 1fr;gap:.8rem;align-items:start;padding:.78rem .85rem;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);}",
            "#" + guardModalId + " .ca365-auth-guard-step-index{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:linear-gradient(135deg,#cbff20,#8fd300);color:#071100;font-size:.9rem;font-weight:700;}",
            "#" + guardModalId + " .ca365-auth-guard-step-copy{margin:0;color:rgba(246,248,251,.88);font-size:.93rem;line-height:1.55;}",
            "#" + guardModalId + " .ca365-auth-guard-actions{display:grid;gap:.75rem;margin-top:1.1rem;}",
            "#" + guardModalId + " .ca365-auth-guard-primary,#" + guardModalId + " .ca365-auth-guard-secondary{width:100%;min-height:52px;border-radius:14px;font:inherit;font-size:.95rem;font-weight:700;cursor:pointer;}",
            "#" + guardModalId + " .ca365-auth-guard-primary{border:0;background:linear-gradient(135deg,#cbff20,#8fd300);color:#081100;}",
            "#" + guardModalId + " .ca365-auth-guard-secondary{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);color:#ffffff;}",
            "#" + guardModalId + " .ca365-auth-guard-helper{margin:.95rem 0 0;color:rgba(246,248,251,.66);font-size:.88rem;line-height:1.55;}",
            "@media (max-width:560px){#" + guardModalId + " .ca365-auth-guard-card{width:min(94vw,440px);padding:1rem 1rem 1.2rem;}#" + guardModalId + " .ca365-auth-guard-step{grid-template-columns:30px 1fr;gap:.65rem;padding:.72rem .75rem;}#" + guardModalId + " .ca365-auth-guard-step-index{width:30px;height:30px;font-size:.82rem;}}"
        ].join("");
        document.head.appendChild(style);
    }

    function ensureGuardModal() {
        var existing = document.getElementById(guardModalId);
        if (existing) return existing;

        ensureGuardStyles();

        var modal = document.createElement("div");
        modal.id = guardModalId;
        modal.setAttribute("aria-hidden", "true");
        modal.innerHTML = [
            '<div class="ca365-auth-guard-backdrop"></div>',
            '<div class="ca365-auth-guard-card" role="dialog" aria-modal="true" aria-labelledby="ca365AuthGuardTitle">',
            '<p class="ca365-auth-guard-eyebrow" id="ca365AuthGuardEyebrow"></p>',
            '<h2 class="ca365-auth-guard-title" id="ca365AuthGuardTitle"></h2>',
            '<p class="ca365-auth-guard-copy" id="ca365AuthGuardCopyText"></p>',
            '<div class="ca365-auth-guard-steps" id="ca365AuthGuardSteps" aria-live="polite"></div>',
            '<div class="ca365-auth-guard-actions">',
            '<button class="ca365-auth-guard-primary" id="ca365AuthGuardLogin" type="button"></button>',
            '<button class="ca365-auth-guard-secondary" id="ca365AuthGuardCopyButton" type="button">Copy Link</button>',
            "</div>",
            '<p class="ca365-auth-guard-helper" id="ca365AuthGuardHelper"></p>',
            "</div>"
        ].join("");

        document.body.appendChild(modal);

        var loginButton = modal.querySelector("#ca365AuthGuardLogin");
        var copyButton = modal.querySelector("#ca365AuthGuardCopyButton");

        loginButton.addEventListener("click", function () {
            var returnUrl = persistReturnUrl(window.location.href) || normalizeReturnUrl(window.location.href);
            var loginUrlObject = new URL("index1.html", window.location.href);

            if (returnUrl) {
                loginUrlObject.searchParams.set(authReturnQueryKey, returnUrl);
            }

            var loginUrl = loginUrlObject.toString();

            if (getInAppBrowserName()) {
                tryOpenUrlInMainBrowser(loginUrl);
                return;
            }

            window.location.href = loginUrl;
        });

        copyButton.addEventListener("click", function () {
            var currentUrl = window.location.href;

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(currentUrl).then(function () {
                    copyButton.textContent = "Link Copied";
                }).catch(function () {
                    copyButton.textContent = "Copy Failed";
                });
            } else {
                var input = document.createElement("input");
                input.value = currentUrl;
                input.setAttribute("readonly", "");
                input.style.position = "absolute";
                input.style.left = "-9999px";
                document.body.appendChild(input);
                input.select();
                var copied = document.execCommand("copy");
                document.body.removeChild(input);
                copyButton.textContent = copied ? "Link Copied" : "Copy Failed";
            }
        });

        return modal;
    }

    function showLoginGate() {
        var config = getLoginPromptConfig();
        var modal = ensureGuardModal();
        var eyebrow = modal.querySelector("#ca365AuthGuardEyebrow");
        var title = modal.querySelector("#ca365AuthGuardTitle");
        var copy = modal.querySelector("#ca365AuthGuardCopyText");
        var steps = modal.querySelector("#ca365AuthGuardSteps");
        var helper = modal.querySelector("#ca365AuthGuardHelper");
        var loginButton = modal.querySelector("#ca365AuthGuardLogin");
        var copyButton = modal.querySelector("#ca365AuthGuardCopyButton");

        eyebrow.textContent = config.eyebrow;
        title.textContent = config.title;
        copy.textContent = config.copy;
        helper.textContent = config.helper;
        loginButton.textContent = config.actionLabel;
        copyButton.textContent = "Copy Link";
        steps.innerHTML = config.steps.map(function (step, index) {
            return [
                '<div class="ca365-auth-guard-step">',
                '<span class="ca365-auth-guard-step-index">' + (index + 1) + "</span>",
                '<p class="ca365-auth-guard-step-copy">' + step + "</p>",
                "</div>"
            ].join("");
        }).join("");

        modal.classList.add("is-visible");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("ca365-auth-guard-open");
    }

    function hideLoginGate() {
        var modal = document.getElementById(guardModalId);
        if (!modal) return;
        modal.classList.remove("is-visible");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("ca365-auth-guard-open");
    }

    async function guardPage() {
        try {
            ensureGuardStyles();

            if (!hasSupabaseConfig || !window.supabase) {
                showLoginGate();
                return;
            }

            var client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            });

            var result = await client.auth.getSession();
            var session = result && result.data ? result.data.session : null;

            if (!session || !session.user) {
                showLoginGate();
                return;
            }

            hideLoginGate();

            client.auth.onAuthStateChange(function (event, nextSession) {
                if (event === "SIGNED_OUT" || !nextSession || !nextSession.user) {
                    showLoginGate();
                } else {
                    hideLoginGate();
                }
            });
        } catch (error) {
            console.error("Unable to verify auth session", error);
            showLoginGate();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", guardPage);
    } else {
        guardPage();
    }
})();
