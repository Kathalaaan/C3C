(function () {
    var faviconHref = encodeURI("favi (2).png");
    var themeSoundSrc = encodeURI("videoplayback-_5_.mp3");
    var themeSoundTemplate = null;

    function ensureFavicon() {
        if (!document.head) return;

        var iconSelectors = [
            'link[rel="icon"]',
            'link[rel="shortcut icon"]'
        ];

        iconSelectors.forEach(function (selector, index) {
            var link = document.head.querySelector(selector);

            if (!link) {
                link = document.createElement("link");
                link.rel = index === 0 ? "icon" : "shortcut icon";
                document.head.appendChild(link);
            }

            link.type = "image/png";
            link.href = faviconHref;
        });
    }

    function ensureThemeSoundTemplate() {
        if (themeSoundTemplate) return themeSoundTemplate;

        themeSoundTemplate = document.createElement("audio");
        themeSoundTemplate.src = themeSoundSrc;
        themeSoundTemplate.preload = "auto";
        themeSoundTemplate.volume = 0.7;
        themeSoundTemplate.setAttribute("playsinline", "");
        themeSoundTemplate.style.display = "none";
        document.body.appendChild(themeSoundTemplate);
        themeSoundTemplate.load();

        return themeSoundTemplate;
    }

    function playThemeToggleSound() {
        try {
            var template = ensureThemeSoundTemplate();
            var clone = template.cloneNode(true);
            clone.volume = 0.7;
            clone.currentTime = 0;
            clone.setAttribute("playsinline", "");
            clone.style.display = "none";
            document.body.appendChild(clone);

            var cleanup = function () {
                clone.removeEventListener("ended", cleanup);
                clone.removeEventListener("pause", cleanup);
                if (clone.parentNode) {
                    clone.parentNode.removeChild(clone);
                }
            };

            clone.addEventListener("ended", cleanup, { once: true });
            clone.addEventListener("pause", cleanup, { once: true });

            var playAttempt = clone.play();
            if (playAttempt && playAttempt.catch) {
                playAttempt.catch(function () {
                    cleanup();
                });
            }
        } catch (error) {
            console.error("Unable to play theme toggle sound", error);
        }
    }

    function bindThemeToggleSound() {
        document.addEventListener("click", function (event) {
            var toggle = event.target.closest(".theme-toggle");
            if (!toggle) return;

            playThemeToggleSound();
        });
    }

    function init() {
        ensureFavicon();
        ensureThemeSoundTemplate();
        bindThemeToggleSound();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
