let currentUser = null;
let currentProfile = null;


// ============================================================
// START SYSTEM
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    const {
        data: {
            session
        }
    } = await supabaseClient.auth.getSession();

    if (!session) {

        window.location.href = "login.html";

        return;
    }

    currentUser = session.user;

    await loadProfile();

    if (!currentProfile) {

        alert("User profile not found.");

        await logout();

        return;
    }

    setupInterface();

    await loadDashboard();

    await loadEquipment();

    await loadRequests();

    await loadMaintenance();

    if (currentProfile.role === "admin") {

        await loadUsers();

        await loadAuditLogs();

    }

});


// ============================================================
// LOAD PROFILE
// ============================================================

async function loadProfile() {

    const {
        data,
        error
    } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();

    if (error) {

        console.error(error);

        return;
    }

    currentProfile = data;

}


// ============================================================
// ROLE BASED INTERFACE
// ============================================================

function setupInterface() {

    document.getElementById("userName")
        .textContent =
        currentProfile.full_name;

    document.getElementById("userRole")
        .textContent =
        currentProfile.role.toUpperCase();


    const usersNav =
        document.getElementById("usersNav");

    const auditNav =
        document.getElementById("auditNav");

    const addEquipmentButton =
        document.getElementById(
            "addEquipmentButton"
        );


    // ADMIN

    if (currentProfile.role === "admin") {

        usersNav.style.display = "block";

        auditNav.style.display = "block";

        addEquipmentButton.style.display =
            "inline-block";

    }


    // STAFF

    else if (currentProfile.role === "staff") {

        usersNav.style.display = "none";

        auditNav.style.display = "none";

        addEquipmentButton.style.display =
            "none";

    }


    // REQUESTER

    else {

        usersNav.style.display = "none";

        auditNav.style.display = "none";

        addEquipmentButton.style.display =
            "none";

    }

}


// ============================================================
// SECTION NAVIGATION
// ============================================================

function showSection(sectionId) {

    const allowedSections = {

        admin: [
            "dashboard",
            "equipment",
            "requests",
            "maintenance",
            "users",
            "audit"
        ],

        staff: [
            "dashboard",
            "equipment",
            "requests",
            "maintenance"
        ],

        requester: [
            "dashboard",
            "equipment",
            "requests",
            "maintenance"
        ]

    };


    if (
        !allowedSections[currentProfile.role]
            .includes(sectionId)
    ) {

        alert("Access denied.");

        return;
    }


    document.querySelectorAll(".section")
        .forEach(section => {

            section.classList.add("hidden");

        });


    const section =
        document.getElementById(sectionId);

    if (!section) {

        alert("Page not found.");

        return;
    }


    section.classList.remove("hidden");


    if (sectionId === "equipment") {

        loadEquipment();

    }

    if (sectionId === "requests") {

        loadRequests();

    }

    if (sectionId === "maintenance") {

        loadMaintenance();

    }

    if (sectionId === "users"
        && currentProfile.role === "admin") {

        loadUsers();

    }

    if (sectionId === "audit"
        && currentProfile.role === "admin") {

        loadAuditLogs();

    }

}


// ============================================================
// DASHBOARD
// ============================================================

async function loadDashboard() {

    const {
        data: equipment
    } = await supabaseClient
        .from("equipment")
        .select("*");

    const {
        data: requests
    } = await supabaseClient
        .from("borrowing_requests")
        .select("*");


    const totalEquipment =
        equipment ? equipment.length : 0;


    const availableEquipment =
        equipment
            ? equipment.filter(
                item =>
                    item.status === "available"
                    && item.available_quantity > 0
            ).length
            : 0;


    const pendingRequests =
        requests
            ? requests.filter(
                request =>
                    request.status === "Pending"
            ).length
            : 0;


    const myRequests =
        requests
            ? requests.filter(
                request =>
                    request.requester_id ===
                    currentUser.id
            ).length
            : 0;


    document.getElementById(
        "totalEquipment"
    ).textContent = totalEquipment;


    document.getElementById(
        "availableEquipment"
    ).textContent = availableEquipment;


    document.getElementById(
        "pendingRequests"
    ).textContent = pendingRequests;


    document.getElementById(
        "myRequests"
    ).textContent = myRequests;

}


