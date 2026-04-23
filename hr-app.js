const API_URL = "https://hr-helpdesk-60068587326.development.catalystserverless.in/server/HR_function/";

// Utility: IST Timestamp
function nowIST() {
    return new Date().toLocaleString('sv-SE', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).replace('T', ' ').replace(',', '').trim();
}

// Utility: Toast Notification
function showToast(title, message, type = "info") {
    const toast = document.getElementById("toast");
    if (!toast) return;

    document.getElementById("toastTitle").textContent = title;
    document.getElementById("toastMessage").textContent = message;
    
    toast.className = "toast show " + type; // Add type (info, error)

    const icon = toast.querySelector(".toast-icon");
    if (type === "error") icon.textContent = "✕";
    else if (type === "info") icon.textContent = "✓";
    else icon.textContent = "i";

    setTimeout(() => {
        toast.className = "toast hidden";
    }, 4000);
}

// --- Page: hr-request.html ---
const recruitmentForm = document.getElementById("recruitmentForm");
if (recruitmentForm) {
    recruitmentForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById("submitBtn");
        const loader = submitBtn.querySelector(".btn-loader");
        submitBtn.disabled = true;
        loader.classList.remove("hidden");

        const formData = {
            HotelName: document.getElementById("HotelName").value,
            UnitHRName: document.getElementById("UnitHRName").value,
            UnitHREmail: document.getElementById("UnitHREmail").value,
            UnitHRPhone: document.getElementById("UnitHRPhone").value,
            Department: document.getElementById("Department").value,
            Position: document.getElementById("Position").value,
            NumberOfVacancies: parseInt(document.getElementById("NumberOfVacancies").value) || 1,
            JobType: document.getElementById("JobType").value,
            ExperienceRequired: document.getElementById("ExperienceRequired").value,
            SkillsRequired: document.getElementById("SkillsRequired").value,
            SalaryBudget: document.getElementById("SalaryBudget").value,
            Urgency: document.getElementById("Urgency").value,
            JobDescription: document.getElementById("JobDescription").value,
            SubmittedAt: nowIST(),
            Status: "Pending"
        };

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Action": "submit-request" },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            
            if (response.ok && result.ok) {
                document.getElementById("formCard").style.display = "none";
                const successCard = document.getElementById("successCard");
                successCard.classList.remove("hidden");
                document.getElementById("displayTicketId").textContent = result.ticketId || "RHR-SUCCESS";
                showToast("Success", "Request submitted successfully.", "info");
                recruitmentForm.reset();
            } else {
                throw new Error(result.error || "Submission failed");
            }
        } catch (error) {
            console.error(error);
            showToast("Error", "Could not submit request. Please try again.", "error");
        } finally {
            submitBtn.disabled = false;
            loader.classList.add("hidden");
        }
    });
}

// --- Page: hr-status.html ---
const trackBtn = document.getElementById("trackBtn");
if (trackBtn) {
    trackBtn.addEventListener("click", async () => {
        const ticketId = document.getElementById("ticketIdSearch").value.trim();
        if (!ticketId) {
            showToast("Warning", "Please enter a Ticket ID.", "error");
            return;
        }

        trackBtn.disabled = true;
        trackBtn.textContent = "Searching...";

        try {
            // Because this is a dummy setup until backend is fully hooked
            // We simulate API call
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Action": "get-status" },
                body: JSON.stringify({ ticketId })
            });
            const result = await response.json();

            if (response.ok && result.ok && result.ticket) {
                renderStatus(result.ticket);
            } else {
                showToast("Not Found", "Ticket ID not found.", "error");
            }
        } catch (error) {
            console.error(error);
            // Fallback for UI visualization testing while backend isn't real
            showToast("Error", "API Error. Try again later.", "error");
        } finally {
            trackBtn.disabled = false;
            trackBtn.textContent = "Track Status";
        }
    });
}

