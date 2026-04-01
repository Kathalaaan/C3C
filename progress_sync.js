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

    var client = null;
    var activeUserId = null;
    var flushTimer = null;
    var pendingUpserts = new Map();
    var pendingDeletes = new Set();
    var syncReady = false;
    var syncReadyPromise = null;
    var syncReadyResolve = null;
    var isApplyingRemoteState = false;

    syncReadyPromise = new Promise(function (resolve) {
        syncReadyResolve = resolve;
    });

    function shouldSyncKey(key) {
        if (!key || typeof key !== "string") return false;
        if (!key.startsWith("ca365-")) return false;
        if (key === "ca365-dashboard-context") return false;
        return true;
    }

    function getReloadGuardKey() {
        return "ca365-progress-sync-reload:" + window.location.pathname;
    }

    function scheduleFlush() {
        if (!activeUserId || !syncReady) return;
        if (flushTimer) {
            window.clearTimeout(flushTimer);
        }

        flushTimer = window.setTimeout(function () {
            flushTimer = null;
            flushPendingChanges();
        }, 350);
    }

    async function flushPendingChanges() {
        if (!client || !activeUserId || !syncReady) return;

        var upserts = Array.from(pendingUpserts.entries()).map(function (entry) {
            return {
                user_id: activeUserId,
                state_key: entry[0],
                state_value: entry[1]
            };
        });

        var deletes = Array.from(pendingDeletes.values());

        pendingUpserts.clear();
        pendingDeletes.clear();

        if (upserts.length > 0) {
            var upsertResult = await client
                .from("user_state_store")
                .upsert(upserts, {
                    onConflict: "user_id,state_key"
                });

            if (upsertResult.error) {
                console.error("Unable to sync local state to Supabase", upsertResult.error.message);
            }
        }

        if (deletes.length > 0) {
            var deleteResult = await client
                .from("user_state_store")
                .delete()
                .eq("user_id", activeUserId)
                .in("state_key", deletes);

            if (deleteResult.error) {
                console.error("Unable to delete synced local state", deleteResult.error.message);
            }
        }
    }

    function queueUpsert(key, value) {
        if (!shouldSyncKey(key) || !activeUserId || isApplyingRemoteState) return;
        pendingDeletes.delete(key);
        pendingUpserts.set(key, value);
        scheduleFlush();
    }

    function queueDelete(key) {
        if (!shouldSyncKey(key) || !activeUserId || isApplyingRemoteState) return;
        pendingUpserts.delete(key);
        pendingDeletes.add(key);
        scheduleFlush();
    }

    function patchLocalStorage() {
        if (window.__CA365ProgressSyncPatched) return;
        window.__CA365ProgressSyncPatched = true;

        var originalSetItem = window.localStorage.setItem.bind(window.localStorage);
        var originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);
        var originalClear = window.localStorage.clear.bind(window.localStorage);

        window.localStorage.setItem = function (key, value) {
            originalSetItem(key, value);
            queueUpsert(key, value);
        };

        window.localStorage.removeItem = function (key) {
            originalRemoveItem(key);
            queueDelete(key);
        };

        window.localStorage.clear = function () {
            var keysToDelete = [];
            for (var index = 0; index < window.localStorage.length; index += 1) {
                var key = window.localStorage.key(index);
                if (shouldSyncKey(key)) {
                    keysToDelete.push(key);
                }
            }

            originalClear();
            keysToDelete.forEach(queueDelete);
        };
    }

    function applyRemoteRows(rows) {
        if (!Array.isArray(rows) || rows.length === 0) return;

        var hasChanged = false;
        isApplyingRemoteState = true;

        try {
            rows.forEach(function (row) {
                if (!shouldSyncKey(row.state_key)) return;
                var currentValue = window.localStorage.getItem(row.state_key);
                if (currentValue !== row.state_value) {
                    window.localStorage.setItem(row.state_key, row.state_value);
                    hasChanged = true;
                }
            });
        } finally {
            isApplyingRemoteState = false;
        }

        if (hasChanged) {
            var reloadGuardKey = getReloadGuardKey();
            if (window.sessionStorage.getItem(reloadGuardKey) !== "done") {
                window.sessionStorage.setItem(reloadGuardKey, "done");
                window.location.reload();
                return;
            }
        } else {
            window.sessionStorage.removeItem(getReloadGuardKey());
        }
    }

    async function hydrateFromSupabase() {
        if (!client || !activeUserId) return;

        var result = await client
            .from("user_state_store")
            .select("state_key, state_value")
            .eq("user_id", activeUserId);

        if (result.error) {
            console.error("Unable to hydrate synced progress state", result.error.message);
            return;
        }

        applyRemoteRows(result.data || []);
    }

    async function ensureCurrentUser() {
        if (!hasSupabaseConfig || !window.supabase) {
            syncReady = true;
            syncReadyResolve();
            return;
        }

        client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });

        var sessionResult = await client.auth.getSession();
        activeUserId = sessionResult && sessionResult.data && sessionResult.data.session && sessionResult.data.session.user
            ? sessionResult.data.session.user.id
            : null;

        patchLocalStorage();

        if (activeUserId) {
            await hydrateFromSupabase();
        }

        syncReady = true;
        syncReadyResolve();

        client.auth.onAuthStateChange(function (event, session) {
            activeUserId = session && session.user ? session.user.id : null;

            if (event === "SIGNED_IN" && activeUserId) {
                hydrateFromSupabase();
            }

            if (event === "SIGNED_OUT") {
                pendingUpserts.clear();
                pendingDeletes.clear();
            }
        });
    }

    window.CA365Sync = {
        ready: function () {
            return syncReadyPromise;
        },
        flush: function () {
            return flushPendingChanges();
        }
    };

    window.addEventListener("pagehide", function () {
        flushPendingChanges();
    });

    ensureCurrentUser().catch(function (error) {
        console.error("Progress sync bootstrap failed", error);
        syncReady = true;
        syncReadyResolve();
    });
})();
