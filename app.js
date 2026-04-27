const API_BASE = 'https://crt-helpdesk-60068587326.development.catalystserverless.in/server/CRT_function/';

window.app = {
  currentRole: null,
  loggedInUser: null,
  currentTicketId: null,
  _ticketsCache: {},

  deptDesignations: {
    'Housekeeping': [
      'Executive Housekeeper', 'Housekeeping Manager', 'Public Area Attendant', 
      'Housekeeping Attendant', 'Housekeeping Supervisor', 'Assistant Manager Housekeeping', 
      'Housekeeping Desk Attendant', 'Laundry Attendant', 'Housekeeping Executive', 
      'Laundry Manager', 'Asst. Laundry Manager', 'Laundry Executive', 
      'Deputy Housekeeper', 'Desk Attendant', 'Tailor'
    ],
    'Front Office': [
      'Room Division Manager', 'Front Office Manager', 'Duty Manager', 
      'Front Office Executive', 'Guest Service Associate', 'Bell Boy', 
      'Front Office Supervisor', 'Asst. Front Office Manager', 'Guest Relations Executive', 
      'Concierge Manager', 'Concierge Executive', 'Front Office Associate', 
      'Senior Guest Service Associate', 'Service Duty Manager', 'Junior Duty Manager', 
      'Valet cum Bell Boy', 'GRM'
    ],
    'Administration': [
      'Sr. VP Operations and Cluster Head (West)', 'General Manager (GM)', 
      'Hotel Manager (HM)', 'Operations Manager (EAM)'
    ],
    'F&B Service': [
      'Director Food & Beverage', 'F&B Associate', 'Captain', 'F&B Executive', 
      'Hostess', 'F&B Manager', 'Restaurant Manager', 'Assistant Food & Beverage Manager', 
      'Banquet Manager', 'F&B Supervisor', 'Assistant Restaurant Manager', 
      'Assistant Banquet Manager', 'Bar Executive', 'Bar Associate'
    ],
    'Engineering': [
      'Electrical Technician', 'Plumbing technician', 'HVAC Technician', 
      'Painter', 'General multi-technician', 'Shift Engineer', 'Chief Engineer', 
      'Engineering Manager', 'Asst. Manager Engineering', 'Carpenter', 
      'Engineering Executive', 'Engineering Supervisor', 'Multi skill technician', 
      'Lifeguard (Swimming pool)', 'Deputy Chief Engineer', 'Shift Supervisor'
    ],
    'Store': [
      'Store Supervisor', 'Store Executive'
    ],
    'Purchase': [
      'Assistant Manager Purchase', 'Purchase Executive', 'Store Assistant', 
      'Purchase Assistant', 'Purchase Manager', 'Receiving Assistant', 
      'Store In-charge', 'Purchase Supervisor'
    ],
    'SPA': [
      'SPA Receptionist', 'SPA Manager'
    ],
    'Sales': [
      'Director of Sales', 'Assistant Director of Sales', 'Marcom Manager', 
      'Sales Manager', 'Assistant Sales Manager', 'Sales Executive', 
      'Sales Coordinator', 'Social Media Executive', 'Loyalty Manager', 
      'Senior Sales Manager', 'Associate Director of Sales', 'Banquets Sales Manager'
    ],
    'Reservation': [
      'Reservation Manager', 'Reservation Executive', 'Reservation Supervisor', 
      'Reservation Associate', 'Activity Manager', 'Activity Executive'
    ],
    'F&B Production': [
      'Executive Chef', 'Bakery & Pastry Chef', 'Executive Sous Chef', 
      'Sous Chef', 'Senior Chef de Partie (Sr. CDP)', 'Chef De Partie', 
      'Demi Chef de Partie', 'Commis I', 'Butcher', 'Kitchen Stewarding Supervisor', 
      'Asst. Kitchen Stewarding Manager', 'Commis II', 'Commis III', 
      'Kitchen Stewarding Associate', 'Senior Sous Chef', 'Junior Sous Chef', 
      'KST Executive', 'KST Supervisor', 'Kitchen Stewarding Manager'
    ],
    'Finance': [
      'Unit Finance Controller', 'Finance Manager', 'Assistant Manager Accounts', 
      'Credit Manager', 'Food & Beverage Controller', 'Director of Finance', 
      'Finance Executive', 'Finance Associate', 'Accounts Receivable', 
      'Accounts Payable', 'Regional Finance Controller'
    ],
    'Security': [
      'Security Supervisor', 'Security Manager', 'Assistant Manager Security', 
      'Chief Security Officer', 'Security Guard', 'Driver / Chauffeur'
    ],
    'Human Resource': [
      'Director of Human Resource', 'Assistant Human Resource Manager', 'HR Assistant', 
      'Human Resource Executive', 'Associate Director of Human Resource', 
      'Human Resource Manager', 'Human Resource Coordinator', 'Human Resource Assistant', 
      'Training Manager', 'Training Executive', 'Training Associate', 
      'HR Supervisor', 'Cluster HR Manager'
    ],
    'Information Technology': [
      'IT Manager', 'IT Executive', 'IT Assistant'
    ]
  },

  // ─── UTILS ───
  getVal: (id) => document.getElementById(id)?.value.trim() || '',
  setVal: (id, val) => { const el = document.getElementById(id); if (el) el.value = val; },
  showLoading: (msg = 'Processing...') => {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.querySelector('.loading-text').innerText = msg;
      overlay.classList.add('visible');
    }
  },
  hideLoading: () => document.getElementById('loadingOverlay')?.classList.remove('visible'),

  api: async (action, data = {}) => {
    try {
      const res = await fetch(`${API_BASE}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-action': action },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `HTTP ${res.status}: ${res.statusText}`, detail: text };
      }
      return await res.json();
    } catch (e) {
      console.error(e);
      return { ok: false, error: 'Connection Failed', detail: e.message };
    }
  },

  // ─── ROUTING ───
  showView: (viewId) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewId}`)?.classList.add('active');

    const roleBadge = document.getElementById('roleBadge');
    const logoutBtn = document.getElementById('logoutBtn');

    if (viewId === 'role-selector' || viewId === 'login') {
      if (roleBadge) roleBadge.style.display = 'none';
      if (logoutBtn) logoutBtn.classList.add('hidden');
    } else {
      if (roleBadge) roleBadge.style.display = 'flex';
      if (logoutBtn) logoutBtn.classList.toggle('hidden', viewId === 'unit-hr' || viewId === 'functional-head');
    }
  },

  switchTab: (role, tabId) => {
    const view = document.getElementById(`view-${role}`);
    if (!view) return;
    view.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    view.querySelectorAll('.form-panel').forEach(p => p.classList.add('hidden'));

    // Highlight active button
    view.querySelectorAll('.tab-btn').forEach(b => {
      if (b.textContent.toLowerCase().includes(tabId.split('-')[0])) b.classList.add('active');
    });
    
    document.getElementById(`tab-${role}-${tabId}`)?.classList.remove('hidden');
  },

  // ─── AUTHENTICATION ───
  setRole: (role) => {
    app.currentRole = role;
    if (role === 'admin' || role === 'crt-team') {
      app.showView('login');
      document.getElementById('login_title').innerText = role === 'admin' ? 'Admin Login' : 'CRT Login';
    } else {
      document.getElementById('currentRoleDisplay').innerText = role === 'unit-hr' ? 'Unit HR' : 'Functional Head';
      app.showView(role);
      if (role === 'unit-hr') app.switchTab('unit-hr', 'create-request');
    }
  },

  sendOTP: async () => {
    const user = app.getVal('login_username');
    const pass = app.getVal('login_password');
    if (!user || !pass) return alert("Enter credentials first.");

    app.showLoading('Sending OTP...');
    const res = await app.api('send-otp', { username: user, password: pass });
    app.hideLoading();

    if (res.ok) {
      document.getElementById('otp_block').classList.remove('hidden');
    } else {
      alert(res.error || "Failed to send OTP.");
    }
  },

  handleLogin: async () => {
    const user = app.getVal('login_username');
    const pass = app.getVal('login_password');
    const otp = app.getVal('login_otp');
    if (!user || !pass || !otp) return alert("Complete all fields.");

    app.showLoading('Authenticating...');
    const res = await app.api('crt-login', { username: user, password: pass, otp });
    app.hideLoading();

    if (res.ok) {
      app.loggedInUser = user;
      document.getElementById('currentRoleDisplay').innerText = app.currentRole === 'admin' ? 'Admin' : 'CRT Team';
      app.showView(app.currentRole);
      app.switchTab(app.currentRole, app.currentRole === 'admin' ? 'tickets' : 'all-tickets');
      
      if (app.currentRole === 'admin') {
         app.loadAllTickets();
         app.loadAllUsers();
      } else if (app.currentRole === 'crt-team') {
         app.loadCrtTickets();
      }
    } else {
      alert(res.error || "Login Failed.");
    }
  },

  logout: () => {
    if (app.loggedInUser) {
        app.api('crt-logout', { username: app.loggedInUser }).catch(e => console.error(e));
    }
    app.currentRole = null;
    app.loggedInUser = null;
    app.showView('role-selector');
  },

  loadAllTickets: async () => {
    const tbody = document.querySelector('#admin_ticketsTable tbody');
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;">Loading tickets...</td></tr>';
    const res = await app.api('get-all-tickets');
    if (!res.ok) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; color:red;">Failed to load tickets</td></tr>';
        return;
    }

    if (!res.tickets || res.tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;">No tickets found.</td></tr>';
        return;
    }

    tbody.innerHTML = res.tickets.map(t => {
        let hrFb = {}; try { hrFb = JSON.parse(t.HrFeedBack || '{}'); } catch(e){}
        let fhFb = {}; try { fhFb = JSON.parse(t.FhFeedBack || '{}'); } catch(e){}
        const remarks = fhFb.remarks || hrFb.remarks || '-';
        
        let resumes = []; try { resumes = JSON.parse(t.Resumes || '[]'); } catch(e){}
        const resumeCount = resumes.length;

        return `
          <tr style="cursor: pointer" onclick="app.setVal('admin_searchTicket', '${t.TicketID || t.ROWID}'); app.searchTicket('admin')">
            <td>${t.TicketID || t.ROWID || '-'}</td>
            <td>${new Date(t.LoggedTimeandDate).toLocaleString() || '-'}</td>
            <td><div>${t.HotelName || '-'}</div><div style="font-size:11px;color:var(--muted);">${t.StateName || '-'}</div></td>
            <td><div>${t.HRContactName || '-'}</div><div style="font-size:11px;color:var(--muted);">${t.HRContactNumber || '-'}</div><div style="font-size:11px;color:var(--muted);">${t.HREmailID || '-'}</div></td>
            <td><div>${t.Designation || '-'}</div><div style="font-size:11px;color:var(--muted);">${t.Department || '-'}</div></td>
            <td>${t.NumberOfPositions || '0'}</td>
            <td>${t.ExperienceRequired || '-'}</td>
            <td><span class="status-badge status-${(t.Status || 'Created').replace(/ /g, '-')}">${t.Status || 'Created'}</span></td>
            <td>${t.Action || '-'}</td>
            <td style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${remarks}</td>
            <td>${resumeCount > 0 ? `📁 ${resumeCount}` : '-'}</td>
            <td>${t.UpdatedTimeandDate ? new Date(t.UpdatedTimeandDate).toLocaleString() : '-'}</td>
          </tr>
        `;
    }).join('');
  },

  populateDesignations: (deptId, desigId) => {
    const dept = document.getElementById(deptId).value;
    const desigSelect = document.getElementById(desigId);
    desigSelect.innerHTML = '<option value="">Select designation</option>';
    (app.deptDesignations[dept] || []).forEach(d => {
      desigSelect.innerHTML += `<option value="${d}">${d}</option>`;
    });
  },

  submitNewTicket: async () => {
    const req = {
      HotelName: app.getVal('hr_hotelName'),
      StateName: app.getVal('hr_stateName'),
      HRContactName: app.getVal('hr_hrName'),
      HRContactNumber: app.getVal('hr_hrContact'),
      HREmailID: app.getVal('hr_hrEmail'),
      Department: app.getVal('hr_department'),
      Designation: app.getVal('hr_designation'),
      NumberOfPositions: parseInt(app.getVal('hr_numPositions')) || 0,
      ExperienceRequired: app.getVal('hr_experience')
    };

    if (!req.HotelName || !req.HREmailID || !req.Department) return alert("Fill required fields.");

    app.showLoading('Submitting...');
    const res = await app.api('create-ticket', { ...req, Status: 'Created' });
    app.hideLoading();

    if (res.ok) {
      alert(`Ticket Created! ID: ${res.ticketId}`);
      ['hr_hotelName', 'hr_stateName', 'hr_hrName', 'hr_hrContact', 'hr_hrEmail', 'hr_department', 'hr_designation', 'hr_numPositions', 'hr_experience'].forEach(id => app.setVal(id, ''));
    } else {
      alert("Failed to create ticket: " + (res.error || "Unknown Error"));
    }
  },

  searchTicket: async (rolePrefix) => {
    const pfx = rolePrefix === 'unit-hr' ? 'hr' : rolePrefix === 'crt-team' ? 'crt' : 'fh';
    let tid = app.getVal(`${pfx}_searchTicket`);
    if (!tid) return;
    tid = tid.trim();
    
    app.showLoading('Searching...');
    const res = await app.api('get-ticket', { ticketId: tid });
    app.hideLoading();

    if (!res.ok) return alert("Ticket not found.");
    
    app.currentTicketId = res.ticket.TicketID;
    app._ticketsCache[app.currentTicketId] = res.ticket;
    
    document.getElementById(`${pfx}_ticketDetails`)?.classList.remove('hidden');
    document.getElementById(`${pfx}_dispId`).innerText = res.ticket.TicketID;
    document.getElementById(`${pfx}_dispStatus`).innerText = res.ticket.Status;
    document.getElementById(`${pfx}_dispStatus`).className = `status-badge status-${res.ticket.Status.replace(/ /g, '-')}`;

    const details = `${res.ticket.HotelName} | ${res.ticket.Designation} (${res.ticket.Department})`;
    const detailsEl = document.getElementById(`${pfx}_dispDetails`);
    if (detailsEl) detailsEl.innerText = details;

    const t = res.ticket;
    const updatedEl = document.getElementById(`${pfx}_dispUpdated`);
    if (updatedEl) updatedEl.innerText = `Updated: ${t.UpdatedTimeandDate ? new Date(t.UpdatedTimeandDate).toLocaleString() : new Date(t.LoggedTimeandDate).toLocaleString()}`;

    if (pfx === 'hr') {
      const posStrip = document.getElementById('hr_positionStrip');
      let hrFb = {}; try { hrFb = JSON.parse(t.HrFeedBack || '{}'); } catch(e){}
      let fhFb = {}; try { fhFb = JSON.parse(t.FhFeedBack || '{}'); } catch(e){}
      const currentRemarks = fhFb.remarks || hrFb.remarks || '-';
      
      if (posStrip) {
          posStrip.innerHTML = `
            <div class="strip-item"><strong>Hotel</strong> <span>${t.HotelName}</span></div>
            <div class="strip-item"><strong>Positions</strong> <span>${t.NumberOfPositions}</span></div>
            <div class="strip-item"><strong>Remarks</strong> <span style="color:var(--text); font-weight:500;">${currentRemarks}</span></div>
          `;
      }
      app.setVal('hr_feedbackDecision', hrFb.decision || '');
      app.setVal('hr_feedbackRemarks', hrFb.remarks || '');
    }

    if (pfx === 'crt') {
      app.setVal('crt_edit_hotelName', res.ticket.HotelName);
      app.setVal('crt_edit_stateName', res.ticket.StateName);
      app.setVal('crt_edit_hrName', res.ticket.HRContactName);
      app.setVal('crt_edit_hrContact', res.ticket.HRContactNumber);
      app.setVal('crt_edit_hrEmail', res.ticket.HREmailID);
      app.setVal('crt_edit_department', res.ticket.Department);
      app.populateDesignations('crt_edit_department', 'crt_edit_designation');
      app.setVal('crt_edit_designation', res.ticket.Designation);
      app.setVal('crt_edit_numPositions', res.ticket.NumberOfPositions);
      app.setVal('crt_edit_experience', res.ticket.ExperienceRequired);
      app.setVal('crt_statusOverride', res.ticket.Status);
      app.setVal('crt_closureAction', res.ticket.Action || '');
    }
    
    app.renderResumes(pfx);
  },

  saveFeedback: async (pfx) => {
    const decision = app.getVal(`${pfx}_feedbackDecision`);
    const remarks = app.getVal(`${pfx}_feedbackRemarks`);
    if (!remarks) return alert("Remarks are mandatory");

    const t = app._ticketsCache[app.currentTicketId];
    if (!t) return;

    if (pfx === 'hr') {
        t.HrFeedBack = JSON.stringify({ decision, remarks });
        if (decision === 'Forward to Functional Head') t.Status = 'Pending Review';
        else if (decision) t.Status = 'Interview Completed';
    }
    if (pfx === 'fh') {
        t.FhFeedBack = JSON.stringify({ decision, remarks });
        if (decision) t.Status = 'Closure Pending';
    }

    app.showLoading('Saving...');
    const res = await app.api('update-ticket', t);
    app.hideLoading();
    if (res.ok) {
        alert("Feedback saved!");
        app.searchTicket(pfx === 'hr' ? 'unit-hr' : 'functional-head');
    } else alert("Failed to save feedback: " + (res.detail || res.error));
  },

  crtSaveDetails: async () => {
    const t = app._ticketsCache[app.currentTicketId];
    if (!t) return;
    
    t.HotelName = app.getVal('crt_edit_hotelName');
    t.StateName = app.getVal('crt_edit_stateName');
    t.HRContactName = app.getVal('crt_edit_hrName');
    t.HRContactNumber = app.getVal('crt_edit_hrContact');
    t.HREmailID = app.getVal('crt_edit_hrEmail');
    t.Department = app.getVal('crt_edit_department');
    t.Designation = app.getVal('crt_edit_designation');
    t.NumberOfPositions = app.getVal('crt_edit_numPositions');
    t.ExperienceRequired = app.getVal('crt_edit_experience');
    t.Status = app.getVal('crt_statusOverride');
    t.Action = app.getVal('crt_closureAction');

    app.showLoading('Updating...');
    const res = await app.api('update-ticket', t);
    app.hideLoading();
    if (res.ok) {
        alert("Details updated!");
        app.searchTicket('crt-team');
    } else alert("Update failed: " + (res.detail || res.error));
  },

  closeTicket: async () => {
    // This handles the "Update Ticket Status" button in CRT view
    await app.crtSaveDetails();
  },

  adminCreateUser: async () => {
    const username = app.getVal('admin_newUsername');
    const password = app.getVal('admin_newPassword');
    if (!username || !password) return alert("Enter credentials.");
    
    app.showLoading("Creating...");
    const res = await app.api('admin-create-user', { username, password });
    app.hideLoading();
    if (res.ok) {
        alert("User created!");
        app.setVal('admin_newUsername', '');
        app.setVal('admin_newPassword', '');
        app.loadAllUsers();
    } else alert(res.error);
  },

  loadAllUsers: async () => {
    const tbody = document.querySelector('#admin_usersTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading users...</td></tr>';
    const res = await app.api('admin-get-users');
    if (!res.ok) return;

    const filtered = (res.users || []).filter(u => u.UserName !== 'it@royalorchidhotels.com');
    tbody.innerHTML = filtered.map(u => `
      <tr>
        <td>${u.UserName || '-'}</td>
        <td>${new Date(u.CREATEDTIME).toLocaleDateString() || '-'}</td>
        <td>${u.LoggedinTimeandDate ? new Date(u.LoggedinTimeandDate).toLocaleString() : 'Never'}</td>
        <td>${u.LoggedoutTimeandDate ? new Date(u.LoggedoutTimeandDate).toLocaleString() : 'N/A'}</td>
        <td style="text-align:right;">
          <button class="btn btn-secondary" onclick="app.adminDeleteUser('${u.ROWID}', '${u.UserName}')">Delete</button>
        </td>
      </tr>
    `).join('');
  },

  adminDeleteUser: async (userId, username) => {
    if (!confirm(`Delete user ${username}?`)) return;
    app.showLoading("Deleting...");
    const res = await app.api('admin-delete-user', { userId });
    app.hideLoading();
    if (res.ok) app.loadAllUsers();
  },

  adminDeleteTicket: async (rowId, ticketId) => {
    if (!confirm(`Permanently delete ticket ${ticketId}?`)) return;
    app.showLoading("Deleting...");
    const res = await app.api('admin-clear-data', { rowId: rowId });
    app.hideLoading();
    if (res.ok) app.loadAllTickets();
    else alert(res.error);
  },

  loadCrtTickets: async () => {
    const tbody = document.querySelector('#crt_ticketsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;">Loading...</td></tr>';
    const res = await app.api('get-all-tickets');
    if (!res.ok) return;

    tbody.innerHTML = res.tickets.map(t => {
        let hrFb = {}; try { hrFb = JSON.parse(t.HrFeedBack || '{}'); } catch(e){}
        let fhFb = {}; try { fhFb = JSON.parse(t.FhFeedBack || '{}'); } catch(e){}
        let resumes = []; try { resumes = JSON.parse(t.Resumes || '[]'); } catch(e){}
        
        const remarks = fhFb.remarks || hrFb.remarks || '-';
        const resumeCount = resumes.length;
        
        return `
          <tr style="cursor: pointer" onclick="app.switchTab('crt-team', 'manage-ticket'); app.setVal('crt_searchTicket', '${t.TicketID || t.ROWID}'); app.searchTicket('crt-team')">
            <td>${t.TicketID || t.ROWID || '-'}</td>
            <td>${new Date(t.LoggedTimeandDate).toLocaleString() || '-'}</td>
            <td><div>${t.HotelName || '-'}</div><div style="font-size:11px;color:var(--muted);">${t.StateName || '-'}</div></td>
            <td><div>${t.HRContactName || '-'}</div><div style="font-size:11px;color:var(--muted);">${t.HRContactNumber || '-'}</div><div style="font-size:11px;color:var(--muted);">${t.HREmailID || '-'}</div></td>
            <td><div>${t.Designation || '-'}</div><div style="font-size:11px;color:var(--muted);">${t.Department || '-'}</div></td>
            <td>${t.NumberOfPositions || '0'}</td>
            <td>${t.ExperienceRequired || '-'}</td>
            <td><span class="status-badge status-${(t.Status || 'Created').replace(/ /g, '-')}">${t.Status || 'Created'}</span></td>
            <td>${t.Action || '-'}</td>
            <td style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${remarks}</td>
            <td>${resumeCount > 0 ? `📁 ${resumeCount}` : '-'}</td>
            <td>${t.UpdatedTimeandDate ? new Date(t.UpdatedTimeandDate).toLocaleString() : '-'}</td>
          </tr>
        `;
    }).join('');
  },

  adminClearDataRange: async () => {
    const start = app.getVal('admin_maintenance_start');
    const end = app.getVal('admin_maintenance_end');
    if (!start || !end) return alert("Select dates.");
    if (!confirm("Permanently delete data?")) return;
    app.showLoading("Deleting...");
    const res = await app.api('admin-clear-data', { startDate: start, endDate: end });
    app.hideLoading();
    if (res.ok) {
        alert(`Deleted ${res.deleted} records.`);
        app.loadAllTickets();
    }
  },

  // ─── RESUME MANAGEMENT ───
  renderResumes: (pfx) => {
    const t = app._ticketsCache[app.currentTicketId];
    if (!t) return;
    let resumes = []; try { resumes = JSON.parse(t.Resumes || '[]'); } catch(e){}
    const listEl = document.getElementById(`${pfx}_resumeList`);
    if (!listEl) return;

    if (resumes.length === 0) {
        listEl.innerHTML = '<div style="color:var(--muted); font-size:12px;">No resumes uploaded yet.</div>';
        return;
    }

    listEl.innerHTML = resumes.map((r, idx) => `
      <div class="resume-item" style="display:flex; align-items:center; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:6px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.05);">
        <div style="font-size:16px; margin-right:12px;">${r.type === 'link' ? '🔗' : '📄'}</div>
        <div style="flex:1;">
          <div style="font-size:13px; font-weight:500;">${r.name}</div>
          <div style="font-size:10px; color:var(--muted);">${r.date || ''}</div>
        </div>
        <div style="display:flex; gap:8px;">
          ${r.type === 'file' ? 
            `<button class="btn btn-secondary" style="padding:4px 10px; font-size:11px;" onclick="app.downloadFile('${r.fileId}', '${r.name}')">Download</button>` :
            `<a href="${r.url}" target="_blank" class="btn btn-secondary" style="padding:4px 10px; font-size:11px; text-decoration:none;">Open Link</a>`
          }
          ${pfx === 'crt' ? `<button onclick="app.removeResume(${idx})" style="background:none; border:none; color:var(--urgent); cursor:pointer; font-size:16px;">&times;</button>` : ''}
        </div>
      </div>
    `).join('');
  },

  addResumeFile: async () => {
    const fileEl = document.getElementById('crt_newResumeFile');
    if (!fileEl || !fileEl.files[0]) return alert("Select a file.");
    const file = fileEl.files[0];
    const reader = new FileReader();
    app.showLoading("Uploading...");
    reader.onload = async (e) => {
        const res = await app.api('upload-resume', { fileName: file.name, fileData: e.target.result });
        if (res.ok) {
            const t = app._ticketsCache[app.currentTicketId];
            let resumes = []; try { resumes = JSON.parse(t.Resumes || '[]'); } catch(e){}
            resumes.push({ type: 'file', name: file.name, fileId: res.fileId, date: new Date().toLocaleDateString() });
            t.Resumes = JSON.stringify(resumes);
            app.renderResumes('crt');
            fileEl.value = '';
            // Auto-save
            app.crtSaveDetails();
        } else {
            alert("Upload failed: " + (res.detail || res.error));
        }
        app.hideLoading();
    };
    reader.readAsDataURL(file);
  },

  addResumeLink: () => {
    const linkEl = document.getElementById('crt_newResumeLink');
    const url = linkEl?.value.trim();
    if (!url) return alert("Enter URL.");
    const t = app._ticketsCache[app.currentTicketId];
    let resumes = []; try { resumes = JSON.parse(t.Resumes || '[]'); } catch(e){}
    resumes.push({ type: 'link', name: 'External Link', url: url, date: new Date().toLocaleDateString() });
    t.Resumes = JSON.stringify(resumes);
    app.renderResumes('crt');
    linkEl.value = '';
    // Auto-save
    app.crtSaveDetails();
  },

  removeResume: (idx) => {
    const t = app._ticketsCache[app.currentTicketId];
    let resumes = []; try { resumes = JSON.parse(t.Resumes || '[]'); } catch(e){}
    resumes.splice(idx, 1);
    t.Resumes = JSON.stringify(resumes);
    app.renderResumes('crt');
  },

  downloadFile: (fileId, fileName) => {
    // Direct stream download is more reliable than temporary URLs
    const downloadUrl = `${API_BASE}?action=download-resume&fileId=${fileId}`;
    window.location.href = downloadUrl;
  }
};

window.onload = () => {
  const fontLink = document.createElement('link');
  fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap";
  fontLink.rel = "stylesheet";
  document.head.appendChild(fontLink);
  app.showView('role-selector');
};