// ============================================================
// EQUIPMENT
// ============================================================

async function loadEquipment() {

    const {
        data,
        error
    } = await supabaseClient
        .from("equipment")
        .select("*")
        .order("id", {
            ascending: true
        });


    if (error) {

        console.error(error);

        return;
    }


    const table =
        document.getElementById(
            "equipmentTable"
        );

    table.innerHTML = "";


    data.forEach(item => {

        const actions =
            currentProfile.role === "admin"

                ?

                `
                <button
                    class="btn-danger"
                    onclick="deleteEquipment(${item.id})">
                    Delete
                </button>
                `

                :

                `<span class="muted">No action</span>`;


        table.innerHTML += `

            <tr>

                <td>${item.id}</td>

                <td>${item.asset_code}</td>

                <td>${item.equipment_name}</td>

                <td>${item.category || ""}</td>

                <td>${item.quantity}</td>

                <td>${item.available_quantity}</td>

                <td>
                    <span class="status ${item.status}">
                        ${item.status}
                    </span>
                </td>

                <td>${item.location || ""}</td>

                <td>${actions}</td>

            </tr>

        `;

    });


    loadEquipmentOptions(data);

}


// ============================================================
// EQUIPMENT OPTIONS
// ============================================================

function loadEquipmentOptions(equipment) {

    const requestSelect =
        document.getElementById(
            "requestEquipment"
        );

    const maintenanceSelect =
        document.getElementById(
            "maintenanceEquipment"
        );


    requestSelect.innerHTML =
        `<option value="">Select Equipment</option>`;


    maintenanceSelect.innerHTML =
        `<option value="">Select Equipment</option>`;


    equipment.forEach(item => {

        if (
            item.status === "available"
            && item.available_quantity > 0
        ) {

            requestSelect.innerHTML += `

                <option value="${item.id}">
                    ${item.asset_code} -
                    ${item.equipment_name}
                    (${item.available_quantity} available)
                </option>

            `;

        }


        maintenanceSelect.innerHTML += `

            <option value="${item.id}">
                ${item.asset_code} -
                ${item.equipment_name}
            </option>

        `;

    });

}


// ============================================================
// OPEN EQUIPMENT FORM
// ============================================================

function openEquipmentForm() {

    if (currentProfile.role !== "admin") {

        alert("Access denied.");

        return;
    }

    document
        .getElementById("equipmentModal")
        .classList.remove("hidden");

}


// ============================================================
// SAVE EQUIPMENT
// ============================================================

document
    .getElementById("equipmentForm")
    .addEventListener("submit", async event => {

        event.preventDefault();


        if (currentProfile.role !== "admin") {

            alert("Only Administrator can add equipment.");

            return;
        }


        const assetCode =
            document.getElementById(
                "assetCode"
            ).value.trim();


        const name =
            document.getElementById(
                "equipmentName"
            ).value.trim();


        const category =
            document.getElementById(
                "equipmentCategory"
            ).value.trim();


        const description =
            document.getElementById(
                "equipmentDescription"
            ).value.trim();


        const quantity =
            Number(
                document.getElementById(
                    "equipmentQuantity"
                ).value
            );


        const location =
            document.getElementById(
                "equipmentLocation"
            ).value.trim();


        if (quantity <= 0) {

            alert("Quantity must be greater than zero.");

            return;
        }


        const {
            error
        } = await supabaseClient
            .from("equipment")
            .insert({

                asset_code: assetCode,

                equipment_name: name,

                category,

                description,

                quantity,

                available_quantity: quantity,

                status: "available",

                location

            });


        if (error) {

            alert(
                "Unable to add equipment: "
                + error.message
            );

            return;
        }


        await createAuditLog(
            "CREATED",
            "Equipment",
            null,
            "Created equipment " + assetCode
        );


        alert("Equipment added successfully.");

        closeModal("equipmentModal");

        document
            .getElementById("equipmentForm")
            .reset();

        await loadEquipment();

        await loadDashboard();

    });


