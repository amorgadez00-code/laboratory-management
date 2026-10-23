// =========================================================
// LABORATORY ASSET AND SERVICE MANAGEMENT SYSTEM
// Comprehensive Business Rules, Workflow & Audit Trail Engine
// =========================================================

let currentUser = null;
let allEquipmentCache = [];
let allRequestsCache = [];
let allAuditCache = [];
let activeSection = "dashboard";

// =========================================================
// SYSTEM INITIALIZATION
// =========================================================

document.addEventListener("DOMContentLoaded", async () => {
    console.log("=== APP INITIALIZATION STARTING ===");
    console.log("Current URL:", window.location.href);

    // 1. Session check (TC-A4-10)
    const storedUser = getStoredSession();
    console.log("Stored user from session:", storedUser);

    if (!storedUser) {
        console.log("=== NO STORED USER - REDIRECTING TO LOGIN ===");
        window.location.href = "login.html";
        return;
    }

    currentUser = storedUser;
    console.log("Current user set from session:", currentUser);

    // Refresh user profile from database to ensure correct ID
    // Now uses email lookup which is more reliable
    console.log("=== CALLING refreshCurrentUserProfile ===");
    await refreshCurrentUserProfile();
    console.log("=== refreshCurrentUserProfile COMPLETED ===");

    console.log("After profile refresh, current user:", currentUser);

    // 2. Setup interface according to user role
    console.log("=== CALLING setupRoleInterface ===");
    setupRoleInterface();
    console.log("=== setupRoleInterface COMPLETED ===");

    // 3. Load initial dashboard data (with error handling)
    console.log("=== LOADING DASHBOARD DATA ===");
    try {
        await loadDashboard();
        console.log("=== loadDashboard COMPLETED ===");
    } catch (err) {
        console.error("Error loading dashboard:", err);
    }

    try {
        await loadEquipment();
        console.log("=== loadEquipment COMPLETED ===");
    } catch (err) {
        console.error("Error loading equipment:", err);
    }

    try {
        await loadRequests();
        console.log("=== loadRequests COMPLETED ===");
    } catch (err) {
        console.error("Error loading requests:", err);
    }

    try {
        await loadMaintenance();
        console.log("=== loadMaintenance COMPLETED ===");
    } catch (err) {
        console.error("Error loading maintenance:", err);
    }

    if (currentUser.role === "admin") {
        try {
            await loadUsers();
            console.log("=== loadUsers COMPLETED ===");
        } catch (err) {
            console.error("Error loading users:", err);
        }

        try {
            await loadAuditLogs();
            console.log("=== loadAuditLogs COMPLETED ===");
        } catch (err) {
            console.error("Error loading audit logs:", err);
        }

        try {
            await loadReports();
            console.log("=== loadReports COMPLETED ===");
        } catch (err) {
            console.error("Error loading reports:", err);
        }
    }

    // 4. Periodic Overdue Check (every 60s)
    setInterval(checkOverdueRequests, 60000);

    console.log("=== APP INITIALIZATION COMPLETE ===");
});

// =========================================================
// SESSION MANAGEMENT (TC-A4-10)
// =========================================================