function renderStatus(ticket) {
    document.getElementById("statusResultCard").classList.remove("hidden");
    document.getElementById("resTicketId").textContent = ticket.TicketID;
    
    document.getElementById("resHotel").textContent = ticket.HotelName;
    document.getElementById("resPosition").textContent = ticket.Position;
    document.getElementById("resVacancies").textContent = ticket.NumberOfVacancies;
    document.getElementById("resUrgency").textContent = ticket.Urgency;
    document.getElementById("resUnitHR").textContent = ticket.UnitHRName;
    
    // Status Badge
    const badgeClass = getBadgeClass(ticket.Status);
    document.getElementById("resStatusBadge").innerHTML = `<span class="badge ${badgeClass}">${ticket.Status}</span>`;

    // Timeline Rendering
    const stages = ["Pending", "Resumes Shared", "Remarks Submitted", "Closed"];
    let timelineHTML = "";
    let currentIndex = stages.indexOf(ticket.Status);
    if(ticket.Status === "Interview In Progress") currentIndex = 1; // It's past resumes shared, but remarks not fully submitted yet. Wait, 1 means active on next?
    
    let isClosed = ticket.Status === "Closed";

    timelineHTML += createTimelineStep("Request Submitted", ticket.SubmittedAt, currentIndex >= 0 || true, false);
    
    const isResumesDone = currentIndex >= 1 || ticket.ResumeSharedAt;
    const isResumesActive = ticket.Status === "Pending"; // Awaiting this
    timelineHTML += createTimelineStep("Resumes Shared", ticket.ResumeSharedAt || (isResumesActive ? "In Progress" : "Awaiting"), isResumesDone, isResumesActive);

    const isRemarksDone = currentIndex >= 2 || ticket.InterviewCompletedAt;
    const isRemarksActive = ticket.Status === "Resumes Shared" || ticket.Status === "Interview In Progress";
    timelineHTML += createTimelineStep("Interview Remarks", ticket.InterviewCompletedAt || (isRemarksActive ? "In Progress" : "Awaiting"), isRemarksDone, isRemarksActive);

    const isClosedActive = ticket.Status === "Remarks Submitted";
    timelineHTML += createTimelineStep("Ticket Closed", ticket.ClosedAt || (isClosedActive ? "In Progress" : "Awaiting"), isClosed, isClosedActive);

    document.getElementById("timeline").innerHTML = timelineHTML;

    // Events
    let eventsHTML = "";
    if (ticket.ResumeLinks) eventsHTML += `<div style="margin-top: 1rem;">📎 <strong>Resumes Shared</strong> by Corporate HR</div>`;
    if (ticket.GMRemarks) eventsHTML += `<div style="margin-top: 1rem;">✅ <strong>Interview Remarks</strong> Submitted by GM</div>`;
    if (ticket.ClosedAt) eventsHTML += `<div style="margin-top: 1rem;">🎉 <strong>Ticket Closed</strong></div>`;
    
    document.getElementById("resEvents").innerHTML = eventsHTML;
}

function createTimelineStep(title, detail, completed, active) {
    let classes = ["timeline-step"];
    if (completed) classes.push("completed");
    if (active && !completed) classes.push("active");
    
    return `
        <div class="${classes.join(' ')}">
            <div class="timeline-dot"></div>
            <h4>${title}</h4>
            <p>${detail}</p>
        </div>
    `;
}