// ============================================================
// DELETE EQUIPMENT
// ============================================================

async function deleteEquipment(id) {

    if (currentProfile.role !== "admin") {

        alert("Access denied.");

        return;
    }


    const confirmDelete =
        confirm(
            "Are you sure you want to delete this equipment?"
        );


    if (!confirmDelete) return;


    const {
        data: item
    } = await supabaseClient
        .from("equipment")
        .select("asset_code")
        .eq("id", id)
        .single();


    const {
        error
    } = await supabaseClient
        .from("equipment")
        .delete()
        .eq("id", id);


    if (error) {

        alert(
            "Delete failed: "
            + error.message
        );

        return;
    }


    await createAuditLog(
        "DELETED",
        "Equipment",
        id,
        "Deleted equipment "
        + (item?.asset_code || "")
    );


    alert("Equipment deleted.");

    await loadEquipment();

    await loadDashboard();

}


// ============================================================
// BORROWING REQUESTS
// ============================================================

async function loadRequests() {

    let query =
        supabaseClient
            .from("borrowing_requests")
            .select(`
                *,
                profiles:requester_id(
                    full_name,
                    email
                ),
                equipment:equipment_id(
                    asset_code,
                    equipment_name
                )
            `)
            .order("id", {
                ascending: false
            });


    if (currentProfile.role === "requester") {

        query = query.eq(
            "requester_id",
            currentUser.id
        );

    }


    const {
        data,
        error
    } = await query;


    if (error) {

        console.error(error);

        return;
    }


    const table =
        document.getElementById(
            "requestsTable"
        );

    table.innerHTML = "";


    data.forEach(request => {

        let actions = "";


        // ADMIN APPROVAL

        if (
            currentProfile.role === "admin"
            && request.status === "Pending"
        ) {

            actions += `

                <button
                    class="btn-success"
                    onclick="approveRequest(${request.id})">
                    Approve
                </button>

                <button
                    class="btn-danger"
                    onclick="rejectRequest(${request.id})">
                    Reject
                </button>

            `;

        }


        // RELEASE

        if (
            ["admin", "staff"]
                .includes(currentProfile.role)
            && request.status === "Approved"
        ) {

            actions += `

                <button
                    class="btn-primary"
                    onclick="releaseRequest(${request.id})">
                    Release
                </button>

            `;

        }


        // RETURN

        if (
            ["admin", "staff"]
                .includes(currentProfile.role)
            && request.status === "Released"
        ) {

            actions += `

                <button
                    class="btn-warning"
                    onclick="returnRequest(${request.id})">
                    Return
                </button>

            `;

        }


        table.innerHTML += `

            <tr>

                <td>${request.id}</td>

                <td>
                    ${request.profiles?.full_name || "Unknown"}
                </td>

                <td>
                    ${request.equipment?.asset_code || ""}
                    -
                    ${request.equipment?.equipment_name || ""}
                </td>

                <td>${request.quantity}</td>

                <td>${request.purpose}</td>

                <td>${request.due_date || "-"}</td>

                <td>

                    <span class="status status-${request.status}">
                        ${request.status}
                    </span>

                </td>

                <td>

                    ${actions || '<span class="muted">No action</span>'}

                </td>

            </tr>

        `;

    });

}


// ============================================================
// OPEN REQUEST FORM
// ============================================================

async function openRequestForm() {

    await loadEquipment();


    document
        .getElementById("requestModal")
        .classList.remove("hidden");

}


// ============================================================
// CREATE BORROWING REQUEST
// ============================================================