function getStoredSession() {
    try {
        const raw = sessionStorage.getItem("lab_user") || localStorage.getItem("lab_user");
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

async function refreshCurrentUserProfile() {
    try {
        console.log("Refreshing user profile - Email:", currentUser.email, "ID:", currentUser.id);

        // First try to fetch by email (more reliable than ID)
        const { data: userByEmail, error: emailError } = await supabaseClient
            .from("users")
            .select("*")
            .eq("email", currentUser.email)
            .single();

        console.log("User fetch by email result:", { userByEmail, emailError });

        if (userByEmail && !emailError) {
            // User found by email - update session with correct ID
            currentUser = {
                id: userByEmail.id,
                name: userByEmail.name,
                email: userByEmail.email,
                role: userByEmail.role || "requester"
            };
            sessionStorage.setItem("lab_user", JSON.stringify(currentUser));
            localStorage.setItem("lab_user", JSON.stringify(currentUser));
            console.log("User profile refreshed successfully (by email):", currentUser);
            return;
        }

        // User not found - try to create them automatically
        console.warn("User not found in database, attempting to create automatically...");

        const { data: newUser, error: createError } = await supabaseClient
            .from("users")
            .insert({
                name: currentUser.name,
                email: currentUser.email,
                password: "default123", // Default password - user should change this
                role: currentUser.role || "requester"
            })
            .select()
            .single();

        if (createError) {
            console.error("Failed to create user:", createError);
            console.warn("Using session data with original ID");
            return;
        }

        // User created successfully - update session
        currentUser = {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role
        };
        sessionStorage.setItem("lab_user", JSON.stringify(currentUser));
        localStorage.setItem("lab_user", JSON.stringify(currentUser));
        console.log("User created successfully and session updated:", currentUser);

    } catch (err) {
        console.error("Exception in refreshCurrentUserProfile:", err);
        console.warn("Using session data - NO REDIRECT WILL OCCUR");
    }
}

async function logout() {
    // BR-A4-10: Sensitive operation audit log
    if (currentUser) {
        try {
            await createAuditLog("LOGOUT", "Auth", currentUser.id, `User ${currentUser.name} logged out.`);
        } catch (e) {
            // ignore logout log error
        }
    }

    sessionStorage.removeItem("lab_user");
    localStorage.removeItem("lab_user");
    window.location.href = "login.html";
}

// =========================================================
// ROLE-BASED INTERFACE CONTROLS
// =========================================================

function setupRoleInterface() {
    if (!currentUser) return;

    // Display user info in sidebar
    document.getElementById("userName").textContent = currentUser.name;
    document.getElementById("userEmail").textContent = currentUser.email;

    const avatar = document.getElementById("userAvatar");
    if (avatar) avatar.textContent = currentUser.name.charAt(0).toUpperCase();

    const roleBadge = document.getElementById("userRole");
    roleBadge.className = `role-badge role-${currentUser.role}`;

    // Role display format
    let roleTitle = "REQUESTER";
    if (currentUser.role === "admin") roleTitle = "ADMINISTRATOR";
    else if (currentUser.role === "staff") roleTitle = "LABORATORY STAFF";
    roleBadge.textContent = roleTitle;

    const headerRoleBadge = document.getElementById("headerRoleBadge");
    if (headerRoleBadge) {
        headerRoleBadge.className = `role-badge role-${currentUser.role}`;
        headerRoleBadge.textContent = roleTitle;
    }

    // Admin-only navigation elements (Users, Audit Logs, Reports)
    const adminNavElements = document.querySelectorAll(".admin-only");
    const addEquipmentBtn = document.getElementById("addEquipmentButton");
    const equipmentActionsHeader = document.getElementById("equipmentActionsHeader");
    const borrowCreateButtons = document.querySelectorAll(".borrow-create-btn");
    const navRequestsText = document.getElementById("navRequestsText");
    const requestsHeading = document.getElementById("requestsSectionHeading");

    const myRequestsCard = document.getElementById("myRequestsCard");

    if (currentUser.role === "admin") {
        adminNavElements.forEach(el => el.style.display = "");
        if (addEquipmentBtn) addEquipmentBtn.style.display = "inline-flex";
        if (equipmentActionsHeader) equipmentActionsHeader.textContent = "Actions (Admin)";
        borrowCreateButtons.forEach(el => el.style.display = "none");
        if (navRequestsText) navRequestsText.textContent = "Borrowing Approval";
        if (requestsHeading) requestsHeading.textContent = "Borrowing Approval & Workflow";
        if (myRequestsCard) myRequestsCard.style.display = "none";
    } else if (currentUser.role === "staff") {
        adminNavElements.forEach(el => el.style.display = "none");
        if (addEquipmentBtn) addEquipmentBtn.style.display = "none";
        if (equipmentActionsHeader) equipmentActionsHeader.textContent = "Actions";
        borrowCreateButtons.forEach(el => el.style.display = "");
        if (navRequestsText) navRequestsText.textContent = "Borrowing Approval";
        if (requestsHeading) requestsHeading.textContent = "Borrowing Approval & Operations";
        if (myRequestsCard) myRequestsCard.style.display = "";
    } else {
        adminNavElements.forEach(el => el.style.display = "none");
        if (addEquipmentBtn) addEquipmentBtn.style.display = "none";
        if (equipmentActionsHeader) equipmentActionsHeader.textContent = "Actions";
        borrowCreateButtons.forEach(el => el.style.display = "");
        if (navRequestsText) navRequestsText.textContent = "My Requests";
        if (requestsHeading) requestsHeading.textContent = "My Borrowing Requests";
        if (myRequestsCard) myRequestsCard.style.display = "";
    }
}

// =========================================================
// SECTION NAVIGATION & PERMISSION GUARDS (TC-A4-01)
// =========================================================

function showSection(sectionId) {
    const adminRestricted = ["users", "audit", "reports"];

    // TC-A4-01: Requester attempts to open Admin page -> Access denied.
    if (adminRestricted.includes(sectionId) && currentUser.role !== "admin") {
        const errorMsg = "Access denied. Only Administrator may access this page.";
        showToast("error", "Permission Denied", errorMsg);
        alert("Access denied.");
        return;
    }

    activeSection = sectionId;

    // Update section visibility
    document.querySelectorAll(".content-section").forEach(sec => {
        sec.classList.add("hidden");
    });

    const targetSec = document.getElementById(sectionId);
    if (targetSec) {
        targetSec.classList.remove("hidden");
    }

    // Update active nav button
    document.querySelectorAll(".sidebar-nav .nav-btn").forEach(btn => {
        btn.classList.remove("active");
    });
    const activeNavBtn = document.getElementById(`nav-${sectionId}`) || document.getElementById(`${sectionId}Nav`);
    if (activeNavBtn) activeNavBtn.classList.add("active");

    // Update title
    const titles = {
        dashboard: "System Dashboard",
        equipment: "Laboratory Equipment Inventory",
        requests: "Borrowing Approval Workflow",
        maintenance: "Equipment Maintenance",
        users: "User Role Management",
        audit: "Audit Trail & Activity Logs",
        reports: "System Reports & Analytics"
    };
    document.getElementById("currentSectionTitle").textContent = titles[sectionId] || "Laboratory Asset System";

    // Refresh section data
    refreshCurrentSection();
}

function refreshCurrentSection() {
    console.log("Refreshing section:", activeSection);

    if (activeSection === "dashboard") loadDashboard();
    else if (activeSection === "equipment") loadEquipment();
    else if (activeSection === "requests") loadRequests();
    else if (activeSection === "maintenance") loadMaintenance();
    else if (activeSection === "users" && currentUser.role === "admin") loadUsers();
    else if (activeSection === "audit" && currentUser.role === "admin") loadAuditLogs();
    else if (activeSection === "reports" && currentUser.role === "admin") loadReports();
}

// =========================================================
// DASHBOARD
// =========================================================

async function loadDashboard() {
    console.log("Loading dashboard...");
    try {
        const { data: equipment } = await supabaseClient.from("equipment").select("*");
        const { data: requests } = await supabaseClient.from("borrowing_requests").select("*, equipment:equipment_id(code, name), requester:requester_id(name)");

        console.log("Dashboard data:", { equipmentCount: equipment?.length, requestsCount: requests?.length });

        const totalEq = equipment ? equipment.length : 0;
        const availEq = equipment ? equipment.filter(e => e.status === "available").length : 0;
        const pendingReq = requests ? requests.filter(r => r.status === "pending").length : 0;
        const myReq = requests ? requests.filter(r => r.requester_id === currentUser.id).length : 0;

        document.getElementById("totalEquipment").textContent = totalEq;
        document.getElementById("availableEquipment").textContent = availEq;
        document.getElementById("pendingRequests").textContent = pendingReq;
        document.getElementById("myRequests").textContent = myReq;

        // Render recent transactions preview
        const recentTbody = document.getElementById("dashboardRecentTable");
        if (recentTbody && requests) {
            recentTbody.innerHTML = "";
            const recent = requests.slice(0, 5);
            if (recent.length === 0) {
                recentTbody.innerHTML = `<tr><td colspan="6" style="text-align: center;" class="muted">No borrowing transactions recorded yet.</td></tr>`;
            } else {
                recent.forEach(r => {
                    recentTbody.innerHTML += `
                        <tr>
                            <td><span class="asset-tag">${r.equipment?.code || "-"}</span></td>
                            <td>${r.equipment?.name || "Asset"}</td>
                            <td>${r.requester?.name || "User"}</td>
                            <td>${r.purpose}</td>
                            <td>${r.due_date || "-"}</td>
                            <td><span class="status status-${r.status}">${r.status}</span></td>
                        </tr>
                    `;
                });
            }
        }
    } catch (e) {
        console.error("Dashboard error:", e);
        console.error("Error details:", e.message, e.code);
    }
}

// =========================================================
// EQUIPMENT INVENTORY & MANAGEMENT (TC-A4-09)
// =========================================================

async function loadEquipment() {
    try {
        const { data, error } = await supabaseClient
            .from("equipment")
            .select("*")
            .order("code", { ascending: true });

        if (error) throw error;

        allEquipmentCache = data || [];
        renderEquipmentTable(allEquipmentCache);
        populateEquipmentSelectOptions(allEquipmentCache);

    } catch (err) {
        console.error("Load equipment error:", err);
        showToast("error", "Error", "Failed to load equipment inventory.");
    }
}

function renderEquipmentTable(equipmentList) {
    const tbody = document.getElementById("equipmentTable");
    tbody.innerHTML = "";

    if (!equipmentList || equipmentList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;" class="muted">No equipment found matching criteria.</td></tr>`;
        return;
    }

    equipmentList.forEach(item => {
        let actions = "";

        if (currentUser.role === "admin") {
            actions = `
                <div class="table-actions">
                    <button class="btn-light btn-sm" onclick="openEquipmentForm('${item.id}')">Edit</button>
                    <button class="btn-light btn-sm" onclick="openMaintenanceFormFor('${item.id}')">Report Issue</button>
                    <button class="btn-danger btn-sm" onclick="deleteEquipment('${item.id}')">Delete</button>
                </div>
            `;
        } else if (currentUser.role === "staff") {
            actions = `
                <div class="table-actions">
                    ${item.status === "available" ? `<button class="btn-primary btn-sm" onclick="openRequestFormFor('${item.id}')">+ Request</button>` : `<span class="muted">${item.status === 'borrowed' ? 'Borrowed' : 'In Maintenance'}</span>`}
                    <button class="btn-light btn-sm" onclick="openMaintenanceFormFor('${item.id}')">Report Issue</button>
                </div>
            `;
        } else {
            if (item.status === "available") {
                actions = `
                    <button class="btn-primary btn-sm" onclick="openRequestFormFor('${item.id}')">
                        + Request
                    </button>
                `;
            } else {
                actions = `<span class="muted">${item.status === 'borrowed' ? 'Borrowed' : 'In Maintenance'}</span>`;
            }
        }

        tbody.innerHTML += `
            <tr>
                <td><span class="asset-tag">${item.code}</span></td>
                <td><strong>${item.name}</strong></td>
                <td>${item.category || "General"}</td>
                <td>${item.location || "Central Lab"}</td>
                <td><span class="status status-${item.status}">${item.status}</span></td>
                <td>${actions}</td>
            </tr>
        `;
    });
}

function filterEquipmentTable() {
    const search = document.getElementById("equipmentSearchInput").value.toLowerCase();
    const status = document.getElementById("equipmentStatusFilter").value;
    const category = document.getElementById("equipmentCategoryFilter").value;

    const filtered = allEquipmentCache.filter(item => {
        const matchSearch = item.code.toLowerCase().includes(search) || item.name.toLowerCase().includes(search) || (item.location && item.location.toLowerCase().includes(search));
        const matchStatus = !status || item.status === status;
        const matchCategory = !category || item.category === category;
        return matchSearch && matchStatus && matchCategory;
    });

    renderEquipmentTable(filtered);
}

function populateEquipmentSelectOptions(equipmentList) {
    const reqSelect = document.getElementById("requestEquipment");
    const maintSelect = document.getElementById("maintenanceEquipment");

    if (equipmentList && equipmentList.length > 0) {
        if (reqSelect) {
            reqSelect.innerHTML = `<option value="">-- Choose Available Equipment --</option>`;
            // BR-A4-01: Only available equipment may be requested.
            // BR-A4-09: Equipment under Maintenance cannot be borrowed.
            equipmentList.forEach(e => {
                if (e.status === "available") {
                    reqSelect.innerHTML += `<option value="${e.id}">${e.code} - ${e.name} (${e.location || 'Lab'})</option>`;
                }
            });
        }

        if (maintSelect) {
            maintSelect.innerHTML = `<option value="">-- Choose Equipment --</option>`;
            equipmentList.forEach(e => {
                maintSelect.innerHTML += `<option value="${e.id}">${e.code} - ${e.name} (${e.location || 'Lab'}) [${e.status.toUpperCase()}]</option>`;
            });
        }
    }
}

function openEquipmentForm(id = null) {
    // Only Admin can add/edit equipment
    if (currentUser.role !== "admin") {
        alert("Access denied. Only Administrator may manage equipment.");
        return;
    }

    const modal = document.getElementById("equipmentModal");
    const title = document.getElementById("equipmentModalTitle");
    const form = document.getElementById("equipmentForm");

    form.reset();
    document.getElementById("editEquipmentId").value = "";

    if (id) {
        const item = allEquipmentCache.find(e => e.id === id);
        if (item) {
            title.textContent = "Edit Equipment Asset";
            document.getElementById("editEquipmentId").value = item.id;
            document.getElementById("assetCode").value = item.code;
            document.getElementById("equipmentName").value = item.name;
            document.getElementById("equipmentCategory").value = item.category || "Computing";
            document.getElementById("equipmentLocation").value = item.location || "";
        }
    } else {
        title.textContent = "Add Equipment Asset";
    }

    modal.classList.remove("hidden");
}

document.getElementById("equipmentForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (currentUser.role !== "admin") {
        alert("Access denied. Only Administrator may add equipment.");
        return;
    }

    const editId = document.getElementById("editEquipmentId").value;
    const code = document.getElementById("assetCode").value.trim().toUpperCase();
    const name = document.getElementById("equipmentName").value.trim();
    const category = document.getElementById("equipmentCategory").value;
    const location = document.getElementById("equipmentLocation").value.trim();

    try {
        if (editId) {
            // Update
            const { error } = await supabaseClient
                .from("equipment")
                .update({ code, name, category, location, updated_at: new Date().toISOString() })
                .eq("id", editId);

            if (error) throw error;

            await createAuditLog("UPDATED", "Equipment", editId, `Updated equipment ${code} (${name})`);
            showToast("success", "Equipment Updated", `${code} updated successfully.`);
        } else {
            // Insert
            const { data: newEq, error } = await supabaseClient
                .from("equipment")
                .insert({ code, name, category, location, status: "available" })
                .select()
                .single();

            if (error) throw error;

            await createAuditLog("CREATED", "Equipment", newEq.id, `Created equipment asset ${code} (${name})`);
            showToast("success", "Equipment Added", `${code} added to inventory.`);
        }

        closeModal("equipmentModal");
        await loadEquipment();
        await loadDashboard();

    } catch (err) {
        showToast("error", "Failed", err.message);
    }
});