// --- Page: hr-admin-login.html ---
const adminLoginForm = document.getElementById("adminLoginForm");
if (adminLoginForm) {
    // Check if already logged in
    if (sessionStorage.getItem("hr_admin_logged_in") === "true") {
        window.location.href = "hr-dashboard.html";
    }

    // Send OTP Logic
    const sendOtpBtn = document.getElementById("sendOtpBtn");
    const otpSection = document.getElementById("otpSection");

    sendOtpBtn.addEventListener("click", async () => {
        const email = document.getElementById("adminEmail").value;
        const password = document.getElementById("adminPassword").value;

        if (!email || !password) {
            showToast("Warning", "Please enter email and password first.", "error");
            return;
        }

        sendOtpBtn.disabled = true;
        sendOtpBtn.textContent = "Sending OTP...";

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Action": "send-otp" },
                body: JSON.stringify({ email, password })
            });
            const result = await response.json();

            if (response.ok && result.ok) {
                showToast("Success", "OTP sent to your email.", "info");
                otpSection.classList.remove("hidden");
                sendOtpBtn.textContent = "Resend OTP";
            } else {
                showToast("Failed", result.error || "Could not send OTP", "error");
            }
        } catch (error) {
            console.error(error);
            showToast("Error", "Server error. Try again.", "error");
        } finally {
            sendOtpBtn.disabled = false;
        }
    });

    adminLoginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("adminEmail").value;
        const password = document.getElementById("adminPassword").value;
        const otp = document.getElementById("adminOtp").value;

        if (!otp) {
            showToast("Warning", "Please enter the OTP.", "error");
            return;
        }
        
        const loginBtn = document.getElementById("loginBtn");
        loginBtn.disabled = true;
        loginBtn.textContent = "Logging in...";

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Action": "hr-login" },
                body: JSON.stringify({ email, password, otp })
            });
            const result = await response.json();

            if (response.ok && result.ok) {
                sessionStorage.setItem("hr_admin_logged_in", "true");
                sessionStorage.setItem("hr_admin_email", email);
                sessionStorage.setItem("hr_admin_role", result.role || "Corporate Office");
                sessionStorage.setItem("hr_admin_hotel", result.hotel || "");
                sessionStorage.setItem("hr_admin_name", result.name || "Admin");
                window.location.href = "hr-dashboard.html";
            } else {
                showToast("Failed", result.error || "Invalid Credentials/OTP", "error");
            }
        } catch (error) {
            console.error(error);
            showToast("Error", "Login failed. Check console.", "error");
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = "Verify & Login";
        }
    });
}