document
    .getElementById("requestForm")
    .addEventListener("submit", async event => {

        event.preventDefault();


        const equipmentId =
            Number(
                document.getElementById(
                    "requestEquipment"
                ).value
            );


        const quantity =
            Number(
                document.getElementById(
                    "requestQuantity"
                ).value
            );


        const purpose =
            document.getElementById(
                "requestPurpose"
            ).value.trim();


        const dueDate =
            document.getElementById(
                "requestDueDate"
            ).value;


        if (!equipmentId) {

            alert("Select equipment.");

            return;
        }


        if (quantity <= 0) {

            alert("Quantity must be greater than zero.");

            return;
        }


        // BR-A4-01
        // Only available equipment may be requested.

        const {
            data: equipment
        } = await supabaseClient
            .from("equipment")
            .select("*")
            .eq("id", equipmentId)
            .single();


        if (!equipment) {

            alert("Equipment not found.");

            return;
        }


        if (
            equipment.status !== "available"
            || equipment.available_quantity < quantity
        ) {

            alert(
                "BR-A4-01: Only available equipment may be requested."
            );

            return;
        }


        // BR-A4-09

        if (equipment.status === "maintenance") {

            alert(
                "BR-A4-09: Equipment under Maintenance cannot be borrowed."
            );

            return;
        }


        const {
            error
        } = await supabaseClient
            .from("borrowing_requests")
            .insert({

                requester_id:
                    currentUser.id,

                equipment_id:
                    equipmentId,

                quantity,

                purpose,

                due_date:
                    dueDate,

                status:
                    "Pending"

            });


        if (error) {

            alert(
                "Request failed: "
                + error.message
            );

            return;
        }


        await createAuditLog(
            "SUBMITTED",
            "Borrowing",
            null,
            "Submitted borrowing request for "
            + equipment.asset_code
        );


        alert(
            "Borrowing request submitted as Pending."
        );


        closeModal("requestModal");

        document
            .getElementById("requestForm")
            .reset();


        await loadRequests();

        await loadDashboard();

    });


// ============================================================
// APPROVE
// ============================================================

async function approveRequest(id) {

    if (currentProfile.role !== "admin") {

        alert(
            "BR-A4-03: Only Administrator may approve requests."
        );

        return;
    }


    const {
        data: request,
        error: requestError
    } = await supabaseClient
        .from("borrowing_requests")
        .select(`
            *,
            equipment:equipment_id(
                asset_code,
                equipment_name,
                status,
                available_quantity
            )
        `)
        .eq("id", id)
        .single();


    if (requestError || !request) {

        alert("Request not found.");

        return;
    }


    if (request.status !== "Pending") {

        alert(
            "Only Pending requests can be approved."
        );

        return;
    }


    if (
        request.equipment.status !== "available"
        || request.equipment.available_quantity
            < request.quantity
    ) {

        alert(
            "Equipment is no longer available."
        );

        return;
    }


    // BR-A4-02
    // Staff cannot approve their own request.

    if (
        request.requester_id ===
        currentUser.id
    ) {

        alert(
            "BR-A4-02: You cannot approve your own request."
        );

        return;
    }


    const {
        error
    } = await supabaseClient
        .from("borrowing_requests")
        .update({

            status: "Approved",

            reviewed_by:
                currentUser.id,

            reviewed_at:
                new Date().toISOString()

        })
        .eq("id", id);


    if (error) {

        alert(
            "Approval failed: "
            + error.message
        );

        return;
    }


    await createAuditLog(
        "APPROVED",
        "Borrowing",
        id,
        "Approved borrowing request for "
        + request.equipment.asset_code
    );


    alert("Request approved.");

    await loadRequests();

    await loadDashboard();

}


// ============================================================
// REJECT
// ============================================================

async function rejectRequest(id) {

    if (currentProfile.role !== "admin") {

        alert(
            "BR-A4-03: Only Administrator may reject requests."
        );

        return;
    }


    const {
        data: request
    } = await supabaseClient
        .from("borrowing_requests")
        .select(`
            *,
            equipment:equipment_id(asset_code)
        `)
        .eq("id", id)
        .single();


    if (!request) {

        alert("Request not found.");

        return;
    }


    if (request.status !== "Pending") {

        alert(
            "Only Pending requests can be rejected."
        );

        return;
    }


    const {
        error
    } = await supabaseClient
        .from("borrowing_requests")
        .update({

            status: "Rejected",

            reviewed_by:
                currentUser.id,

            reviewed_at:
                new Date().toISOString()

        })
        .eq("id", id);


    if (error) {

        alert(
            "Rejection failed: "
            + error.message
        );

        return;
    }


    await createAuditLog(
        "REJECTED",
        "Borrowing",
        id,
        "Rejected borrowing request for "
        + request.equipment.asset_code
    );


    alert("Request rejected.");

    await loadRequests();

    await loadDashboard();

}


