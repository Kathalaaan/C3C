(function () {
    function createWhooshPlayer(src, options) {
        var soundSrc = src || "Whoosh 2.mp3";
        var settings = options || {};
        var volume = typeof settings.volume === "number" ? settings.volume : 0.45;
        var currentAudio = null;

        return function playWhoosh() {
            try {
                if (currentAudio) {
                    currentAudio.pause();
                    currentAudio.currentTime = 0;
                }

                currentAudio = new Audio(encodeURI(soundSrc));
                currentAudio.volume = volume;
                currentAudio.play().catch(function () {
                    return null;
                });
            } catch (error) {
                console.error("Unable to play whoosh sound", error);
            }
        };
    }

    var playRoadmapWhoosh = createWhooshPlayer("Whoosh 2.mp3", { volume: 0.45 });

    function bindRoadmapWhoosh() {
        document.querySelectorAll(".roadmap-inner .node").forEach(function (node) {
            if (node.dataset.whooshBound === "true") return;

            node.dataset.whooshBound = "true";
            node.addEventListener("click", function () {
                playRoadmapWhoosh();
            });
        });
    }

    window.createWhooshPlayer = createWhooshPlayer;
    window.bindRoadmapWhoosh = bindRoadmapWhoosh;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindRoadmapWhoosh);
    } else {
        bindRoadmapWhoosh();
    }
})();
