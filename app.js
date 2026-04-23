// ═══════════════════════════════════════════════════════════════════════════════
//  CRT HELP DESK — Frontend Application (Zoho Catalyst Backend)
// ═══════════════════════════════════════════════════════════════════════════════

const API_BASE = 'https://hr-helpdesk-60068587326.development.catalystserverless.in/server/HR_function/';

// ─── API Helper ──────────────────────────────────────────────────────────────

async function api(action, data = {}, method = 'POST') {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'x-action': action }
  };
  if (method === 'POST') opts.body = JSON.stringify(data);
  const resp = await fetch(API_BASE, opts);
  return resp.json();
}

// ─── Data Transformers ───────────────────────────────────────────────────────

function rowToTicket(r) {
  let resumes = [], auditLog = [], hrFeedback = { decision: '', remarks: '' }, fhFeedback = { decision: '', remarks: '' };
  try { resumes    = JSON.parse(r.Resumes    || '[]'); } catch(e) {}
  try { auditLog   = JSON.parse(r.AuditLog   || '[]'); } catch(e) {}
  try { HRFeedback = JSON.parse(r.HrFeedBack || r.HRFeedback || r.HRFeedBack || '{}'); } catch(e) {}
  try { FHFeedback = JSON.parse(r.FhFeedBack || r.FHFeedback || r.FHFeedBack || '{}'); } catch(e) {}
  if (!hrFeedback.decision && !hrFeedback.remarks) hrFeedback = { decision: '', remarks: '' };
  if (!fhFeedback.decision && !fhFeedback.remarks) fhFeedback = { decision: '', remarks: '' };

  return {
    id: r.TicketID,
    rowId: r.ROWID,
    status: r.Status || 'Created',
    requestDetails: {
      hotelName: r.HotelName || '',
      stateName: r.State || r.StateName || '',
      hrName: r.HrName || r.HRName || '',
      hrContact: r.HrContact || r.HRContact || '',
      hrEmail: r.HrEmail || r.HREmail || '',
      department: r.Department || '',
      designation: r.Designation || '',
      numPositions: r.NumPositions || '',
      experience: r.Experience || ''
    },
    resumes,
    hrFeedback: HRFeedback,
    fhFeedback: FHFeedback,
    closureStatus: r.ClosureStatus || '',
    timestamp: r.TimeStamps || r.Timestamp || '',
    updatedAt: r.UpdateDaT || r.UpdatedAt || '',
    updatedBy: r.UpdateDby || r.UpdatedBy || '',
    auditLog
  };
}