// ============================================================
// RELEASE
// ============================================================

async function releaseRequest(id) {

    if (
        !["admin", "staff"]
            .includes(currentProfile.role)
    ) {

        alert("Access denied.");

        return;
    }


    const {
        data: request
    } = await supabaseClient
        .from("borrowing_requests")
        .select(`
            *,
            equipment:equipment_id(
                asset_code,
                equipment_name,
                available_quantity,
                status
            )
        `)
        .eq("id", id)
        .single();


    if (!request) {

        alert("Request not found.");

        return;
    }


    // BR-A4-04

    if (request.status !== "Approved") {

        alert(
            "BR-A4-04: Only Approved requests may be released."
        );

        return;
    }


    // BR-A4-07

    if (request.status === "Rejected") {

        alert(
            "BR-A4-07: Rejected requests cannot be released."
        );

        return;
    }


    if (
        request.equipment.status !== "available"
        || request.equipment.available_quantity
            < request.quantity
    ) {

        alert(
            "Equipment is no longer available."
        );

        return;
    }


    // Reduce available quantity

    const newAvailable =
        request.equipment.available_quantity
        - request.quantity;


    const newStatus =
        newAvailable <= 0
            ? "borrowed"
            : "available";


    const {
        error: equipmentError
    } = await supabaseClient
        .from("equipment")
        .update({

            available_quantity:
                newAvailable,

            status:
                newStatus

        })
        .eq(
            "id",
            request.equipment_id
        );


    if (equipmentError) {

        alert(
            "Equipment update failed: "
            + equipmentError.message
        );

        return;
    }


    const {
        error
    } = await supabaseClient
        .from("borrowing_requests")
        .update({

            status: "Released",

            released_at:
                new Date().toISOString()

        })
        .eq("id", id);


    if (error) {

        alert(
            "Release failed: "
            + error.message
        );

        return;
    }


    // BR-A4-05

    await createAuditLog(
        "RELEASED",
        "Borrowing",
        id,
        "Released equipment "
        + request.equipment.asset_code
        + ". Equipment is now Borrowed."
    );


    alert("Equipment released.");

    await loadEquipment();

    await loadRequests();

    await loadDashboard();

}


// ============================================================
// RETURN
// ============================================================

async function returnRequest(id) {

    if (
        !["admin", "staff"]
            .includes(currentProfile.role)
    ) {

        alert("Access denied.");

        return;
    }


    const {
        data: request
    } = await supabaseClient
        .from("borrowing_requests")
        .select(`
            *,
            equipment:equipment_id(
                asset_code,
                equipment_name,
                quantity,
                available_quantity,
                status
            )
        `)
        .eq("id", id)
        .single();


    if (!request) {

        alert("Request not found.");

        return;
    }


    // BR-A4-08

    if (
        request.status === "Returned"
        || request.status === "Closed"
    ) {

        alert(
            "BR-A4-08: Returned transactions cannot be processed twice."
        );

        return;
    }


    if (
        request.status !== "Released"
        && request.status !== "Overdue"
    ) {

        alert(
            "Only released equipment can be returned."
        );

        return;
    }


    const damaged =
        confirm(
            "Is the equipment damaged?"
            + "\n\nOK = Damaged"
            + "\nCancel = Good condition"
        );


    const newAvailable =
        damaged
            ? request.equipment.available_quantity
            : request.equipment.available_quantity
                + request.quantity;


    const newStatus =
        damaged
            ? "maintenance"
            : "available";


    const {
        error: equipmentError
    } = await supabaseClient
        .from("equipment")
        .update({

            available_quantity:
                newAvailable,

            status:
                newStatus

        })
        .eq(
            "id",
            request.equipment_id
        );


    if (equipmentError) {

        alert(
            "Equipment return update failed: "
            + equipmentError.message
        );

        return;
    }


    const {
        error
    } = await supabaseClient
        .from("borrowing_requests")
        .update({

            status: "Returned",

            returned_at:
                new Date().toISOString(),

            notes:
                damaged
                    ? "Returned damaged. Sent to maintenance."
                    : "Returned in good condition."

        })
        .eq("id", id);


    if (error) {

        alert(
            "Return failed: "
            + error.message
        );

        return;
    }


    await createAuditLog(
        "RETURNED",
        "Borrowing",
        id,
        "Returned "
        + request.equipment.asset_code
        + (
            damaged
                ? " damaged and sent to maintenance."
                : " in good condition."
        )
    );


    alert(
        damaged
            ? "Returned. Equipment is now under Maintenance."
            : "Returned. Equipment is now Available."
    );


    await loadEquipment();

    await loadRequests();

    await loadDashboard();

}