// TC-A4-09: Staff attempts restricted delete -> Operation blocked.
async function deleteEquipment(id) {
    if (currentUser.role !== "admin") {
        const msg = "Operation blocked. Access denied. Only Administrator may delete equipment.";
        showToast("error", "Operation Blocked", msg);
        alert("Operation blocked. Access denied.");
        return false;
    }

    const item = allEquipmentCache.find(e => e.id === id);
    const confirmDel = confirm(`Are you sure you want to delete equipment asset ${item?.code || id}?`);
    if (!confirmDel) return false;

    try {
        const { error } = await supabaseClient
            .from("equipment")
            .delete()
            .eq("id", id);

        if (error) throw error;

        // BR-A4-10: Sensitive operation logged
        await createAuditLog("DELETED", "Equipment", id, `Deleted equipment asset ${item?.code || id}`);
        showToast("success", "Equipment Deleted", `Asset ${item?.code || id} deleted.`);

        await loadEquipment();
        await loadDashboard();
        return true;
    } catch (err) {
        showToast("error", "Delete Failed", err.message);
        return false;
    }
}

// =========================================================
// BORROWING APPROVAL WORKFLOW ENGINE
// Pending -> Approved/Rejected -> Released -> Returned -> Closed
// =========================================================

async function loadRequests() {
    try {
        let query = supabaseClient
            .from("borrowing_requests")
            .select(`
                *,
                equipment:equipment_id(id, code, name, status, location),
                requester:requester_id(id, name, email, role),
                approver:approved_by(name),
                releaser:released_by(name),
                returner:returned_by(name)
            `)
            .order("created_at", { ascending: false });

        // Requesters can only view their own requests and history
        if (currentUser.role === "requester") {
            query = query.eq("requester_id", currentUser.id);
        }

        const { data, error } = await query;
        if (error) throw error;

        allRequestsCache = data || [];
        renderRequestsTable(allRequestsCache);

    } catch (err) {
        console.error("Load requests error:", err);
        showToast("error", "Error", "Failed to load borrowing requests.");
    }
}

