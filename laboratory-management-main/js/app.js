async function loadRequests() {
    try {
        let query = supabaseClient
            .from("borrowing_requests")
            .select(`
                *,
                equipment:equipment_id(code, name, status),
                requester:requester_id(id, name, email)
            `)
            .order("created_at", { ascending: false });

        // IMPORTANT: requester must only see their own requests.
        // If currentUser.id is stale or missing, the UI appears empty even when data exists.
        if (currentUser && currentUser.role === "requester") {
            query = query.eq("requester_id", currentUser.id);
        }

        const { data, error } = await query;

        if (error) throw error;

        allRequestsCache = data || [];
        console.log("Loaded borrowing requests:", allRequestsCache);

        renderRequestsTable(allRequestsCache);
    } catch (err) {
        console.error("Load requests error:", err);
        showToast("error", "Request Error", err.message || "Unable to load borrowing requests.");
    }
}