// ============================================================
// MAINTENANCE
// ============================================================

async function loadMaintenance() {

    let query =
        supabaseClient
            .from("maintenance_requests")
            .select(`
                *,
                equipment:equipment_id(
                    asset_code,
                    equipment_name
                ),
                profiles:requested_by(
                    full_name
                )
            `)
            .order("id", {
                ascending: false
            });


    if (currentProfile.role === "requester") {

        query =
            query.eq(
                "requested_by",
                currentUser.id
            );

    }


    const {
        data,
        error
    } = await query;


    if (error) {

        console.error(error);

        return;
    }


    const table =
        document.getElementById(
            "maintenanceTable"
        );

    table.innerHTML = "";


    data.forEach(item => {

        table.innerHTML += `

            <tr>

                <td>${item.id}</td>

                <td>
                    ${item.equipment?.asset_code || ""}
                    -
                    ${item.equipment?.equipment_name || ""}
                </td>

                <td>
                    ${item.issue_description}
                </td>

                <td>
                    ${item.profiles?.full_name || ""}
                </td>

                <td>
                    <span class="status">
                        ${item.status}
                    </span>
                </td>

                <td>
                    ${new Date(
                        item.created_at
                    ).toLocaleDateString()}
                </td>

            </tr>

        `;

    });

}


function openMaintenanceForm() {

    document
        .getElementById("maintenanceModal")
        .classList.remove("hidden");

}


document
    .getElementById("maintenanceForm")
    .addEventListener("submit", async event => {

        event.preventDefault();


        const equipmentId =
            Number(
                document.getElementById(
                    "maintenanceEquipment"
                ).value
            );


        const issue =
            document.getElementById(
                "maintenanceIssue"
            ).value.trim();


        if (!equipmentId || !issue) {

            alert("Complete the form.");

            return;
        }


        const {
            error
        } = await supabaseClient
            .from("maintenance_requests")
            .insert({

                equipment_id:
                    equipmentId,

                requested_by:
                    currentUser.id,

                issue_description:
                    issue,

                status:
                    "Pending"

            });


        if (error) {

            alert(
                "Maintenance request failed: "
                + error.message
            );

            return;
        }


        await createAuditLog(
            "SUBMITTED",
            "Maintenance",
            null,
            "Submitted maintenance request."
        );


        alert(
            "Maintenance request submitted."
        );


        closeModal("maintenanceModal");

        document
            .getElementById("maintenanceForm")
            .reset();


        await loadMaintenance();

    });


// ============================================================
// USERS
// ============================================================