function renderRequestsTable(requestsList) {
    const tbody = document.getElementById("requestsTable");
    tbody.innerHTML = "";

    if (!requestsList || requestsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;" class="muted">No borrowing requests found.</td></tr>`;
        return;
    }

    requestsList.forEach(req => {
        let actionButtons = "";
        const isOwner = req.requester_id === currentUser.id;

        // 1. PENDING STAGE -> ADMIN/STAFF REVIEW (BR-A4-02)
        if (req.status === "pending") {
            if (["admin", "staff"].includes(currentUser.role)) {
                // BR-A4-02: Staff/Admin cannot approve their own request
                if (isOwner) {
                    actionButtons = `
                        <button class="btn-success btn-sm" onclick="approveRequest('${req.id}')" title="Self-approval will be blocked per BR-A4-02">
                            Approve
                        </button>
                        <button class="btn-danger btn-sm" onclick="rejectRequest('${req.id}')">
                            Reject
                        </button>
                        <span class="muted" style="display:block; font-size:10.5px;">(Your Request)</span>
                    `;
                } else {
                    actionButtons = `
                        <button class="btn-success btn-sm" onclick="approveRequest('${req.id}')">
                            ✓ Approve
                        </button>
                        <button class="btn-danger btn-sm" onclick="rejectRequest('${req.id}')">
                            ✗ Reject
                        </button>
                    `;
                }
            } else {
                actionButtons = `<span class="muted">Awaiting Review</span>`;
            }
        }

        // 2. APPROVED STAGE -> RELEASE (BR-A4-04, BR-A4-05)
        else if (req.status === "approved") {
            if (["admin", "staff"].includes(currentUser.role)) {
                actionButtons = `
                    <button class="btn-primary btn-sm" onclick="releaseRequest('${req.id}')">
                        📦 Release Equipment
                    </button>
                `;
            } else {
                actionButtons = `<span class="status status-approved">Approved (Awaiting Release)</span>`;
            }
        }

        // 3. RELEASED / OVERDUE STAGE -> RETURN (BR-A4-06, BR-A4-08)
        else if (req.status === "released" || req.status === "overdue") {
            if (["admin", "staff"].includes(currentUser.role)) {
                actionButtons = `
                    <button class="btn-warning btn-sm" onclick="openReturnModal('${req.id}')">
                        ↩ Process Return
                    </button>
                `;
            } else {
                actionButtons = `<span class="status status-${req.status}">Currently Borrowed</span>`;
            }
        }

        // 4. RETURNED STAGE -> CLOSE
        else if (req.status === "returned") {
            if (["admin", "staff"].includes(currentUser.role)) {
                actionButtons = `
                    <button class="btn-secondary btn-sm" onclick="closeRequest('${req.id}')">
                        🔒 Close Transaction
                    </button>
                `;
            } else {
                actionButtons = `<span class="status status-returned">Returned</span>`;
            }
        }

        // 5. REJECTED STAGE (BR-A4-07: Rejected cannot be released)
        else if (req.status === "rejected") {
            if (["admin", "staff"].includes(currentUser.role)) {
                // Add test button to verify TC-A4-05
                actionButtons = `
                    <button class="btn-light btn-sm" onclick="releaseRequest('${req.id}')" title="Attempting release will be blocked per BR-A4-07" style="color: #dc2626;">
                        Attempt Release (Test)
                    </button>
                `;
            } else {
                actionButtons = `<span class="status status-rejected">Rejected</span>`;
            }
        }

        // 6. CLOSED STAGE
        else if (req.status === "closed") {
            actionButtons = `<span class="muted">Closed & Archived</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td><span style="font-family: monospace; font-size: 11px;">#${req.id.substring(0, 8)}</span></td>
                <td>
                    <strong>${req.requester?.name || "Unknown"}</strong>
                    <div style="font-size: 11px; color: var(--text-muted);">${req.requester?.email || ""}</div>
                </td>
                <td>
                    <span class="asset-tag">${req.equipment?.code || "-"}</span>
                    <div style="font-size: 12px;">${req.equipment?.name || "Asset"}</div>
                </td>
                <td>${req.purpose}</td>
                <td>${req.due_date || "-"}</td>
                <td>
                    <span class="status status-${req.status}">${req.status}</span>
                </td>
                <td>
                    <div class="table-actions">
                        ${actionButtons}
                    </div>
                </td>
            </tr>
        `;
    });
}

function filterRequestsTable() {
    const search = document.getElementById("requestsSearchInput").value.toLowerCase();
    const status = document.getElementById("requestsStatusFilter").value;

    const filtered = allRequestsCache.filter(r => {
        const matchSearch =
            (r.requester?.name && r.requester.name.toLowerCase().includes(search)) ||
            (r.equipment?.code && r.equipment.code.toLowerCase().includes(search)) ||
            (r.purpose && r.purpose.toLowerCase().includes(search));
        const matchStatus = !status || r.status === status;
        return matchSearch && matchStatus;
    });

    renderRequestsTable(filtered);
}

// ---------------------------------------------------------
// WORKFLOW ACTIONS & BUSINESS RULE VALIDATION
// ---------------------------------------------------------

function openRequestForm() {
    if (currentUser.role === "admin") {
        alert("Borrowing request submission is disabled for Administrator accounts. As an Administrator, your role is to review, approve, or reject requests submitted by Staff and Requesters.");
        return;
    }

    const modal = document.getElementById("requestModal");
    document.getElementById("requestForm").reset();

    // Set default due date to 7 days from today
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    document.getElementById("requestDueDate").value = nextWeek.toISOString().split("T")[0];

    modal.classList.remove("hidden");
}

function openRequestFormFor(equipmentId) {
    if (currentUser.role === "admin") {
        alert("Administrators do not create borrowing requests.");
        return;
    }
    openRequestForm();
    const select = document.getElementById("requestEquipment");
    if (select) select.value = equipmentId;
}

// TC-A4-02: Staff/Requester submits request -> Request saved as Pending.
document.getElementById("requestForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (currentUser.role === "admin") {
        alert("Access denied: Administrators cannot submit borrowing requests.");
        return;
    }

    const equipmentId = document.getElementById("requestEquipment").value;
    const purpose = document.getElementById("requestPurpose").value.trim();
    const dueDate = document.getElementById("requestDueDate").value;

    if (!equipmentId) {
        alert("Please select an equipment asset.");
        return;
    }

    try {
        // Fetch equipment to verify availability
        const { data: equipment, error: eqErr } = await supabaseClient
            .from("equipment")
            .select("*")
            .eq("id", equipmentId)
            .single();

        if (eqErr || !equipment) {
            alert("Equipment not found.");
            return;
        }

        // BR-A4-01: Only available equipment may be requested.
        if (equipment.status !== "available") {
            alert("BR-A4-01: Only available equipment may be requested.");
            return;
        }

        // BR-A4-09: Equipment under Maintenance cannot be borrowed.
        if (equipment.status === "maintenance") {
            alert("BR-A4-09: Equipment under Maintenance cannot be borrowed.");
            return;
        }

        // Ensure user exists in database before submitting request
        console.log("Ensuring user exists in database before request submission...");

        const { data: userCheck, error: userError } = await supabaseClient
            .from("users")
            .select("*")
            .eq("email", currentUser.email)
            .single();

        let requesterId = currentUser.id;

        if (userError || !userCheck) {
            console.warn("User not found in database, creating automatically...");

            const { data: newUser, error: createError } = await supabaseClient
                .from("users")
                .insert({
                    name: currentUser.name,
                    email: currentUser.email,
                    password: "default123",
                    role: currentUser.role || "requester"
                })
                .select()
                .single();

            if (createError) {
                console.error("Failed to create user:", createError);
                alert("Error: Your user account could not be created in the database. Please contact the administrator.");
                return;
            }

            // Update session with new user ID
            requesterId = newUser.id;
            currentUser = {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            };
            sessionStorage.setItem("lab_user", JSON.stringify(currentUser));
            localStorage.setItem("lab_user", JSON.stringify(currentUser));
            console.log("User created successfully:", currentUser);
        } else {
            // User exists, use their database ID
            requesterId = userCheck.id;
            currentUser.id = userCheck.id;
            sessionStorage.setItem("lab_user", JSON.stringify(currentUser));
            localStorage.setItem("lab_user", JSON.stringify(currentUser));
            console.log("Using existing user ID:", requesterId);
        }

        // Insert request with confirmed user ID
        const { data: newReq, error } = await supabaseClient
            .from("borrowing_requests")
            .insert({
                equipment_id: equipmentId,
                requester_id: requesterId,
                purpose: purpose,
                due_date: dueDate,
                status: "pending"
            })
            .select()
            .single();

        if (error) throw error;

        // BR-A4-10: Sensitive operation logged
        await createAuditLog(
            "SUBMITTED",
            "Borrowing",
            newReq.id,
            `Submitted borrowing request for ${equipment.code} (${equipment.name})`
        );

        showToast("success", "Request Submitted", `Borrowing request for ${equipment.code} saved as Pending.`);
        alert("Borrowing request saved as Pending.");

        closeModal("requestModal");
        await loadRequests();
        await loadDashboard();

    } catch (err) {
        showToast("error", "Request Failed", err.message);
    }
});