function ticketToRow(t) {
  return {
    ROWID: t.rowId,
    TicketID: t.id,
    Status: t.status,
    HotelName: t.requestDetails.hotelName,
    State: t.requestDetails.stateName,
    HrName: t.requestDetails.hrName,
    HrContact: t.requestDetails.hrContact,
    HrEmail: t.requestDetails.hrEmail,
    Department: t.requestDetails.department,
    Designation: t.requestDetails.designation,
    NumPositions: t.requestDetails.numPositions,
    Experience: t.requestDetails.experience,
    HrFeedBack: JSON.stringify(t.hrFeedback || {}),
    FhFeedBack: JSON.stringify(t.fhFeedback || {}),
    ClosureStatus: t.closureStatus || null,
    Resumes: JSON.stringify(t.resumes || []),
    AuditLog: JSON.stringify(t.auditLog || []),
    UpdateDaT: t.updatedAt || '',
    UpdateDby: t.updatedBy || '',
    TimeStamps: t.timestamp || ''
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  APP OBJECT
// ═══════════════════════════════════════════════════════════════════════════════

const app = {
  currentRole: null,
  currentTicketId: null,
  loginTargetRole: null,
  loggedInUser: null,
  _ticketsCache: {},  // In-memory cache

  // Department → Designation Mapping
  deptDesignations: {
    'Housekeeping': ['Room Attendant', 'Housekeeping Supervisor', 'Linen Room Attendant', 'Public Area Attendant', 'Floor Supervisor', 'Executive Housekeeper', 'Asst. Housekeeper'],
    'Front Office': ['Front Desk Agent', 'Bell Boy', 'Concierge', 'Guest Relation Executive', 'Night Auditor', 'Front Office Supervisor', 'Front Office Manager', 'Reservation Agent'],
    'Administration': ['Admin Executive', 'Office Coordinator', 'Transport Coordinator', 'Store Keeper'],
    'F&B Service': ['Waiter / Steward', 'Captain', 'Restaurant Manager', 'Banquet Coordinator', 'Bar Tender', 'Room Service Attendant', 'F&B Supervisor', 'F&B Manager'],
    'Engineering': ['Technician', 'Electrician', 'Plumber', 'AC Mechanic', 'Maintenance Supervisor', 'Chief Engineer'],
    'Kitchen': ['Commis I / II / III', 'Chef de Partie', 'Sous Chef', 'Executive Chef', 'Pastry Chef', 'Kitchen Steward', 'Demi Chef de Partie'],
    'Purchase': ['Purchase Executive', 'Store Keeper', 'Purchase Manager'],
    'IT': ['IT Executive', 'IT Manager', 'Systems Administrator'],
    'Sales': ['Sales Executive', 'Sales Manager', 'Director of Sales', 'Revenue Manager', 'Reservation Manager'],
    'Reservation': ['Reservation Agent', 'Reservation Supervisor', 'Reservation Manager'],
    'F&B Production': ['Commis', 'Chef de Partie', 'Sous Chef', 'Executive Chef'],
    'Finance': ['Accounts Executive', 'Accounts Manager', 'Income Auditor', 'Credit Manager', 'Financial Controller'],
    'Security': ['Security Guard', 'Security Supervisor', 'Chief Security Officer'],
    'Human Resources': ['HR Executive', 'HR Manager', 'Training Manager', 'Cluster HR Manager', 'Chief HR Manager'],
    'Information Technology': ['IT Executive', 'IT Leadership']
  },

  // Populate designation dropdown based on selected department
  populateDesignations: (deptSelectId, desigSelectId) => {
    const dept = document.getElementById(deptSelectId).value;
    const desigSelect = document.getElementById(desigSelectId);
    desigSelect.innerHTML = '<option value="">Select designation</option>';
    const designations = app.deptDesignations[dept] || [];
    designations.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      desigSelect.appendChild(opt);
    });
  },

  // ─── Loading Overlay ────────────────────────────────────────────────────────
  showLoading: (msg) => {
    const el = document.getElementById('loadingOverlay');
    if (el) {
      el.querySelector('.loading-text').textContent = msg || 'Processing...';
      el.classList.add('visible');
    }
  },
  hideLoading: () => {
    const el = document.getElementById('loadingOverlay');
    if (el) el.classList.remove('visible');
  },

  // ─── Init ───────────────────────────────────────────────────────────────────
  init: () => {
    app.showView('role-selector');
  },

  // Switch App Views
  showView: (viewId) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');

    if (viewId === 'role-selector' || viewId === 'login') {
      document.getElementById('roleBadge').style.display = 'none';
      document.getElementById('logoutBtn').classList.add('hidden');
      if (viewId === 'role-selector') {
        app.currentRole = null;
        app.loginTargetRole = null;
        app.loggedInUser = null;
      }
    } else {
      document.getElementById('roleBadge').style.display = 'inline-block';
      if (app.currentRole === 'admin' || app.currentRole === 'crt-team') {
        document.getElementById('logoutBtn').classList.remove('hidden');
      } else {
        document.getElementById('logoutBtn').classList.add('hidden');
      }
    }

    if (viewId === 'admin') {
      app.switchTab('admin', 'tickets');
      app.loadAdminTable();
      app.loadAdminUsersTable();
    }
    if (viewId === 'crt-team') app.loadCrtTable();
  },

  // Set Role Context
  setRole: (roleId) => {
    if (roleId === 'admin' || roleId === 'crt-team') {
      if (app.currentRole === roleId) {
        app.showView(roleId);
        if (roleId === 'crt-team') app.switchTab('crt-team', 'all-tickets');
        return;
      }
      app.loginTargetRole = roleId;
      document.getElementById('login_title').innerHTML = `Authentication - ${roleId === 'admin' ? 'Admin' : 'CRT Team'} <div class="section-line" style="display:none;"></div>`;
      app.showView('login');
      return;
    }
    // Unprotected roles bypass login
    app.finalizeRoleLogin(roleId);
  },

  finalizeRoleLogin: (roleId) => {
    app.currentRole = roleId;
    const roleNames = {
      'unit-hr': 'Unit HR',
      'crt-team': 'CRT Team',
      'functional-head': 'Functional Head',
      'admin': 'Admin'
    };
    document.getElementById('currentRoleDisplay').innerText = roleNames[roleId];
    app.showView(roleId);
    if (roleId === 'unit-hr') app.switchTab('unit-hr', 'create-request');
    if (roleId === 'crt-team') app.switchTab('crt-team', 'all-tickets');
  },

  // ─── AUTHENTICATION (now via API with OTP) ──────────────────────────────────
  sendOTP: async () => {
    const user = app.getVal('login_username');
    const pass = app.getVal('login_password');
    if (!user || !pass) { alert("Please enter both username/email and password"); return; }

    app.showLoading('Sending OTP...');
    try {
      const resp = await api('send-otp', { username: user, password: pass });
      if (resp.ok) {
        alert("OTP sent to your registered email address.");
        document.getElementById('otp_block').classList.remove('hidden');
        document.getElementById('getOtpBtn').innerText = 'Resend OTP';
      } else {
        alert(resp.error || 'Failed to send OTP');
      }
    } catch (err) {
      alert('Error connecting to server.');
      console.error(err);
    } finally {
      app.hideLoading();
    }
  },

  handleLogin: async () => {
    const user = app.getVal('login_username');
    const pass = app.getVal('login_password');
    const otp = app.getVal('login_otp');

    if (!user || !pass || !otp) { 
      alert("Please enter Username, Password and OTP"); 
      return; 
    }

    app.showLoading('Authenticating...');
    try {
      const resp = await api('crt-login', { username: user, password: pass, otp: otp });
      app.setVal('login_password', '');
      app.setVal('login_otp', '');

      if (resp.ok) {
        app.loggedInUser = resp.username || user;
        app.finalizeRoleLogin(resp.role === 'admin' ? 'admin' : 'crt-team');
      } else {
        alert(resp.error || 'Invalid credentials or OTP!');
      }
    } catch (err) {
      alert('Login failed. Please check your connection.');
      console.error(err);
    } finally {
      app.hideLoading();
    }
  },

  logout: () => {
    app.currentRole = null;
    app.loggedInUser = null;
    app.showView('role-selector');
  },

  getCurrentUser: (reqDetails) => {
    if (app.loggedInUser) return app.loggedInUser;
    if (app.currentRole === 'functional-head') return 'Functional Head';
    if (app.currentRole === 'unit-hr') return reqDetails?.hrName || 'Unit HR';
    return 'System';
  },

  // Switch Sub Tabs
  switchTab: (roleId, tabId) => {
    const view = document.getElementById(`view-${roleId}`);
    if (!view) return;
    view.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    view.querySelectorAll('.form-panel').forEach(p => p.classList.add('hidden'));

    const btns = view.querySelectorAll('.tab-btn');
    btns.forEach(b => {
      if (b.textContent.toLowerCase().includes(tabId.replace(/-/g, ' ').split(' ')[0]) ||
          (roleId === 'admin' && b.textContent.toLowerCase().includes(tabId))) {
        b.classList.add('active');
      }
    });

    const targetPanel = document.getElementById(`tab-${roleId}-${tabId}`);
    if (targetPanel) targetPanel.classList.remove('hidden');

    if (roleId === 'crt-team' && tabId === 'all-tickets') app.loadCrtTable();
  },

  // Generate Ticket ID
  generateTicketId: () => {
    const date = new Date();
    const yy = String(date.getFullYear()).slice(2);
    const mm = String(date.getMonth()+1).padStart(2,'0');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `CRT-${yy}${mm}-${rand}`;
  },

  // Get Summary Outcome for Dashboard
  getOutcomeRemark: (t) => {
    if (t.closureStatus) return `<span style="color:var(--urgent); font-weight:500;">${t.closureStatus}</span>`;
    if (t.fhFeedback?.decision) return `<span style="color:var(--accent); font-weight:500;">${t.fhFeedback.decision}</span>`;
    if (t.hrFeedback?.decision) return `<span style="color:var(--accent); font-weight:500;">${t.hrFeedback.decision}</span>`;
    return '<span style="color:var(--muted); font-size:11px;">Pending Review</span>';
  },

  // Input helpers
  getVal: (id) => document.getElementById(id).value.trim(),
  setVal: (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; },

  // ─── UNIT HR: CREATE TICKET (now via API) ──────────────────────────────────
  submitNewTicket: async () => {
    const req = {
      hotelName: app.getVal('hr_hotelName'),
      stateName: app.getVal('hr_stateName'),
      hrName: app.getVal('hr_hrName'),
      hrContact: app.getVal('hr_hrContact'),
      hrEmail: app.getVal('hr_hrEmail'),
      department: app.getVal('hr_department'),
      designation: app.getVal('hr_designation'),
      numPositions: app.getVal('hr_numPositions'),
      experience: app.getVal('hr_experience')
    };

    if (!req.hotelName || !req.hrName || !req.hrEmail || !req.department || !req.designation || !req.numPositions) {
      alert("Please fill in all mandatory fields (*)");
      return;
    }

    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const actingUser = req.hrName;

    const ticket = {
      // id will be generated by the backend
      status: 'Created',
      requestDetails: req,
      resumes: [],
      hrFeedback: { decision: '', remarks: '' },
      fhFeedback: { decision: '', remarks: '' },
      closureStatus: '',
      timestamp: now,
      updatedAt: now,
      updatedBy: actingUser,
      auditLog: [{ action: 'Ticket Created', by: actingUser, timestamp: now }]
    };

    app.showLoading('Creating ticket...');
    try {
      const row = ticketToRow(ticket);
      delete row.ROWID; // new ticket, no ROWID
      const resp = await api('create-ticket', row);

      if (resp.ok) {
        alert(`Ticket created successfully!\n\nYour Ticket ID is: ${resp.ticketId}`);
        ['hotelName', 'stateName', 'hrName', 'hrContact', 'hrEmail', 'department', 'designation', 'numPositions', 'experience'].forEach(f => {
          app.setVal(`hr_${f}`, '');
        });
      } else {
        alert('Failed to create ticket: ' + (resp.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error creating ticket. Check your connection.');
      console.error(err);
    } finally {
      app.hideLoading();
    }
  },

  // ─── SEARCH TICKET (now via API) ───────────────────────────────────────────
  searchTicket: async (prefixId) => {
    const htmlPrefix = prefixId === 'unit-hr' ? 'hr' : prefixId === 'crt-team' ? 'crt' : 'fh';
    const searchId = app.getVal(`${htmlPrefix}_searchTicket`).trim().toUpperCase();
    if (!searchId) { alert("Enter a Ticket ID"); return; }

    app.showLoading('Searching ticket...');
    try {
      const resp = await api('get-ticket', { ticketId: searchId });

      if (!resp.ok) {
        alert("Ticket not found. Please check the ID.");
        return;
      }

      const ticket = rowToTicket(resp.ticket);
      app.currentTicketId = ticket.id;
      app._ticketsCache[ticket.id] = ticket;

      // Display Common Details
      document.getElementById(`${htmlPrefix}_ticketDetails`).classList.remove('hidden');
      document.getElementById(`${htmlPrefix}_dispId`).innerText = ticket.id;
      document.getElementById(`${htmlPrefix}_dispStatus`).className = `status-badge status-${ticket.status.replace(/ /g, '-')}`;
      document.getElementById(`${htmlPrefix}_dispStatus`).innerText = ticket.status;

      const lastUpdateEl = document.getElementById(`${htmlPrefix}_dispUpdated`);
      if (lastUpdateEl) {
        if (ticket.updatedBy) {
          lastUpdateEl.innerText = `Updated: ${ticket.updatedAt || ticket.timestamp} by ${ticket.updatedBy}`;
        } else {
          lastUpdateEl.innerText = `Updated: ${ticket.updatedAt || ticket.timestamp}`;
        }
      }

      const detailsEl = document.getElementById(`${htmlPrefix}_dispDetails`);
      if (detailsEl) {
        detailsEl.innerText = `${ticket.requestDetails.hotelName} | ${ticket.requestDetails.designation} (${ticket.requestDetails.department})`;
      }

      // HR: Populate position info strip & resume count
      if (htmlPrefix === 'hr') {
        const rd = ticket.requestDetails;
        const strip = document.getElementById('hr_positionStrip');
        strip.innerHTML = [
          { label: 'Hotel', val: rd.hotelName },
          { label: 'Department', val: rd.department },
          { label: 'Designation', val: rd.designation },
          { label: 'Positions', val: rd.numPositions },
          { label: 'Experience', val: rd.experience || '—' },
          { label: 'State', val: rd.stateName || '—' }
        ].map(c => `<div class="info-chip"><div class="info-chip-label">${c.label}</div><div class="info-chip-val">${c.val || '—'}</div></div>`).join('');

        const count = ticket.resumes ? ticket.resumes.length : 0;
        const countEl = document.getElementById('hr_resumeCount');
        countEl.className = `resume-count-badge ${count > 0 ? 'has-resumes' : 'no-resumes'}`;
        countEl.innerHTML = count > 0 ? `✅ ${count} resume(s) available for review` : `⏳ No resumes uploaded yet — awaiting CRT action`;

        app.renderResumesHR(ticket.resumes);
      } else {
        app.renderResumes(htmlPrefix, ticket.resumes);
      }

      // Populate Existing Feedback
      if (htmlPrefix === 'hr') {
        app.setVal('hr_feedbackDecision', ticket.hrFeedback?.decision);
        app.setVal('hr_feedbackRemarks', ticket.hrFeedback?.remarks);
      } else if (htmlPrefix === 'fh') {
        app.setVal('fh_feedbackDecision', ticket.fhFeedback?.decision);
        app.setVal('fh_feedbackRemarks', ticket.fhFeedback?.remarks);
      }

      // CRT: Populate editable fields
      if (htmlPrefix === 'crt') {
        app.setVal('crt_edit_hotelName', ticket.requestDetails.hotelName);
        app.setVal('crt_edit_stateName', ticket.requestDetails.stateName);
        app.setVal('crt_edit_hrName', ticket.requestDetails.hrName);
        app.setVal('crt_edit_hrContact', ticket.requestDetails.hrContact);
        app.setVal('crt_edit_hrEmail', ticket.requestDetails.hrEmail);
        app.setVal('crt_edit_department', ticket.requestDetails.department);
        app.populateDesignations('crt_edit_department', 'crt_edit_designation');
        app.setVal('crt_edit_designation', ticket.requestDetails.designation);
        app.setVal('crt_edit_numPositions', ticket.requestDetails.numPositions);
        app.setVal('crt_edit_experience', ticket.requestDetails.experience);
        app.setVal('crt_closureAction', '');
        app.setVal('crt_statusOverride', '');
      }
    } catch (err) {
      alert('Error searching ticket. Check your connection.');
      console.error(err);
    } finally {
      app.hideLoading();
    }
  },

  // ─── Render Resumes (CRT / FH) ────────────────────────────────────────────
  renderResumes: (htmlPrefix, resumes) => {
    const listEl = document.getElementById(`${htmlPrefix}_resumeList`);
    if (!listEl) return;

    if (!resumes || resumes.length === 0) {
      listEl.innerHTML = `<span style="font-size:12px;color:var(--muted)">No resumes uploaded yet.</span>`;
      return;
    }

    listEl.innerHTML = resumes.map((resume, idx) => {
      const isString = typeof resume === 'string';
      const isFile = !isString && resume.type === 'file';
      const name = isString ? `Resume Link ${idx + 1}` : resume.name;
      const displayName = isFile ? `📄 ${name}` : `🔗 ${name}`;

      // For files stored in Catalyst, construct download URL
      let url;
      if (isFile && resume.fileId) {
        url = `${API_BASE}download?fileId=${resume.fileId}`;
      } else {
        url = isString ? resume : resume.url;
      }

      const timestamp = isString ? '' : `<br><span style="font-size:10px; color:var(--muted);">Uploaded: ${resume.timestamp}</span>`;

      const deleteBtn = htmlPrefix === 'crt'
        ? `<button class="btn btn-secondary" style="padding:4px 8px; font-size:10px; color:var(--urgent); border-color:var(--urgent); font-weight:bold;" onclick="app.deleteResume(${idx})">🗑 Delete</button>`
        : '';

      return `
        <div class="resume-item" style="flex-direction:column; align-items:flex-start; margin-bottom: 8px;">
          <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%;" title="${name}">${displayName}</span>
            <div style="display:flex; gap:8px;">
              ${deleteBtn}
              <a href="${url}" target="_blank" class="btn btn-secondary" style="padding:4px 8px; font-size:11px;">
                ${isFile ? '↓ Download' : 'View Link ↗'}
              </a>
            </div>
          </div>
          ${timestamp}
        </div>
      `;
    }).join('');
  },

  // ─── Render Resumes (HR View — enhanced) ───────────────────────────────────
  renderResumesHR: (resumes) => {
    const listEl = document.getElementById('hr_resumeList');
    if (!listEl) return;

    if (!resumes || resumes.length === 0) {
      listEl.innerHTML = `<div style="text-align:center; padding:24px; color:var(--muted); font-size:13px;">No resumes have been uploaded by CRT Team yet.<br>Please check back later.</div>`;
      return;
    }

    listEl.innerHTML = resumes.map((resume, idx) => {
      const isString = typeof resume === 'string';
      const isFile = !isString && resume.type === 'file';
      const name = isString ? `Candidate Resume #${idx + 1}` : resume.name;

      let url;
      if (isFile && resume.fileId) {
        url = `${API_BASE}download?fileId=${resume.fileId}`;
      } else {
        url = isString ? resume : resume.url;
      }

      const timestamp = isString ? '' : `<div style="font-size:11px; color:var(--muted); margin-top:4px; font-family:'JetBrains Mono', monospace;">Logged: ${resume.timestamp}</div>`;

      return `
        <div class="resume-item-hr">
          <div class="resume-num">${idx + 1}</div>
          <div class="resume-label">
            ${name}
            ${timestamp}
          </div>
          <a href="${url}" target="_blank" class="resume-link">
            ${isFile ? '📥 Download File' : '📄 View Resume ↗'}
          </a>
        </div>
      `;
    }).join('');
  },

  // ─── CRT: DELETE RESUME (now via API) ──────────────────────────────────────
  deleteResume: async (idx) => {
    if (!confirm("Are you sure you want to delete this resume?")) return;

    const ticket = app._ticketsCache[app.currentTicketId];
    if (!ticket) return;

    ticket.resumes.splice(idx, 1);
    if (ticket.resumes.length === 0 && ticket.status === 'Resumes Uploaded') {
      ticket.status = 'In Progress';
    }

    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const actingUser = app.getCurrentUser(ticket.requestDetails);
    ticket.updatedAt = now;
    ticket.updatedBy = actingUser;
    if (!ticket.auditLog) ticket.auditLog = [];
    ticket.auditLog.push({ action: 'Resume Deleted', by: actingUser, timestamp: now });

    app.showLoading('Deleting resume...');
    try {
      const row = ticketToRow(ticket);
      const resp = await api('update-ticket', row);
      if (resp.ok) {
        document.getElementById('crt_dispStatus').innerText = ticket.status;
        document.getElementById('crt_dispStatus').className = `status-badge status-${ticket.status.replace(/ /g, '-')}`;
        document.getElementById('crt_dispUpdated').innerText = `Updated: ${now} by ${actingUser}`;
        app.renderResumes('crt', ticket.resumes);
      } else {
        alert('Failed to delete resume: ' + (resp.error || ''));
      }
    } catch (err) {
      alert('Error deleting resume.');
      console.error(err);
    } finally {
      app.hideLoading();
    }
  },

  // ─── CRT: ADD RESUME FILE (upload to Catalyst FileStore) ───────────────────
  addResumeFile: async () => {
    const fileInput = document.getElementById('crt_newResumeFile');
    const file = fileInput.files[0];
    if (!file) { alert("Please select a file to upload."); return; }

    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large! Maximum allowed size is 10MB.");
      return;
    }

    app.showLoading('Uploading resume file...');
    try {
      // Read file as base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload to Catalyst FileStore
      console.log('Final Upload Payload:', { fileName: file.name, size: file.size, type: file.type });
      
      const uploadResp = await api('upload-resume', {
        fileName: file.name,
        fileData: base64
      });

      if (!uploadResp.ok) {
        console.error('Resume Upload Fail:', uploadResp);
        const detail = uploadResp.details ? `\nDetails: ${uploadResp.details}` : '';
        alert('Upload failed: ' + (uploadResp.error || 'Server Error') + detail);
        return;
      }

      // Update ticket with new resume entry
      const ticket = app._ticketsCache[app.currentTicketId];
      const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const actingUser = app.getCurrentUser(ticket.requestDetails);

      ticket.resumes.push({
        type: 'file',
        name: file.name,
        fileId: uploadResp.fileId,
        timestamp: now
      });

      if (ticket.status === 'Created' || ticket.status === 'In Progress') {
        ticket.status = 'Resumes Uploaded';
      }

      ticket.updatedAt = now;
      ticket.updatedBy = actingUser;
      if (!ticket.auditLog) ticket.auditLog = [];
      ticket.auditLog.push({ action: 'Resume File Uploaded', by: actingUser, timestamp: now });

      const row = ticketToRow(ticket);
      const saveResp = await api('update-ticket', row);

      if (saveResp.ok) {
        fileInput.value = '';
        document.getElementById('crt_dispStatus').innerText = ticket.status;
        document.getElementById('crt_dispStatus').className = `status-badge status-${ticket.status.replace(/ /g, '-')}`;
        document.getElementById('crt_dispUpdated').innerText = `Updated: ${now} by ${actingUser}`;
        app.renderResumes('crt', ticket.resumes);
      } else {
        alert('Failed to save resume metadata: ' + (saveResp.error || ''));
      }
    } catch (err) {
      alert('Error uploading file. Please try again.');
      console.error(err);
    } finally {
      app.hideLoading();
    }
  },

  // ─── CRT: ADD RESUME LINK ─────────────────────────────────────────────────
  addResumeLink: async () => {
    const link = app.getVal('crt_newResumeLink');
    if (!link) { alert("Please paste a link to add."); return; }

    const ticket = app._ticketsCache[app.currentTicketId];
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const actingUser = app.getCurrentUser(ticket.requestDetails);

    ticket.resumes.push({
      type: 'link',
      name: link,
      url: link,
      timestamp: now
    });

    if (ticket.status === 'Created' || ticket.status === 'In Progress') {
      ticket.status = 'Resumes Uploaded';
    }

    ticket.updatedAt = now;
    ticket.updatedBy = actingUser;
    if (!ticket.auditLog) ticket.auditLog = [];
    ticket.auditLog.push({ action: 'Resume Link Added', by: actingUser, timestamp: now });

    app.showLoading('Saving resume link...');
    try {
      const row = ticketToRow(ticket);
      const resp = await api('update-ticket', row);

      if (resp.ok) {
        app.setVal('crt_newResumeLink', '');
        document.getElementById('crt_dispStatus').innerText = ticket.status;
        document.getElementById('crt_dispStatus').className = `status-badge status-${ticket.status.replace(/ /g, '-')}`;
        document.getElementById('crt_dispUpdated').innerText = `Updated: ${now} by ${actingUser}`;
        app.renderResumes('crt', ticket.resumes);
      } else {
        alert('Failed to save link: ' + (resp.error || ''));
      }
    } catch (err) {
      alert('Error saving link.');
      console.error(err);
    } finally {
      app.hideLoading();
    }
  },

  // ─── CRT: SAVE EDITED REQUEST DETAILS ─────────────────────────────────────
  crtSaveDetails: async () => {
    if (!app.currentTicketId) return;

    const ticket = app._ticketsCache[app.currentTicketId];
    if (!ticket) return;

    ticket.requestDetails = {
      hotelName: app.getVal('crt_edit_hotelName'),
      stateName: app.getVal('crt_edit_stateName'),
      hrName: app.getVal('crt_edit_hrName'),
      hrContact: app.getVal('crt_edit_hrContact'),
      hrEmail: app.getVal('crt_edit_hrEmail'),
      department: app.getVal('crt_edit_department'),
      designation: app.getVal('crt_edit_designation'),
      numPositions: app.getVal('crt_edit_numPositions'),
      experience: app.getVal('crt_edit_experience')
    };

    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const actingUser = app.getCurrentUser(ticket.requestDetails);
    ticket.updatedAt = now;
    ticket.updatedBy = actingUser;
    if (!ticket.auditLog) ticket.auditLog = [];
    ticket.auditLog.push({ action: 'Request Details Updated', by: actingUser, timestamp: now });

    app.showLoading('Saving changes...');
    try {
      const row = ticketToRow(ticket);
      const resp = await api('update-ticket', row);

      if (resp.ok) {
        alert('Request details updated successfully.');
        document.getElementById('crt_dispDetails').innerText =
          `${ticket.requestDetails.hotelName} | ${ticket.requestDetails.designation} (${ticket.requestDetails.department})`;
        document.getElementById('crt_dispUpdated').innerText = `Updated: ${now} by ${actingUser}`;
      } else {
        alert('Failed to save: ' + (resp.error || ''));
      }
    } catch (err) {
      alert('Error saving details.');
      console.error(err);
    } finally {
      app.hideLoading();
    }
  },

  // ─── CRT: OPEN TICKET FROM TABLE ──────────────────────────────────────────
  crtOpenTicket: (ticketId) => {
    app.currentTicketId = ticketId;
    app.setVal('crt_searchTicket', ticketId);

    const view = document.getElementById('view-crt-team');
    view.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    view.querySelectorAll('.form-panel').forEach(p => p.classList.add('hidden'));
    const manageTab = document.getElementById('tab-crt-team-manage-ticket');
    manageTab.classList.remove('hidden');
    view.querySelectorAll('.tab-btn')[1].classList.add('active');

    app.searchTicket('crt-team');
  },

  // ─── Feedback ──────────────────────────────────────────────────────────────
  saveFeedback: async (rolePrefix) => {
    const decision = app.getVal(`${rolePrefix}_feedbackDecision`);
    const remarks  = app.getVal(`${rolePrefix}_feedbackRemarks`);
    if (!remarks) { alert("Remarks are mandatory."); return; }

    const ticket = app._ticketsCache[app.currentTicketId];
    if (!ticket) { alert("No ticket loaded."); return; }

    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const actingUser = app.getCurrentUser(ticket.requestDetails);
    if (!ticket.auditLog) ticket.auditLog = [];

    if (rolePrefix === 'hr') {
      ticket.hrFeedback = { decision, remarks };
      if (decision) ticket.status = 'Interview Completed';
      ticket.auditLog.push({ action: `HR Feedback: ${decision}`, by: actingUser, timestamp: now });
    } else {
      ticket.fhFeedback = { decision, remarks };
      if (decision) ticket.status = 'Interview Completed';
      ticket.auditLog.push({ action: `FH Feedback: ${decision}`, by: actingUser, timestamp: now });
    }

    ticket.updatedAt = now;
    ticket.updatedBy = actingUser;

    app.showLoading('Saving feedback...');
    try {
      const row = ticketToRow(ticket);
      const resp = await api('update-ticket', row);

      if (resp.ok) {
        alert("Feedback saved successfully.");
        document.getElementById(`${rolePrefix}_dispStatus`).innerText = ticket.status;
        document.getElementById(`${rolePrefix}_dispStatus`).className = `status-badge status-${ticket.status.replace(/ /g, '-')}`;
        document.getElementById(`${rolePrefix}_dispUpdated`).innerText = `Updated: ${now} by ${actingUser}`;
      } else {
        alert('Failed to save feedback: ' + (resp.error || ''));
      }
    } catch (err) {
      alert('Error saving feedback.');
      console.error(err);
    } finally {
      app.hideLoading();
    }
  },

  // ─── CRT/ADMIN: CLOSE TICKET ──────────────────────────────────────────────
  closeTicket: async (reqType, idFromAdminBlock) => {
    const tid = idFromAdminBlock || app.currentTicketId;
    if (!tid) return;

    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    if (reqType === 'crt-team') {
      const closureAction = app.getVal('crt_closureAction');
      const statusOverride = app.getVal('crt_statusOverride');
      if (!closureAction && !statusOverride) {
        alert("Please select a closure action or status override.");
        return;
      }

      const ticket = app._ticketsCache[tid];
      if (!ticket) { alert("Ticket not loaded. Please search first."); return; }

      const actingUser = app.getCurrentUser(ticket.requestDetails);
      if (!ticket.auditLog) ticket.auditLog = [];

      if (statusOverride) {
        ticket.status = statusOverride;
        ticket.auditLog.push({ action: `Status Override: ${statusOverride}`, by: actingUser, timestamp: now });
      }
      if (closureAction) {
        ticket.closureStatus = closureAction;
        ticket.status = 'Closed';
        ticket.auditLog.push({ action: `Ticket Closed: ${closureAction}`, by: actingUser, timestamp: now });
      }
      ticket.updatedAt = now;
      ticket.updatedBy = actingUser;

      app.showLoading('Updating ticket...');
      try {
        const row = ticketToRow(ticket);
        const resp = await api('update-ticket', row);
        if (resp.ok) {
          alert(`Ticket ${tid} updated successfully.`);
          document.getElementById('crt_dispStatus').innerText = ticket.status;
          document.getElementById('crt_dispStatus').className = `status-badge status-${ticket.status.replace(/ /g, '-')}`;
          document.getElementById('crt_dispUpdated').innerText = `Updated: ${now} by ${actingUser}`;
        } else {
          alert('Failed: ' + (resp.error || ''));
        }
      } catch (err) {
        alert('Error updating ticket.');
        console.error(err);
      } finally {
        app.hideLoading();
      }

    } else if (reqType === 'admin') {
      // Admin force close — need to fetch the ticket first
      app.showLoading('Force closing ticket...');
      try {
        const getResp = await api('get-ticket', { ticketId: tid });
        if (!getResp.ok) { alert('Ticket not found'); return; }

        const ticket = rowToTicket(getResp.ticket);
        ticket.status = 'Closed';
        ticket.closureStatus = 'Force Closed by Admin';
        ticket.updatedAt = now;
        ticket.updatedBy = 'Admin User';
        if (!ticket.auditLog) ticket.auditLog = [];
        ticket.auditLog.push({ action: 'Ticket Force Closed', by: 'Admin User', timestamp: now });

        const row = ticketToRow(ticket);
        const resp = await api('update-ticket', row);
        if (resp.ok) {
          alert(`Ticket ${tid} has been closed.`);
          app.loadAdminTable();
        } else {
          alert('Failed: ' + (resp.error || ''));
        }
      } catch (err) {
        alert('Error force-closing ticket.');
        console.error(err);
      } finally {
        app.hideLoading();
      }
    }
  },

  // ─── CRT: LOAD TICKETS TABLE (now from API) ───────────────────────────────
  loadCrtTable: async () => {
    const tbody = document.querySelector('#crt_ticketsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--muted); padding:40px;">Loading tickets...</td></tr>';

    try {
      const resp = await api('get-all-tickets');
      if (!resp.ok) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--urgent); padding:40px;">Failed to load tickets.</td></tr>'; return; }

      const tickets = resp.tickets.map(rowToTicket);
      // Cache all tickets
      tickets.forEach(t => app._ticketsCache[t.id] = t);

      const sorted = tickets.sort((a,b) => new Date(b.updatedAt || b.timestamp) - new Date(a.updatedAt || a.timestamp));

      if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--muted); padding:40px;">No tickets found.</td></tr>';
        return;
      }

      tbody.innerHTML = '';
      sorted.forEach(t => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.innerHTML = `
          <td style="font-family:'JetBrains Mono',monospace; color:var(--accent); font-weight:500;">${t.id}</td>
          <td>
            <div style="font-size:11px;">${t.timestamp}</div>
            <div style="font-size:10px; color:var(--muted);">${t.requestDetails.hrEmail || '—'}</div>
          </td>
          <td>${t.requestDetails.hotelName}<br><span style="font-size:11px;color:var(--muted)">${t.requestDetails.stateName || ''}</span></td>
          <td>${t.requestDetails.designation}<br><span style="font-size:11px;color:var(--muted)">${t.requestDetails.department}</span></td>
          <td>${t.requestDetails.numPositions || '—'}</td>
          <td><span class="status-badge status-${t.status.replace(/ /g, '-')}">${t.status}</span></td>
          <td>${app.getOutcomeRemark(t)}</td>
          <td style="font-family:'JetBrains Mono',monospace; font-size:12px;">${t.resumes ? t.resumes.length : 0}</td>
          <td>
            <div style="font-size:11px;">${t.updatedAt || t.timestamp}</div>
            <div style="font-size:10px;color:var(--muted);">by ${t.updatedBy || '—'}</div>
          </td>
          <td>
            <button class="btn btn-primary" style="padding: 6px 14px; font-size:11px;" onclick="event.stopPropagation(); app.crtOpenTicket('${t.id}')">
              Manage →
            </button>
          </td>
        `;
        tr.onclick = () => app.crtOpenTicket(t.id);
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--urgent); padding:40px;">Error loading tickets. Check connection.</td></tr>';
      console.error(err);
    }
  },

  // ─── ADMIN: LOAD TABLE (now from API) ──────────────────────────────────────
  loadAdminTable: async () => {
    const tbody = document.querySelector('#admin_ticketsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--muted); padding:40px;">Loading tickets...</td></tr>';

    try {
      const resp = await api('get-all-tickets');
      if (!resp.ok) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--urgent); padding:40px;">Failed to load.</td></tr>'; return; }

      const tickets = resp.tickets.map(rowToTicket);
      tickets.forEach(t => app._ticketsCache[t.id] = t);

      const sorted = tickets.sort((a,b) => new Date(b.updatedAt || b.timestamp) - new Date(a.updatedAt || a.timestamp));

      if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--muted); padding:40px;">No tickets found.</td></tr>';
        return;
      }

      tbody.innerHTML = '';
      sorted.forEach(t => {
        const isClosed = t.status === 'Closed';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-family:'JetBrains Mono',monospace; color:var(--accent); font-weight:500;">${t.id}</td>
          <td>
            <div style="font-size:11px;">${t.timestamp}</div>
            <div style="font-size:10px; color:var(--muted);">${t.requestDetails.hrEmail || '—'}</div>
          </td>
          <td>${t.requestDetails.hotelName}</td>
          <td>${t.requestDetails.designation} <br><span style="font-size:11px;color:var(--muted)">${t.requestDetails.department}</span></td>
          <td><span class="status-badge status-${t.status.replace(/ /g, '-')}">${t.status}</span></td>
          <td>${app.getOutcomeRemark(t)}</td>
          <td>
            <div style="font-size:11px;">${t.updatedAt || t.timestamp}</div>
            <div style="font-size:10px;color:var(--muted);">by ${t.updatedBy || '—'}</div>
          </td>
          <td>
            <div style="display:flex; gap:8px; justify-content: flex-end;">
              <button class="btn btn-secondary" style="padding: 6px 12px; font-size:11px;" ${isClosed?'disabled':''} onclick="app.closeTicket('admin', '${t.id}')">
                ${isClosed ? t.closureStatus || 'Closed' : 'Force Close'}
              </button>
              <button class="btn btn-secondary" style="padding: 6px 12px; font-size:11px; color:var(--urgent); border-color:var(--urgent);" onclick="app.adminDeleteTicket('${t.rowId}', '${t.id}')">
                🗑 Delete
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--urgent); padding:40px;">Error loading. Check connection.</td></tr>';
      console.error(err);
    }
  },

  // ─── ADMIN: USER MANAGEMENT (now via API) ──────────────────────────────────
  adminCreateUser: async () => {
    const u = app.getVal('admin_newUsername');
    const p = app.getVal('admin_newPassword');
    if (!u || !p) { alert("Username and Password are required"); return; }

    app.showLoading('Creating user...');
    try {
      const resp = await api('create-user', { username: u, password: p });
      if (resp.ok) {
        app.setVal('admin_newUsername', '');
        app.setVal('admin_newPassword', '');
        alert("CRT User created successfully!");
        app.loadAdminUsersTable();
      } else {
        alert(resp.error || 'Failed to create user');
      }
    } catch (err) {
      alert('Error creating user.');
      console.error(err);
    } finally {
      app.hideLoading();
    }
  },

  adminDeleteUser: async (u) => {
    if (!confirm(`Are you sure you want to delete access for user '${u}'?`)) return;

    app.showLoading('Deleting user...');
    try {
      const resp = await api('delete-user', { username: u });
      if (resp.ok) {
        app.loadAdminUsersTable();
      } else {
        alert(resp.error || 'Failed to delete user');
      }
    } catch (err) {
      alert('Error deleting user.');
      console.error(err);
    } finally {
      app.hideLoading();
    }
  },

  adminDeleteTicket: async (rowId, ticketId) => {
    if (!confirm(`Are you sure you want to permanently DELETE Ticket ${ticketId} and all its resumes?`)) return;
    
    const confirmStr = prompt("Type 'DELETE' to confirm:");
    if (confirmStr !== 'DELETE') return alert("Action cancelled.");

    app.showLoading('Deleting ticket and associated files...');
    try {
      const resp = await api('delete-request', { rowId });
      if (resp.ok) {
        alert(`Ticket ${ticketId} and its resumes have been removed successfully.`);
        app.loadAdminTable();
      } else {
        alert("Failed to delete: " + (resp.error || 'Server Error'));
      }
    } catch (err) {
      alert("Error during deletion. Check connection.");
      console.error(err);
    } finally {
      app.hideLoading();
    }
  },

  loadAdminUsersTable: async () => {
    const tbody = document.querySelector('#admin_usersTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--muted);">Loading users...</td></tr>';

    try {
      const resp = await api('get-users');
      if (!resp.ok) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--urgent);">Failed to load users.</td></tr>'; return; }

      const users = resp.users || [];
      if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--muted);">No CRT users configured.</td></tr>';
        return;
      }

      tbody.innerHTML = '';
      users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-family:'Inter', sans-serif; font-size:14px; font-weight:500;">👤 ${u.username}</td>
          <td style="color:var(--muted); font-size:12px;">${u.createdAt}</td>
          <td style="text-align:right;">
            <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px; color:var(--urgent); border-color:var(--urgent);" onclick="app.adminDeleteUser('${u.username}')">Delete User</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--urgent);">Error loading users.</td></tr>';
      console.error(err);
    }
  },

  // ─── ADMIN: DATA MAINTENANCE (now via API) ─────────────────────────────────
  adminClearDataRange: async () => {
    const start = app.getVal('admin_maintenance_start');
    const end = app.getVal('admin_maintenance_end');

    if (!start || !end) {
      alert("Please select both Start and End dates.");
      return;
    }

    const confirmMsg = `⚠️ CRITICAL WARNING ⚠️\n\nThis will permanently DELETE all tickets and their associated resumes from ${start} to ${end}.\n\nThis action cannot be undone. Are you absolutely sure you want to proceed?`;
    
    if (!confirm(confirmMsg)) return;

    // Double confirmation for safety
    const secondConfirm = prompt("Please type 'DELETE' to confirm permanent data removal:");
    if (secondConfirm !== 'DELETE') {
      alert("Action cancelled. Confirmation string did not match.");
      return;
    }

    app.showLoading('Clearing data range...');
    try {
      const resp = await api('clear-data-range', { startDate: start, endDate: end });
      if (resp.ok) {
        alert(resp.message || "Data cleared successfully!");
        app.loadAdminTable();
        app.setVal('admin_maintenance_start', '');
        app.setVal('admin_maintenance_end', '');
      } else {
        alert("Failed: " + (resp.error || 'Unknown error'));
      }
    } catch (err) {
      alert("Error clearing data. Check connection.");
      console.error(err);
    } finally {
      app.hideLoading();
    }
  }
};

// Start
document.addEventListener("DOMContentLoaded", () => {
  app.init();
});