async function loadUsers() {

    if (currentProfile.role !== "admin") {

        alert("Access denied.");

        return;
    }


    const {
        data,
        error
    } = await supabaseClient
        .from("profiles")
        .select("*")
        .order("created_at", {
            ascending: true
        });


    if (error) {

        console.error(error);

        return;
    }


    const table =
        document.getElementById(
            "usersTable"
        );

    table.innerHTML = "";


    data.forEach(user => {

        table.innerHTML += `

            <tr>

                <td>${user.id}</td>

                <td>${user.full_name}</td>

                <td>${user.email || ""}</td>

                <td>

                    <select
                        id="role-${user.id}"
                        ${user.id === currentUser.id
                            ? "disabled"
                            : ""}>

                        <option
                            value="requester"
                            ${user.role === "requester"
                                ? "selected"
                                : ""}>
                            Requester
                        </option>

                        <option
                            value="staff"
                            ${user.role === "staff"
                                ? "selected"
                                : ""}>
                            Staff
                        </option>

                        <option
                            value="admin"
                            ${user.role === "admin"
                                ? "selected"
                                : ""}>
                            Administrator
                        </option>

                    </select>

                </td>

                <td>

                    ${
                        user.id === currentUser.id

                        ?

                        "<span class='muted'>Current user</span>"

                        :

                        `
                        <button
                            class="btn-primary"
                            onclick="updateRole('${user.id}')">
                            Save Role
                        </button>
                        `
                    }

                </td>

            </tr>

        `;

    });

}


// ============================================================
// UPDATE ROLE
// ============================================================

async function updateRole(userId) {

    if (currentProfile.role !== "admin") {

        alert("Access denied.");

        return;
    }


    const select =
        document.getElementById(
            "role-" + userId
        );


    const newRole =
        select.value;


    const {
        error
    } = await supabaseClient
        .from("profiles")
        .update({
            role: newRole
        })
        .eq("id", userId);


    if (error) {

        alert(
            "Role update failed: "
            + error.message
        );

        return;
    }


    await createAuditLog(
        "ROLE_UPDATED",
        "Users",
        null,
        "Changed user role to "
        + newRole
    );


    alert("Role updated.");

    await loadUsers();

}


// ============================================================
// AUDIT LOG
// ============================================================

async function createAuditLog(
    action,
    module,
    recordId,
    description
) {

    const {
        error
    } = await supabaseClient
        .from("audit_logs")
        .insert({

            user_id:
                currentUser.id,

            action,

            module,

            record_id:
                recordId,

            description

        });


    if (error) {

        console.error(
            "Audit log failed:",
            error
        );

    }

}


// ============================================================
// LOAD AUDIT LOGS
// ============================================================

async function loadAuditLogs() {

    if (currentProfile.role !== "admin") {

        alert("Access denied.");

        return;
    }


    const {
        data,
        error
    } = await supabaseClient
        .from("audit_logs")
        .select(`
            *,
            profiles:user_id(
                full_name,
                email
            )
        `)
        .order("id", {
            ascending: false
        });


    if (error) {

        console.error(error);

        return;
    }


    const table =
        document.getElementById(
            "auditTable"
        );

    table.innerHTML = "";


    data.forEach(log => {

        table.innerHTML += `

            <tr>

                <td>${log.id}</td>

                <td>
                    ${log.profiles?.full_name || "Unknown"}
                </td>

                <td>
                    <strong>
                        ${log.action}
                    </strong>
                </td>

                <td>${log.module}</td>

                <td>
                    ${log.record_id || "-"}
                </td>

                <td>
                    ${log.description || ""}
                </td>

                <td>
                    ${new Date(
                        log.created_at
                    ).toLocaleString()}
                </td>

            </tr>

        `;

    });

}


// ============================================================
// MODAL
// ============================================================

function closeModal(id) {

    document
        .getElementById(id)
        .classList.add("hidden");

}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    await supabaseClient.auth.signOut();

    window.location.href = "login.html";

}


// ============================================================
// AUTOMATIC OVERDUE CHECK
// ============================================================

async function checkOverdueRequests() {

    if (
        !currentProfile
        || !["admin", "staff"]
            .includes(currentProfile.role)
    ) {

        return;
    }


    const today =
        new Date()
            .toISOString()
            .split("T")[0];


    const {
        data
    } = await supabaseClient
        .from("borrowing_requests")
        .select("*")
        .eq("status", "Released")
        .lt("due_date", today);


    if (!data) return;


    for (const request of data) {

        await supabaseClient
            .from("borrowing_requests")
            .update({
                status: "Overdue"
            })
            .eq("id", request.id);

    }

}


// Run overdue check every minute

setInterval(
    checkOverdueRequests,
    60000
);