// TC-A4-03: Administrator approves request -> Status becomes Approved; audit log created.
// BR-A4-02: Staff cannot approve their own request.
// Both Administrator and Laboratory Staff may approve or reject requests.
async function approveRequest(requestId) {
    // Both admin and staff can approve
    if (!["admin", "staff"].includes(currentUser.role)) {
        const msg = "Only Administrator or Laboratory Staff may approve or reject requests.";
        showToast("error", "Action Blocked", msg);
        alert(msg);
        return false;
    }

    try {
        const { data: request, error: reqErr } = await supabaseClient
            .from("borrowing_requests")
            .select("*, equipment:equipment_id(code, status)")
            .eq("id", requestId)
            .single();

        if (reqErr || !request) {
            alert("Request not found.");
            return false;
        }

        // BR-A4-02: Staff/Admin cannot approve their own request.
        if (request.requester_id === currentUser.id) {
            const msg = "BR-A4-02: Staff cannot approve their own request.";
            showToast("error", "Action Blocked", msg);
            alert(msg);
            return false;
        }

        if (request.status !== "pending") {
            alert("Only Pending requests can be approved.");
            return false;
        }

        // Update status to 'approved'
        const { error } = await supabaseClient
            .from("borrowing_requests")
            .update({
                status: "approved",
                approved_by: currentUser.id,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq("id", requestId);

        if (error) throw error;

        // BR-A4-10 / TC-A4-08: Check audit log after approval
        // Exact example format:
        // User: Maria Santos
        // Action: APPROVED
        // Module: Borrowing
        // Record ID: 102
        // Description: Approved borrowing request for LAP-001
        await createAuditLog(
            "APPROVED",
            "Borrowing",
            requestId,
            `Approved borrowing request for ${request.equipment?.code || 'Equipment'}`
        );

        showToast("success", "Request Approved", `Request for ${request.equipment?.code} approved.`);
        alert("Request approved!");

        await loadRequests();
        await loadDashboard();
        if (currentUser.role === "admin") await loadAuditLogs();
        return true;

    } catch (err) {
        showToast("error", "Approval Failed", err.message);
        return false;
    }
}

// TC-A4-04: Administrator rejects request -> Status becomes Rejected.
// Both Administrator and Laboratory Staff may approve or reject requests.
async function rejectRequest(requestId) {
    if (!["admin", "staff"].includes(currentUser.role)) {
        const msg = "Only Administrator or Laboratory Staff may approve or reject requests.";
        showToast("error", "Action Blocked", msg);
        alert(msg);
        return false;
    }

    try {
        const { data: request } = await supabaseClient
            .from("borrowing_requests")
            .select("*, equipment:equipment_id(code)")
            .eq("id", requestId)
            .single();

        if (!request) {
            alert("Request not found.");
            return false;
        }

        if (request.status !== "pending") {
            alert("Only Pending requests can be rejected.");
            return false;
        }

        const { error } = await supabaseClient
            .from("borrowing_requests")
            .update({
                status: "rejected",
                approved_by: currentUser.id,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq("id", requestId);

        if (error) throw error;

        // BR-A4-10: Sensitive operation logged
        await createAuditLog(
            "REJECTED",
            "Borrowing",
            requestId,
            `Rejected borrowing request for ${request.equipment?.code || 'Equipment'}`
        );

        showToast("warning", "Request Rejected", `Request for ${request.equipment?.code} rejected.`);
        alert("Request rejected. Status is now Rejected.");

        await loadRequests();
        await loadDashboard();
        if (currentUser.role === "admin") await loadAuditLogs();
        return true;

    } catch (err) {
        showToast("error", "Rejection Failed", err.message);
        return false;
    }
}

// TC-A4-05 & TC-A4-06:
// BR-A4-04: Only Approved requests may be released.
// BR-A4-05: Released equipment becomes Borrowed.
// BR-A4-07: Rejected requests cannot be released.
async function releaseRequest(requestId) {
    if (!["admin", "staff"].includes(currentUser.role)) {
        alert("Access denied. Only Laboratory Staff or Administrator may release equipment.");
        return false;
    }

    try {
        const { data: request, error: reqErr } = await supabaseClient
            .from("borrowing_requests")
            .select("*, equipment:equipment_id(id, code, name, status)")
            .eq("id", requestId)
            .single();

        if (reqErr || !request) {
            alert("Request not found.");
            return false;
        }

        // TC-A4-05 & BR-A4-07: Rejected requests cannot be released
        if (request.status === "rejected") {
            const msg = "BR-A4-07: Rejected requests cannot be released. Operation blocked.";
            showToast("error", "Operation Blocked", msg);
            alert("Operation blocked. Rejected requests cannot be released.");
            return false;
        }

        // BR-A4-04: Only Approved requests may be released
        if (request.status !== "approved") {
            const msg = "BR-A4-04: Only Approved requests may be released. Operation blocked.";
            showToast("error", "Operation Blocked", msg);
            alert("Operation blocked. Only Approved requests may be released.");
            return false;
        }

        // BR-A4-09: Equipment under Maintenance cannot be borrowed
        if (request.equipment?.status === "maintenance") {
            const msg = "BR-A4-09: Equipment under Maintenance cannot be borrowed.";
            showToast("error", "Operation Blocked", msg);
            alert(msg);
            return false;
        }

        // TC-A4-06 & BR-A4-05: Released equipment becomes Borrowed
        const { error: eqError } = await supabaseClient
            .from("equipment")
            .update({
                status: "borrowed",
                updated_at: new Date().toISOString()
            })
            .eq("id", request.equipment_id);

        if (eqError) throw eqError;

        // Update request status to 'released'
        const { error: reqError } = await supabaseClient
            .from("borrowing_requests")
            .update({
                status: "released",
                released_by: currentUser.id,
                released_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq("id", requestId);

        if (reqError) throw reqError;

        // BR-A4-10: Sensitive operation logged
        await createAuditLog(
            "RELEASED",
            "Borrowing",
            requestId,
            `Released equipment ${request.equipment?.code}. Equipment is now Borrowed.`
        );

        showToast("success", "Equipment Released", `Equipment ${request.equipment?.code} released. Equipment is now Borrowed.`);
        alert("Equipment released. Equipment becomes Borrowed.");

        await loadEquipment();
        await loadRequests();
        await loadDashboard();
        if (currentUser.role === "admin") await loadAuditLogs();
        return true;

    } catch (err) {
        showToast("error", "Release Failed", err.message);
        return false;
    }
}

// TC-A4-07: Return released equipment -> Equipment returns to appropriate status.
// BR-A4-06: Returned equipment becomes Available unless damaged.
// BR-A4-08: Returned transactions cannot be processed twice.
function openReturnModal(requestId) {
    if (!["admin", "staff"].includes(currentUser.role)) {
        alert("Access denied. Only Laboratory Staff or Administrator may process returns.");
        return;
    }

    const request = allRequestsCache.find(r => r.id === requestId);
    if (!request) {
        alert("Request not found.");
        return;
    }

    // BR-A4-08: Returned transactions cannot be processed twice
    if (request.status === "returned" || request.status === "closed") {
        const msg = "BR-A4-08: Returned transactions cannot be processed twice. Operation blocked.";
        showToast("error", "Operation Blocked", msg);
        alert("Operation blocked. Returned transactions cannot be processed twice.");
        return;
    }

    if (request.status !== "released" && request.status !== "overdue") {
        alert("Only released or overdue equipment can be returned.");
        return;
    }

    document.getElementById("returnRequestId").value = requestId;
    document.getElementById("returnForm").reset();
    document.querySelector('input[name="returnCondition"][value="good"]').checked = true;
    handleReturnConditionChange();

    document.getElementById("returnModal").classList.remove("hidden");
}

function handleReturnConditionChange() {
    const isDamaged = document.querySelector('input[name="returnCondition"]:checked').value === "damaged";
    const damageDetailsGroup = document.getElementById("damageDetailsGroup");
    const optGood = document.getElementById("optGoodCondition");
    const optDamaged = document.getElementById("optDamaged");

    if (isDamaged) {
        damageDetailsGroup.classList.remove("hidden");
        optDamaged.classList.add("selected-damaged");
        optGood.classList.remove("selected-good");
    } else {
        damageDetailsGroup.classList.add("hidden");
        optDamaged.classList.remove("selected-damaged");
        optGood.classList.add("selected-good");
    }
}

document.getElementById("returnForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const requestId = document.getElementById("returnRequestId").value;
    const condition = document.querySelector('input[name="returnCondition"]:checked').value;
    const isDamaged = condition === "damaged";
    const damageNotes = document.getElementById("damageNotes").value.trim();

    await processReturnExecution(requestId, isDamaged, damageNotes);
    closeModal("returnModal");
});

async function processReturnExecution(requestId, isDamaged, damageNotes = "") {
    try {
        const { data: request, error: reqErr } = await supabaseClient
            .from("borrowing_requests")
            .select("*, equipment:equipment_id(id, code, name)")
            .eq("id", requestId)
            .single();

        if (reqErr || !request) {
            alert("Request not found.");
            return false;
        }

        // BR-A4-08: Returned transactions cannot be processed twice
        if (request.status === "returned" || request.status === "closed") {
            const msg = "BR-A4-08: Returned transactions cannot be processed twice. Operation blocked.";
            showToast("error", "Operation Blocked", msg);
            alert("Operation blocked. Returned transactions cannot be processed twice.");
            return false;
        }

        // TC-A4-07 & BR-A4-06: Returned equipment becomes Available unless damaged
        const newEquipmentStatus = isDamaged ? "maintenance" : "available";

        // Update equipment status
        const { error: eqError } = await supabaseClient
            .from("equipment")
            .update({
                status: newEquipmentStatus,
                updated_at: new Date().toISOString()
            })
            .eq("id", request.equipment_id);

        if (eqError) throw eqError;

        // Verify current user exists in database before setting returned_by
        const { data: userCheck, error: userError } = await supabaseClient
            .from("users")
            .select("id")
            .eq("id", currentUser.id)
            .single();

        const returnUpdateData = {
            status: "returned",
            returned_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (!userError && userCheck) {
            returnUpdateData.returned_by = currentUser.id;
        } else {
            console.warn("Current user not found in database, skipping returned_by field");
        }

        // Update request status to 'returned'
        const { error: reqError } = await supabaseClient
            .from("borrowing_requests")
            .update(returnUpdateData)
            .eq("id", requestId);

        if (reqError) throw reqError;

        // If damaged, auto-file maintenance record (BR-A4-09)
        if (isDamaged) {
            try {
                const maintData = {
                    equipment_id: request.equipment_id,
                    description: damageNotes || `Equipment damaged upon return from borrowing #${requestId.substring(0, 8)}.`,
                    status: "pending"
                };

                // Only set reported_by if user exists in database
                if (!userError && userCheck) {
                    maintData.reported_by = currentUser.id;
                }

                await supabaseClient.from("maintenance_requests").insert(maintData);
            } catch (mErr) {
                console.warn("Auto maintenance creation error:", mErr);
            }
        }

        // BR-A4-10: Sensitive operation logged
        const desc = isDamaged
            ? `Returned equipment ${request.equipment?.code} damaged. Equipment is now under Maintenance.`
            : `Returned equipment ${request.equipment?.code} in good condition. Equipment is now Available.`;

        await createAuditLog("RETURNED", "Borrowing", requestId, desc);

        const alertMsg = isDamaged
            ? "Equipment returned damaged. Equipment is now under Maintenance."
            : "Equipment returned in good condition. Equipment is now Available.";

        showToast("success", "Return Completed", alertMsg);
        alert(alertMsg);

        await loadEquipment();
        await loadRequests();
        await loadMaintenance();
        await loadDashboard();
        if (currentUser.role === "admin") await loadAuditLogs();
        return true;

    } catch (err) {
        showToast("error", "Return Failed", err.message);
        return false;
    }
}

// Close transaction
async function closeRequest(requestId) {
    if (!["admin", "staff"].includes(currentUser.role)) {
        alert("Access denied.");
        return;
    }

    try {
        const { data: request } = await supabaseClient
            .from("borrowing_requests")
            .select("*, equipment:equipment_id(code)")
            .eq("id", requestId)
            .single();

        if (!request) return;

        if (request.status !== "returned") {
            alert("Only Returned requests can be closed.");
            return;
        }

        const { error } = await supabaseClient
            .from("borrowing_requests")
            .update({
                status: "closed",
                updated_at: new Date().toISOString()
            })
            .eq("id", requestId);

        if (error) throw error;

        await createAuditLog("CLOSED", "Borrowing", requestId, `Closed borrowing transaction for ${request.equipment?.code}`);
        showToast("info", "Transaction Closed", `Borrowing transaction closed & archived.`);
        alert("Borrowing transaction closed.");

        await loadRequests();
        await loadDashboard();
        if (currentUser.role === "admin") await loadAuditLogs();

    } catch (err) {
        showToast("error", "Close Failed", err.message);
    }
}

// Automatic Overdue check
async function checkOverdueRequests() {
    if (!["admin", "staff"].includes(currentUser.role)) return;

    const today = new Date().toISOString().split("T")[0];

    try {
        const { data } = await supabaseClient
            .from("borrowing_requests")
            .select("id, due_date")
            .eq("status", "released")
            .lt("due_date", today);

        if (data && data.length > 0) {
            for (const req of data) {
                await supabaseClient
                    .from("borrowing_requests")
                    .update({ status: "overdue", updated_at: new Date().toISOString() })
                    .eq("id", req.id);
            }
            await loadRequests();
        }
    } catch (e) {
        // silent
    }
}

// =========================================================
// MAINTENANCE MANAGEMENT (BR-A4-09)
// =========================================================

async function loadMaintenance() {
    try {
        let query = supabaseClient
            .from("maintenance_requests")
            .select(`
                *,
                equipment:equipment_id(code, name, status, location),
                reporter:reported_by(name, email)
            `)
            .order("created_at", { ascending: false });

        if (currentUser.role === "requester") {
            query = query.eq("reported_by", currentUser.id);
        }

        const { data, error } = await query;
        if (error) throw error;

        renderMaintenanceTable(data || []);

    } catch (err) {
        console.error("Load maintenance error:", err);
    }
}

function renderMaintenanceTable(list) {
    const tbody = document.getElementById("maintenanceTable");
    tbody.innerHTML = "";

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;" class="muted">No maintenance requests recorded.</td></tr>`;
        return;
    }

    list.forEach(item => {
        let actions = "";

        if (["admin", "staff"].includes(currentUser.role)) {
            if (item.status === "pending") {
                actions = `
                    <button class="btn-primary btn-sm" onclick="updateMaintenanceStatus('${item.id}', 'in_progress', '${item.equipment_id}')">
                        Mark In Progress
                    </button>
                `;
            } else if (item.status === "in_progress") {
                actions = `
                    <button class="btn-success btn-sm" onclick="updateMaintenanceStatus('${item.id}', 'completed', '${item.equipment_id}')">
                        Mark Completed & Restore Asset
                    </button>
                `;
            } else {
                actions = `<span class="muted">Completed</span>`;
            }
        } else {
            actions = `<span class="status status-${item.status}">${item.status}</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td><span style="font-family: monospace; font-size: 11px;">#${item.id.substring(0, 8)}</span></td>
                <td>
                    <span class="asset-tag">${item.equipment?.code || "-"}</span>
                    <div style="font-size: 12px;">${item.equipment?.name || ""}</div>
                </td>
                <td>${item.description}</td>
                <td>${item.reporter?.name || "User"}</td>
                <td><span class="status status-${item.status}">${item.status}</span></td>
                <td>${new Date(item.created_at).toLocaleDateString()}</td>
                <td>${actions}</td>
            </tr>
        `;
    });
}

async function openMaintenanceForm(selectedEquipmentId = null) {
    document.getElementById("maintenanceForm").reset();
    
    // Ensure equipment list is fresh and populated in the dropdown
    if (!allEquipmentCache || allEquipmentCache.length === 0) {
        await loadEquipment();
    } else {
        populateEquipmentSelectOptions(allEquipmentCache);
    }
    
    const maintSelect = document.getElementById("maintenanceEquipment");
    if (maintSelect) {
        if (selectedEquipmentId) {
            maintSelect.value = selectedEquipmentId;
        } else if (maintSelect.options.length > 1 && maintSelect.selectedIndex <= 0) {
            // Default to first real equipment option for immediate convenience
            maintSelect.selectedIndex = 1;
        }
    }
    
    document.getElementById("maintenanceModal").classList.remove("hidden");
}

function openMaintenanceFormFor(equipmentId) {
    openMaintenanceForm(equipmentId);
}

document.getElementById("maintenanceForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const equipmentId = document.getElementById("maintenanceEquipment").value;
    const issue = document.getElementById("maintenanceIssue").value.trim();

    if (!equipmentId || !issue) {
        alert("Please complete all required fields.");
        return;
    }

    try {
        // Set equipment status to 'maintenance' so it cannot be borrowed (BR-A4-09)
        await supabaseClient
            .from("equipment")
            .update({ status: "maintenance", updated_at: new Date().toISOString() })
            .eq("id", equipmentId);

        const { data: newMaint, error } = await supabaseClient
            .from("maintenance_requests")
            .insert({
                equipment_id: equipmentId,
                reported_by: currentUser.id,
                description: issue,
                status: "pending"
            })
            .select()
            .single();

        if (error) throw error;

        await createAuditLog("SUBMITTED", "Maintenance", newMaint.id, `Submitted maintenance request for equipment.`);
        showToast("success", "Maintenance Reported", "Equipment flagged and sent to maintenance queue.");
        alert("Maintenance request submitted successfully.");

        closeModal("maintenanceModal");
        await loadEquipment();
        await loadMaintenance();
        await loadDashboard();

    } catch (err) {
        showToast("error", "Error", err.message);
    }
});

async function updateMaintenanceStatus(id, newStatus, equipmentId) {
    if (!["admin", "staff"].includes(currentUser.role)) {
        alert("Access denied.");
        return;
    }

    try {
        const updateData = {
            status: newStatus,
            updated_at: new Date().toISOString()
        };

        if (newStatus === "completed") {
            // Verify current user exists in database before setting completed_by
            const { data: userCheck, error: userError } = await supabaseClient
                .from("users")
                .select("id")
                .eq("id", currentUser.id)
                .single();

            if (userError || !userCheck) {
                console.warn("Current user not found in database, skipping completed_by field");
                // Don't set completed_by if user doesn't exist in DB
            } else {
                updateData.completed_by = currentUser.id;
                updateData.completed_at = new Date().toISOString();
            }

            // Restore equipment to 'available'
            await supabaseClient
                .from("equipment")
                .update({ status: "available", updated_at: new Date().toISOString() })
                .eq("id", equipmentId);
        }

        const { error } = await supabaseClient
            .from("maintenance_requests")
            .update(updateData)
            .eq("id", id);

        if (error) throw error;

        await createAuditLog("UPDATED", "Maintenance", id, `Updated maintenance status to ${newStatus}`);
        showToast("success", "Maintenance Updated", `Status updated to ${newStatus}.`);

        await loadEquipment();
        await loadMaintenance();
        await loadDashboard();

    } catch (err) {
        showToast("error", "Error", err.message);
    }
}

// =========================================================
// USER MANAGEMENT (ADMIN ONLY)
// =========================================================

async function loadUsers() {
    if (currentUser.role !== "admin") return;

    try {
        const { data, error } = await supabaseClient
            .from("users")
            .select("*")
            .order("created_at", { ascending: true });

        if (error) throw error;

        const tbody = document.getElementById("usersTable");
        tbody.innerHTML = "";

        data.forEach(user => {
            const isSelf = user.id === currentUser.id;

            tbody.innerHTML += `
                <tr>
                    <td><span style="font-family: monospace; font-size: 11px;">#${user.id.substring(0, 8)}</span></td>
                    <td><strong>${user.name}</strong></td>
                    <td>${user.email}</td>
                    <td>
                        <select id="roleSelect-${user.id}" ${isSelf ? 'disabled' : ''} style="padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-color); font-weight: 600;">
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrator</option>
                            <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>Laboratory Staff</option>
                            <option value="requester" ${user.role === 'requester' ? 'selected' : ''}>Requester</option>
                        </select>
                    </td>
                    <td>
                        ${isSelf
                    ? `<span class="muted">(Current Logged-in User)</span>`
                    : `
                        <div class="table-actions">
                            <button class="btn-primary btn-sm" onclick="saveUserRole('${user.id}')">Save Role</button>
                            <button class="btn-danger btn-sm" onclick="deleteUser('${user.id}')">Delete</button>
                        </div>
                    `
                }
                    </td>
                </tr>
            `;
        });

    } catch (err) {
        console.error("Load users error:", err);
    }
}

function openUserModal() {
    if (currentUser.role !== "admin") {
        alert("Access denied. Only Administrator may add users.");
        return;
    }
    const form = document.getElementById("userForm");
    if (form) form.reset();
    document.getElementById("userModal").classList.remove("hidden");
}

document.getElementById("userForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (currentUser.role !== "admin") {
        alert("Access denied. Only Administrator may add users.");
        return;
    }

    const name = document.getElementById("userNameInput").value.trim();
    const email = document.getElementById("userEmailInput").value.trim().toLowerCase();
    const password = document.getElementById("userPasswordInput").value;
    const role = document.getElementById("userRoleInput").value;

    if (!name || !email || !password) {
        alert("Please complete all required fields.");
        return;
    }

    try {
        const { data: newUser, error } = await supabaseClient
            .from("users")
            .insert({
                name: name,
                email: email,
                password: password,
                role: role
            })
            .select()
            .single();

        if (error) throw error;

        await createAuditLog("CREATED", "Users", newUser.id, `Created user account for ${name} (${email}) with role ${role}.`);
        showToast("success", "User Created", `User ${name} successfully added.`);
        alert("User account created successfully.");

        closeModal("userModal");
        await loadUsers();
        await loadAuditLogs();
        await loadReports();

    } catch (err) {
        showToast("error", "Create User Failed", err.message);
    }
});

async function deleteUser(userId) {
    if (currentUser.role !== "admin") {
        alert("Access denied. Only Administrator may delete users.");
        return;
    }

    if (userId === currentUser.id) {
        alert("You cannot delete your own logged-in administrator account.");
        return;
    }

    if (!confirm("Are you sure you want to permanently delete this user account?")) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("users")
            .delete()
            .eq("id", userId);

        if (error) throw error;

        await createAuditLog("DELETED", "Users", userId, "Deleted user account.");
        showToast("success", "User Deleted", "User account removed.");
        alert("User account deleted successfully.");

        await loadUsers();
        await loadAuditLogs();
        await loadReports();

    } catch (err) {
        showToast("error", "Delete Failed", err.message);
    }
}

async function saveUserRole(userId) {
    if (currentUser.role !== "admin") {
        alert("Access denied.");
        return;
    }

    const select = document.getElementById(`roleSelect-${userId}`);
    const newRole = select.value;

    try {
        const { error } = await supabaseClient
            .from("users")
            .update({ role: newRole, updated_at: new Date().toISOString() })
            .eq("id", userId);

        if (error) throw error;

        // BR-A4-10: Sensitive operation logged
        await createAuditLog("ROLE_UPDATED", "Users", userId, `Changed user role to ${newRole}`);
        showToast("success", "Role Updated", `User role updated to ${newRole}.`);
        alert("User role updated successfully.");

        await loadUsers();
        await loadAuditLogs();

    } catch (err) {
        showToast("error", "Update Failed", err.message);
    }
}

// =========================================================
// AUDIT LOGS TRAIL (ADMIN ONLY - BR-A4-10, TC-A4-08)
// =========================================================

async function createAuditLog(action, module, recordId, description) {
    if (!currentUser) return;

    try {
        const { error } = await supabaseClient.from("audit_logs").insert({
            user_id: currentUser.id,
            action: action.toUpperCase(),
            module: module,
            record_id: recordId || null,
            description: description
        });

        if (error) console.warn("Audit logging warning:", error.message);
    } catch (e) {
        console.warn("Audit log creation error:", e);
    }
}

async function loadAuditLogs() {
    if (currentUser.role !== "admin") return;

    try {
        const { data, error } = await supabaseClient
            .from("audit_logs")
            .select(`
                *,
                user:user_id(name, email, role)
            `)
            .order("created_at", { ascending: false });

        if (error) throw error;

        allAuditCache = data || [];
        renderAuditTable(allAuditCache);

    } catch (err) {
        console.error("Load audit error:", err);
    }
}

function renderAuditTable(logsList) {
    const tbody = document.getElementById("auditTable");
    tbody.innerHTML = "";

    if (!logsList || logsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;" class="muted">No audit logs recorded yet.</td></tr>`;
        return;
    }

    logsList.forEach(log => {
        tbody.innerHTML += `
            <tr>
                <td><span style="font-family: monospace; font-size: 11px;">#${log.id.substring(0, 8)}</span></td>
                <td>
                    <strong>${log.user?.name || "System"}</strong>
                    <div style="font-size: 11px; color: var(--text-muted);">${log.user?.role?.toUpperCase() || ""}</div>
                </td>
                <td>
                    <span class="audit-action-badge audit-${log.action}">
                        ${log.action}
                    </span>
                </td>
                <td><strong>${log.module}</strong></td>
                <td><span style="font-family: monospace; font-size: 11px;">${log.record_id ? '#' + log.record_id.substring(0, 8) : '-'}</span></td>
                <td>${log.description || ""}</td>
                <td><span style="font-size: 12px;">${new Date(log.created_at).toLocaleString()}</span></td>
            </tr>
        `;
    });
}

function filterAuditTable() {
    const search = document.getElementById("auditSearchInput").value.toLowerCase();
    const mod = document.getElementById("auditModuleFilter").value;
    const act = document.getElementById("auditActionFilter").value;

    const filtered = allAuditCache.filter(l => {
        const matchSearch =
            (l.user?.name && l.user.name.toLowerCase().includes(search)) ||
            (l.description && l.description.toLowerCase().includes(search)) ||
            (l.record_id && l.record_id.toLowerCase().includes(search));
        const matchMod = !mod || l.module === mod;
        const matchAct = !act || l.action === act;
        return matchSearch && matchMod && matchAct;
    });

    renderAuditTable(filtered);
}

// =========================================================
// REPORTS & ANALYTICS (ADMIN ONLY)
// =========================================================

async function loadReports() {
    if (currentUser.role !== "admin") return;

    try {
        const { data: users } = await supabaseClient.from("users").select("id");
        const { data: requests } = await supabaseClient.from("borrowing_requests").select("status");
        const { data: maintenance } = await supabaseClient.from("maintenance_requests").select("status");

        const totalUsers = users ? users.length : 0;
        document.getElementById("totalUsers").textContent = totalUsers;

        const reqList = requests || [];
        const activeReqCount = reqList.filter(r => ["pending", "approved", "released"].includes(r.status)).length;
        const completedReqCount = reqList.filter(r => ["returned", "closed", "rejected"].includes(r.status)).length;
        const pendingMaintCount = maintenance ? maintenance.filter(m => m.status === "pending").length : 0;

        document.getElementById("activeRequests").textContent = activeReqCount;
        document.getElementById("completedRequests").textContent = completedReqCount;
        document.getElementById("pendingMaintenance").textContent = pendingMaintCount;

        // Breakdown table for all 7 required statuses
        const statusOrder = ["pending", "approved", "rejected", "released", "returned", "overdue", "closed"];
        const counts = {};
        statusOrder.forEach(s => counts[s] = 0);

        reqList.forEach(r => {
            if (counts[r.status] !== undefined) counts[r.status]++;
        });

        const totalRequests = reqList.length;
        const breakdownTbody = document.getElementById("statusBreakdown");
        breakdownTbody.innerHTML = "";

        statusOrder.forEach(status => {
            const count = counts[status];
            const pct = totalRequests > 0 ? ((count / totalRequests) * 100).toFixed(1) : "0.0";

            breakdownTbody.innerHTML += `
                <tr>
                    <td><span class="status status-${status}">${status}</span></td>
                    <td><strong>${count}</strong></td>
                    <td style="width: 45%;">
                        <div style="background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="background: var(--primary); width: ${pct}%; height: 100%;"></div>
                        </div>
                    </td>
                    <td>${pct}%</td>
                </tr>
            `;
        });

    } catch (err) {
        console.error("Load reports error:", err);
    }
}

// =========================================================
// UI HELPERS & TOAST NOTIFICATIONS
// =========================================================

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add("hidden");
}

function showToast(type, title, message) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const icons = {
        success: "✅",
        error: "🚫",
        warning: "⚠️",
        info: "ℹ️"
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || "ℹ️"}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(20px)";
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}
