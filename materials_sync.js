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

    var STORAGE_BUCKET = "study-materials";
    var syncTimer = null;
    var syncInFlight = false;
    var client = null;
    var currentUserId = null;

    var pageConfigMap = {
        "/advanced_accounting.html": {
            roadmapId: "ca-intermediate-group-1-advanced-accounting",
            dbName: "ca365-advanced-accounting-materials-db"
        },
        "/advanced_auditing,_assurance_and_professional_ethics.html": {
            roadmapId: "ca-final-group-1-advanced-audit",
            dbName: "ca365-advanced-audit-materials-db"
        },
        "/advanced_financial_management.html": {
            roadmapId: "ca-final-group-2-advanced-financial-management",
            dbName: "ca365-advanced-financial-management-materials-db"
        },
        "/auditing_and_ethics.html": {
            roadmapId: "ca-intermediate-group-2-auditing-ethics",
            dbName: "ca365-auditing-ethics-materials-db"
        },
        "/business_laws_content.html": {
            roadmapId: "ca-foundation-business-laws",
            dbName: "ca365-business-laws-materials-db"
        },
        "/bussiness_economic.html": {
            roadmapId: "ca-foundation-business-economics",
            dbName: "ca365-business-economics-materials-db"
        },
        "/corporate_and_other_law.html": {
            roadmapId: "ca-intermediate-group-1-corporate-other-law",
            dbName: "ca365-corporate-other-law-materials-db"
        },
        "/cost_and_management_accounting.html": {
            roadmapId: "ca-intermediate-group-2-cost-and-management-accounting",
            dbName: "ca365-cost-and-management-accounting-materials-db"
        },
        "/direct_tax_laws_and_international_taxation.html": {
            roadmapId: "ca-final-group-2-direct-tax-laws-and-international-taxation",
            dbName: "ca365-direct-tax-laws-materials-db"
        },
        "/financial_management_and_strategic_management.html": {
            roadmapId: "ca-intermediate-group-2-financial-management-and-strategic-management",
            dbName: "ca365-financial-management-strategic-management-materials-db"
        },
        "/financial_reporting.html": {
            roadmapId: "ca-final-group-1-financial-reporting",
            dbName: "ca365-financial-reporting-materials-db"
        },
        "/indirect_tax_laws.html": {
            roadmapId: "ca-final-group-2-indirect-tax-laws",
            dbName: "ca365-indirect-tax-laws-materials-db"
        },
        "/integrated_business_solutions.html": {
            roadmapId: "ca-final-group-2-integrated-business-solutions",
            dbName: "ca365-integrated-business-solutions-materials-db"
        },
        "/principles_of_accounting_roadmap.html": {
            roadmapId: "ca-foundation-principles-of-accounting",
            dbName: "ca365-accounting-materials-db"
        },
        "/quantitative_aptitude.html": {
            roadmapId: "ca-foundation-quantitative-aptitude",
            dbName: "ca365-quantitative-aptitude-materials-db"
        },
        "/taxtation.html": {
            roadmapId: "ca-intermediate-group-1-taxation",
            dbName: "ca365-taxation-materials-db"
        }
    };

    function getPageConfig() {
        var pathname = window.location.pathname.replace(/\\/g, "/").toLowerCase();
        var fileName = "/" + pathname.split("/").pop();
        return pageConfigMap[fileName] || null;
    }

    function getMaterialsStatusElement() {
        return document.getElementById("materialsStatus");
    }

    function setMaterialsSyncStatus(message) {
        var statusEl = getMaterialsStatusElement();
        if (!statusEl) return;
        statusEl.textContent = message;
    }

    function openMaterialsDb(dbName) {
        return new Promise(function (resolve, reject) {
            var request = indexedDB.open(dbName, 1);
            request.onupgradeneeded = function () {
                var db = request.result;
                if (!db.objectStoreNames.contains("materials")) {
                    db.createObjectStore("materials", { keyPath: "id" });
                }
            };
            request.onsuccess = function () {
                resolve(request.result);
            };
            request.onerror = function () {
                reject(request.error);
            };
        });
    }

    async function getAllLocalMaterials(dbName) {
        var db = await openMaterialsDb(dbName);
        return new Promise(function (resolve, reject) {
            var transaction = db.transaction("materials", "readonly");
            var request = transaction.objectStore("materials").getAll();
            request.onsuccess = function () {
                var rows = request.result || [];
                rows.sort(function (a, b) {
                    return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
                });
                resolve(rows);
            };
            request.onerror = function () {
                reject(request.error);
            };
        });
    }

    async function putLocalMaterial(dbName, record) {
        var db = await openMaterialsDb(dbName);
        return new Promise(function (resolve, reject) {
            var transaction = db.transaction("materials", "readwrite");
            transaction.objectStore("materials").put(record);
            transaction.oncomplete = function () {
                resolve();
            };
            transaction.onerror = function () {
                reject(transaction.error);
            };
        });
    }

    async function deleteLocalMaterial(dbName, id) {
        var db = await openMaterialsDb(dbName);
        return new Promise(function (resolve, reject) {
            var transaction = db.transaction("materials", "readwrite");
            transaction.objectStore("materials").delete(id);
            transaction.oncomplete = function () {
                resolve();
            };
            transaction.onerror = function () {
                reject(transaction.error);
            };
        });
    }

    function toIsoDate(value) {
        if (!value) return new Date().toISOString();
        if (typeof value === "string" && value.includes("T")) return value;
        return new Date(Number(value) || Date.now()).toISOString();
    }

    function getCreatedAtForSync(localItem, remoteItem) {
        if (remoteItem && remoteItem.created_at) return remoteItem.created_at;
        return toIsoDate(localItem && localItem.createdAt);
    }

    function toLocalCreatedAt(value) {
        if (!value) return Date.now();
        if (typeof value === "number") return value;
        var parsed = Date.parse(value);
        return Number.isNaN(parsed) ? Date.now() : parsed;
    }

    function getFilePath(userId, roadmapId, itemId, title) {
        var safeTitle = (title || "file")
            .replace(/[^\w.\-]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 80) || "file";

        return [userId, roadmapId, itemId + "-" + safeTitle].join("/");
    }

    async function fetchRemoteMaterials(roadmapId) {
        var result = await client
            .from("user_materials")
            .select("*")
            .eq("user_id", currentUserId)
            .eq("roadmap_id", roadmapId);

        if (result.error) {
            throw result.error;
        }

        return result.data || [];
    }

    async function hydrateRemoteMaterials(config) {
        var remoteRows = await fetchRemoteMaterials(config.roadmapId);
        var localRows = await getAllLocalMaterials(config.dbName);
        var localMap = new Map(localRows.map(function (row) { return [row.id, row]; }));
        var remoteIds = new Set();
        var changed = false;

        for (var index = 0; index < remoteRows.length; index += 1) {
            var remote = remoteRows[index];
            remoteIds.add(remote.id);
            var local = localMap.get(remote.id);

            if (remote.kind === "file") {
                var needsFile = !local || !local.fileBlob || local.filePath !== remote.file_path;
                if (needsFile && remote.file_path) {
                    var downloadResult = await client.storage.from(STORAGE_BUCKET).download(remote.file_path);
                    if (downloadResult.error) {
                        console.error("Unable to download synced material", downloadResult.error.message);
                    } else {
                        await putLocalMaterial(config.dbName, {
                            id: remote.id,
                            kind: remote.kind,
                            title: remote.title,
                            mimeType: remote.mime_type || "application/octet-stream",
                            size: Number(remote.size) || 0,
                            fileBlob: downloadResult.data,
                            filePath: remote.file_path,
                            createdAt: toLocalCreatedAt(remote.created_at)
                        });
                        changed = true;
                    }
                }
            } else if (!local || local.title !== remote.title || local.url !== remote.url || local.text !== remote.text) {
                await putLocalMaterial(config.dbName, {
                    id: remote.id,
                    kind: remote.kind,
                    title: remote.title,
                    url: remote.url || "",
                    text: remote.note_text || "",
                    createdAt: toLocalCreatedAt(remote.created_at)
                });
                changed = true;
            }
        }

        for (var localIndex = 0; localIndex < localRows.length; localIndex += 1) {
            var localRow = localRows[localIndex];
            if (!remoteIds.has(localRow.id)) {
                continue;
            }
        }

        if (changed) {
            setMaterialsSyncStatus("Synced your study materials from your account.");
            var reloadKey = "ca365-materials-sync-reload:" + config.roadmapId;
            if (window.sessionStorage.getItem(reloadKey) !== "done") {
                window.sessionStorage.setItem(reloadKey, "done");
                window.location.reload();
                return;
            }
        } else {
            window.sessionStorage.removeItem("ca365-materials-sync-reload:" + config.roadmapId);
        }
    }

    async function uploadFileRecord(config, item) {
        var filePath = item.filePath || getFilePath(currentUserId, config.roadmapId, item.id, item.title);
        var uploadResult = await client.storage.from(STORAGE_BUCKET).upload(filePath, item.fileBlob, {
            upsert: true,
            contentType: item.mimeType || "application/octet-stream"
        });

        if (uploadResult.error) {
            throw uploadResult.error;
        }

        return filePath;
    }

    async function syncLocalMaterials(config) {
        var localRows = await getAllLocalMaterials(config.dbName);
        var remoteRows = await fetchRemoteMaterials(config.roadmapId);
        var remoteMap = new Map(remoteRows.map(function (row) { return [row.id, row]; }));
        var localIds = new Set(localRows.map(function (row) { return row.id; }));

        for (var index = 0; index < localRows.length; index += 1) {
            var item = localRows[index];
            var remote = remoteMap.get(item.id);
            var payload = {
                id: item.id,
                user_id: currentUserId,
                roadmap_id: config.roadmapId,
                kind: item.kind,
                title: item.title,
                mime_type: item.mimeType || null,
                size: Number(item.size) || 0,
                url: item.kind === "link" ? item.url || null : null,
                note_text: item.kind === "note" ? item.text || null : null,
                created_at: getCreatedAtForSync(item, remote)
            };

            if (item.kind === "file") {
                payload.file_path = await uploadFileRecord(config, item);
            } else {
                payload.file_path = null;
            }

            var shouldUpsert = !remote ||
                remote.title !== payload.title ||
                remote.kind !== payload.kind ||
                (remote.url || null) !== payload.url ||
                (remote.note_text || null) !== payload.note_text ||
                (remote.file_path || null) !== payload.file_path ||
                Number(remote.size || 0) !== payload.size;

            if (shouldUpsert) {
                var upsertResult = await client.from("user_materials").upsert(payload, {
                    onConflict: "id"
                });

                if (upsertResult.error) {
                    throw upsertResult.error;
                }

                if (item.kind === "file" && item.filePath !== payload.file_path) {
                    item.filePath = payload.file_path;
                    await putLocalMaterial(config.dbName, item);
                }
            }
        }

        for (var remoteIndex = 0; remoteIndex < remoteRows.length; remoteIndex += 1) {
            var remoteRow = remoteRows[remoteIndex];
            if (localIds.has(remoteRow.id)) continue;

            if (remoteRow.file_path) {
                var removeStorageResult = await client.storage.from(STORAGE_BUCKET).remove([remoteRow.file_path]);
                if (removeStorageResult.error) {
                    console.error("Unable to delete stored file", removeStorageResult.error.message);
                }
            }

            var deleteResult = await client
                .from("user_materials")
                .delete()
                .eq("id", remoteRow.id)
                .eq("user_id", currentUserId);

            if (deleteResult.error) {
                throw deleteResult.error;
            }
        }
    }

    async function runSync(config) {
        if (syncInFlight || !client || !currentUserId) return;
        syncInFlight = true;

        try {
            await hydrateRemoteMaterials(config);
            await syncLocalMaterials(config);
        } catch (error) {
            console.error("Unable to sync materials", error);
        } finally {
            syncInFlight = false;
        }
    }

    async function init() {
        var config = getPageConfig();
        if (!config) return;
        if (!document.getElementById("materialsFileInput")) return;
        if (!hasSupabaseConfig || !window.supabase) return;

        client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });

        var sessionResult = await client.auth.getSession();
        currentUserId = sessionResult && sessionResult.data && sessionResult.data.session && sessionResult.data.session.user
            ? sessionResult.data.session.user.id
            : null;

        if (!currentUserId) return;

        setMaterialsSyncStatus("Syncing your study materials with your account...");
        await runSync(config);

        syncTimer = window.setInterval(function () {
            runSync(config);
        }, 2500);

        window.addEventListener("pagehide", function () {
            if (syncTimer) {
                window.clearInterval(syncTimer);
                syncTimer = null;
            }
            runSync(config);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
