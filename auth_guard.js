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

    function redirectToLogin() {
        window.alert("Please login to access this page.");
        window.location.href = "index1.html";
    }

    async function guardPage() {
        if (!hasSupabaseConfig || !window.supabase) {
            redirectToLogin();
            return;
        }

        try {
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
                redirectToLogin();
                return;
            }

            client.auth.onAuthStateChange(function (event, nextSession) {
                if (event === "SIGNED_OUT" || !nextSession || !nextSession.user) {
                    redirectToLogin();
                }
            });
        } catch (error) {
            console.error("Unable to verify auth session", error);
            redirectToLogin();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", guardPage);
    } else {
        guardPage();
    }
})();