// --- Page: hr-dashboard.html ---
const ticketsTable = document.getElementById("ticketsTable");
if (ticketsTable) {
    if (sessionStorage.getItem("hr_admin_logged_in") !== "true") {
        window.location.href = "hr-admin-login.html";
    }

    const role = sessionStorage.getItem("hr_admin_role");
    const adminName = sessionStorage.getItem("hr_admin_name");
    const adminHotel = sessionStorage.getItem("hr_admin_hotel");

    document.getElementById("dashboardRoleSubtitle").textContent = `${role} View`;
    document.getElementById("userRoleBadge").textContent = role;
    document.getElementById("userName").textContent = adminName;

    document.getElementById("logoutBtn").addEventListener("click", () => {
        sessionStorage.clear();
        window.location.href = "hr-admin-login.html";
    });

    let allTickets = [];

    // Filter elements
    const searchInput = document.getElementById("searchInput");
    const filterStatus = document.getElementById("filterStatus");
    const filterUrgency = document.getElementById("filterUrgency");
    const filterHotel = document.getElementById("filterHotel");
    const refreshBtn = document.getElementById("refreshBtn");

    const hotels = [
        "Hotel Royal Orchid Corporate Office", "Hotel Royal Orchid Bangalore", "Royal Orchid Central - Bangalore",
        "Regenta Place - Bangalore", "Royal Orchid Central, Pune", "Royal Orchid Metropole, Mysore",
        "Royal Orchid Brindavan, Mysore", "Royal Orchid Beach Resort & Spa - Goa", "Royal Orchid Central - Hospet",
        "Hotel Royal Orchid Jaipur", "Royal Orchid Resorts & Convention Centre", "Regenta Central Hotel & Convention Centre",
        "Regenta Central Imperial Goa", "Regenta Central Grand Exotica, Pune", "Regenta Suits Gurugram",
        "Regenta Resort - Sakleshpur", "Iconica - Mumbai"
    ];

    hotels.forEach(h => {
        const opt = document.createElement("option");
        opt.value = h;
        opt.textContent = h;
        filterHotel.appendChild(opt);
    });

    if (role === "GM" && adminHotel) {
        filterHotel.value = adminHotel;
        filterHotel.disabled = true;
    }

    const loadTickets = async () => {
        document.getElementById("ticketsBody").innerHTML = `<tr><td colspan="9" style="text-align:center;">Loading tickets...</td></tr>`;
        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Action": "get-all-tickets" },
                body: JSON.stringify({})
            });
            const result = await response.json();
            if (response.ok && result.ok) {
                allTickets = result.tickets;
                renderDashboardTable();
            } else {
                document.getElementById("ticketsBody").innerHTML = `<tr><td colspan="9" style="text-align:center; color: red;">Failed to load tickets.</td></tr>`;
            }
        } catch (error) {
            console.error(error);
            document.getElementById("ticketsBody").innerHTML = `<tr><td colspan="9" style="text-align:center; color: red;">Error connecting to server.</td></tr>`;
        }
    };

    const renderDashboardTable = () => {
        let filtered = allTickets;

        if (role === "GM") {
            filtered = filtered.filter(t => t.HotelName === adminHotel);
        } else if (filterHotel.value !== "All") {
            filtered = filtered.filter(t => t.HotelName === filterHotel.value);
        }

        if (filterStatus.value !== "All") {
            filtered = filtered.filter(t => t.Status === filterStatus.value);
        }
        if (filterUrgency.value !== "All") {
            filtered = filtered.filter(t => t.Urgency === filterUrgency.value);
        }

        const sv = searchInput.value.toLowerCase().trim();
        if (sv) {
            filtered = filtered.filter(t => 
                (t.TicketID || "").toLowerCase().includes(sv) || 
                (t.HotelName || "").toLowerCase().includes(sv) || 
                (t.Position || "").toLowerCase().includes(sv) ||
                (t.UnitHRName || "").toLowerCase().includes(sv)
            );
        }

        // Stats Update
        document.getElementById("statTotal").textContent = filtered.length;
        document.getElementById("statActive").textContent = filtered.filter(t => t.Status !== "Closed").length;
        document.getElementById("statClosed").textContent = filtered.filter(t => t.Status === "Closed").length;
        document.getElementById("statCritical").textContent = filtered.filter(t => t.Urgency === "Critical").length;

        const tbody = document.getElementById("ticketsBody");
        tbody.innerHTML = "";

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No tickets found.</td></tr>`;
            return;
        }

        filtered.forEach(t => {
            const tr = document.createElement("tr");
            let actionBtnHTML = "";

            if (role === "Corporate HR" && t.Status === "Pending") {
                actionBtnHTML = `<button class="btn btn-small btn-primary action-share" data-id="${t.TicketID}">📎 Share Resumes</button>`;
            } else if (role === "GM" && t.Status === "Resumes Shared") {
                actionBtnHTML = `<button class="btn btn-small action-remarks" data-id="${t.TicketID}" style="background:var(--secondary); color:white; border:none;">📝 Submit Remarks</button>`;
            } else if (role === "Corporate Office" && t.Status !== "Closed") {
                actionBtnHTML = `<button class="btn btn-small action-close" data-id="${t.TicketID}" style="background:#059669; color:white; border:none;">🔒 Close</button>`;
            } else {
                actionBtnHTML = `<span style="font-size:0.8rem; color:var(--muted);">-</span>`;
            }

            tr.innerHTML = `
                <td style="font-weight:600;">${t.TicketID}</td>
                <td>${t.HotelName}</td>
                <td>${t.Position}</td>
                <td>${t.NumberOfVacancies}</td>
                <td>${t.UnitHRName}</td>
                <td><span class="badge ${getUrgencyClass(t.Urgency)}">${t.Urgency}</span></td>
                <td><span class="badge ${getBadgeClass(t.Status)}">${t.Status}</span></td>
                <td>${(t.SubmittedAt || "").split(" ")[0]}</td>
                <td onclick="event.stopPropagation()">${actionBtnHTML}</td>
            `;

            // Expandable Row logic
            const detailRow = document.createElement("tr");
            detailRow.className = "expanded-row";
            detailRow.innerHTML = `
                <td colspan="9" style="padding: 0;">
                    <div class="expanded-content">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                            <div>
                                <h4>Job Details</h4>
                                <p><strong>Email:</strong> ${t.UnitHREmail} | <strong>Phone:</strong> ${t.UnitHRPhone}</p>
                                <p><strong>Department:</strong> ${t.Department} | <strong>Type:</strong> ${t.JobType}</p>
                                <p><strong>Experience:</strong> ${t.ExperienceRequired}</p>
                                <p><strong>Skills:</strong> ${t.SkillsRequired}</p>
                                <p><strong>Salary:</strong> ${t.SalaryBudget}</p>
                                <p style="margin-top:0.5rem; background:rgba(0,0,0,0.2); padding:0.5rem; border-radius:4px;">${t.JobDescription}</p>
                            </div>
                            <div>
                                <h4>Workflow Remarks</h4>
                                <p><strong>Corp HR Remarks (${t.ResumeSharedAt || "-"}):</strong> ${t.CorpHRRemarks || "-"}</p>
                                <p><strong>Resumes:</strong> ${t.ResumeLinks ? `<br><textarea readonly rows="2" style="width:100%; font-size:0.8rem; background:transparent;">${t.ResumeLinks}</textarea>` : "Not shared yet."}</p>
                                <hr style="border-color:var(--border); margin:0.5rem 0;">
                                <p><strong>GM Remarks (${t.GMName || "-"}, ${t.InterviewCompletedAt || "-"}):</strong> ${t.GMRemarks || "-"}</p>
                                <p><strong>Decisions:</strong> ${t.CandidateDecisions ? JSON.stringify(t.CandidateDecisions) : "-"}</p>
                                <hr style="border-color:var(--border); margin:0.5rem 0;">
                                <p><strong>Closed By:</strong> ${t.ClosedBy || "-"} <strong>At:</strong> ${t.ClosedAt || "-"}</p>
                                <p><strong>Closing Notes:</strong> ${t.ClosingRemarks || "-"}</p>
                            </div>
                        </div>
                    </div>
                </td>
            `;

            tr.addEventListener("click", () => {
                detailRow.classList.toggle("show");
            });

            tbody.appendChild(tr);
            tbody.appendChild(detailRow);
        });

        // Attach event listeners to instantiated buttons
        document.querySelectorAll(".action-share").forEach(b => {
            b.addEventListener("click", () => openShareModal(b.dataset.id));
        });
        document.querySelectorAll(".action-remarks").forEach(b => {
            b.addEventListener("click", () => openRemarksModal(b.dataset.id));
        });
        document.querySelectorAll(".action-close").forEach(b => {
            b.addEventListener("click", () => openCloseModal(b.dataset.id));
        });
    };

    [searchInput, filterStatus, filterUrgency, filterHotel].forEach(el => {
        el.addEventListener("input", renderDashboardTable);
    });

    refreshBtn.addEventListener("click", loadTickets);
    loadTickets(); // Initial load

    // --- Modal Logics ---
    let currentTicketId = null;
    const hideModals = () => {
        document.querySelectorAll(".modal-overlay").forEach(m => m.classList.add("hidden"));
        currentTicketId = null;
    };
    document.querySelectorAll(".close-modal").forEach(btn => btn.addEventListener("click", hideModals));

    function openShareModal(ticketId) {
        currentTicketId = ticketId;
        document.getElementById("modalShareResumesTitle").textContent = `Share Resumes — ${ticketId}`;
        document.getElementById("valResumeLinks").value = "";
        document.getElementById("valCorpHRRemarks").value = "";
        document.getElementById("modalShareResumes").classList.remove("hidden");
    }

    document.getElementById("btnSubmitShareResumes").addEventListener("click", async () => {
        const resumeLinks = document.getElementById("valResumeLinks").value;
        const corpHRRemarks = document.getElementById("valCorpHRRemarks").value;
        
        try {
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Action": "share-resumes" },
                body: JSON.stringify({ ticketId: currentTicketId, resumeLinks, corpHRRemarks })
            });
            const result = await res.json();
            if(res.ok && result.ok) {
                showToast("Success", "Resumes shared successfully.");
                hideModals();
                loadTickets();
            } else throw new Error();
        } catch(e) {
            showToast("Error", "Action failed.", "error");
        }
    });

    function openRemarksModal(ticketId) {
        currentTicketId = ticketId;
        document.getElementById("modalGMRemarksTitle").textContent = `Interview Remarks — ${ticketId}`;
        document.getElementById("valGMName").value = adminName;
        document.getElementById("candidatesContainer").innerHTML = "";
        document.getElementById("valGMOverallRemarks").value = "";
        addCandidateRow();
        document.getElementById("modalGMRemarks").classList.remove("hidden");
    }

    document.getElementById("btnAddCandidate").addEventListener("click", addCandidateRow);

    function addCandidateRow() {
        const c = document.createElement("div");
        c.style.display = "grid";
        c.style.gridTemplateColumns = "2fr 1fr 2fr auto";
        c.style.gap = "0.5rem";
        c.style.marginBottom = "0.5rem";
        c.className = "candidate-row";
        
        c.innerHTML = `
            <input type="text" class="c-name" placeholder="Candidate Name" style="padding:0.5rem; font-size:0.9rem;" required>
            <select class="c-dec" style="padding:0.5rem; font-size:0.9rem;">
                <option value="Selected">Selected</option>
                <option value="Rejected">Rejected</option>
                <option value="On Hold">On Hold</option>
            </select>
            <input type="text" class="c-notes" placeholder="Remarks" style="padding:0.5rem; font-size:0.9rem;">
            <button type="button" class="btn c-rem" style="padding:0.5rem; font-size:0.9rem; background:#dc2626; color:white;">X</button>
        `;
        
        c.querySelector(".c-rem").addEventListener("click", () => c.remove());
        document.getElementById("candidatesContainer").appendChild(c);
    }

    document.getElementById("btnSubmitGMRemarks").addEventListener("click", async () => {
        const gmName = document.getElementById("valGMName").value;
        const gmRemarks = document.getElementById("valGMOverallRemarks").value;
        
        const candidateDecisions = [];
        document.querySelectorAll(".candidate-row").forEach(row => {
            candidateDecisions.push({
                name: row.querySelector(".c-name").value,
                decision: row.querySelector(".c-dec").value,
                notes: row.querySelector(".c-notes").value
            });
        });

        try {
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Action": "submit-gm-remarks" },
                body: JSON.stringify({ ticketId: currentTicketId, gmName, candidateDecisions, gmRemarks })
            });
            const result = await res.json();
            if(res.ok && result.ok) {
                showToast("Success", "Remarks submitted successfully.");
                hideModals();
                loadTickets();
            } else throw new Error();
        } catch(e) {
            showToast("Error", "Action failed.", "error");
        }
    });

    function openCloseModal(ticketId) {
        currentTicketId = ticketId;
        document.getElementById("modalCloseTicketTitle").textContent = `Close Ticket — ${ticketId}`;
        document.getElementById("valClosingRemarks").value = "";
        document.getElementById("modalCloseTicket").classList.remove("hidden");
    }

    document.getElementById("btnSubmitCloseTicket").addEventListener("click", async () => {
        const closingRemarks = document.getElementById("valClosingRemarks").value;
        
        try {
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Action": "close-ticket" },
                body: JSON.stringify({ ticketId: currentTicketId, closingRemarks, closedBy: sessionStorage.getItem("hr_admin_email") })
            });
            const result = await res.json();
            if(res.ok && result.ok) {
                showToast("Success", "Ticket closed.");
                hideModals();
                loadTickets();
            } else throw new Error();
        } catch(e) {
            showToast("Error", "Action failed.", "error");
        }
    });
}

function getBadgeClass(status) {
    switch (status) {
        case "Pending": return "badge-pending";
        case "Resumes Shared": return "badge-resumes";
        case "Interview In Progress": return "badge-interview";
        case "Remarks Submitted": return "badge-remarks";
        case "Closed": return "badge-closed";
        default: return "badge-pending";
    }
}

function getUrgencyClass(urgency) {
    if (urgency === "Urgent") return "badge-urgent";
    if (urgency === "Critical") return "badge-critical";
    return "badge-normal";
}
