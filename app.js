const API_BASE = 'https://crt-helpdesk-60068587326.development.catalystserverless.in/server/CRT_function/';

const app = {
  currentRole: null,
  loggedInUser: null,
  currentTicketId: null,
  _ticketsCache: {},

  deptDesignations: {
    'Housekeeping': ['Room Attendant', 'Housekeeping Supervisor', 'Executive Housekeeper'],
    'Front Office': ['Front Desk Agent', 'Concierge', 'Front Office Manager'],
    'F&B Service': ['Waiter / Steward', 'Captain', 'Restaurant Manager'],
    'Engineering': ['Technician', 'Electrician', 'Chief Engineer'],
    'Kitchen': ['Commis I', 'Chef de Partie', 'Executive Chef'],
    'Sales': ['Sales Executive', 'Sales Manager', 'Director of Sales'],
    'Human Resources': ['HR Executive', 'HR Manager'],
    'Information Technology': ['IT Executive', 'IT Manager']
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
      const res = await fetch(API_BASE, {
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
      roleBadge.style.display = 'none';
      logoutBtn.classList.add('hidden');
    } else {
      roleBadge.style.display = 'flex';
      logoutBtn.classList.toggle('hidden', viewId === 'unit-hr' || viewId === 'functional-head');
    }
  },

  switchTab: (role, tabId) => {
    const view = document.getElementById(`view-${role}`);
    if (!view) return;
    view.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    view.querySelectorAll('.form-panel').forEach(p => p.classList.add('hidden'));

    // Highlight active button (basic substring match for simplicity)
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
      
      // Load all tickets if admin logged in
      if (app.currentRole === 'admin') {
         app.loadAllTickets();
      }
    } else {
      alert(res.error || "Login Failed.");
    }
  },

  logout: () => {
    app.currentRole = null;
    app.loggedInUser = null;
    app.showView('role-selector');
  },

  loadAllTickets: async () => {
    const tbody = document.querySelector('#admin_ticketsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Loading tickets...</td></tr>';
    
    const res = await app.api('get-all-tickets');
    if (!res.ok) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Failed to load tickets</td></tr>';
        return;
    }

    if (!res.tickets || res.tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No tickets found.</td></tr>';
        return;
    }

    tbody.innerHTML = res.tickets.map(t => {
        let hrFb = {}; try { hrFb = JSON.parse(t.HrFeedBack || '{}'); } catch(e){}
        let fhFb = {}; try { fhFb = JSON.parse(t.FhFeedBack || '{}'); } catch(e){}
        const remarks = fhFb.remarks || hrFb.remarks || '-';
        
        return `
          <tr style="cursor: pointer" onclick="app.setVal('admin_searchTicket', '${t.TicketID || t.ROWID}'); app.searchTicket('admin')">
            <td>${t.TicketID || t.ROWID || '-'}</td>
            <td>${new Date(t.LoggedTimeandDate).toLocaleDateString() || '-'}</td>
            <td>${t.HotelName || '-'}</td>
            <td>${t.Designation || '-'} (${t.Department || '-'})</td>
            <td><span class="status-badge status-${(t.Status || 'Created').replace(/ /g, '-')}">${t.Status || 'Created'}</span></td>
            <td>${remarks}</td>
            <td>${t.UpdatedTimeandDate ? new Date(t.UpdatedTimeandDate).toLocaleDateString() : '-'}</td>
            <td><button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;">View</button></td>
          </tr>
        `;
    }).join('');
  },

  // ─── HR ACTIONS ───
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
    const res = await app.api('create-ticket', {
      ...req,
      Status: 'Created'
    });
    app.hideLoading();

    if (res.ok) {
      alert(`Ticket Created! ID: ${res.ticketId}`);
      ['hr_hotelName', 'hr_stateName', 'hr_hrName', 'hr_hrContact', 'hr_hrEmail', 'hr_department', 'hr_designation', 'hr_numPositions', 'hr_experience'].forEach(id => app.setVal(id, ''));
    } else {
      alert("Failed to create ticket: " + (res.error || "Unknown Error"));
    }
  },

  // ─── SEARCH & VIEW TICKET ───
  searchTicket: async (rolePrefix) => {
    const pfx = rolePrefix === 'unit-hr' ? 'hr' : rolePrefix === 'crt-team' ? 'crt' : 'fh';
    const tid = app.getVal(`${pfx}_searchTicket`);
    if (!tid) return;

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

    // Render details
    const details = `${res.ticket.HotelName} | ${res.ticket.Designation} (${res.ticket.Department})`;
    const detailsEl = document.getElementById(`${pfx}_dispDetails`);
    if (detailsEl) detailsEl.innerText = details;

    const updatedEl = document.getElementById(`${pfx}_dispUpdated`);
    if (updatedEl) updatedEl.innerText = `Updated: ${res.ticket.UpdatedTimeandDate || res.ticket.LoggedTimeandDate}`;

    // Specific role populating
    if (pfx === 'hr') {
      const strip = document.getElementById('hr_positionStrip');
      if (strip) strip.innerHTML = `
        <div class="info-chip"><div class="info-chip-label">Hotel</div><div class="info-chip-val">${res.ticket.HotelName}</div></div>
        <div class="info-chip"><div class="info-chip-label">Positions</div><div class="info-chip-val">${res.ticket.NumberOfPositions}</div></div>
      `;
      let hrFb = {}; try { hrFb = JSON.parse(res.ticket.HrFeedBack || '{}'); } catch(e){}
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
    }
    
    app.renderResumes(pfx, res.ticket.Resumes);
  },

  renderResumes: (pfx, resumesStr) => {
    const listEl = document.getElementById(`${pfx}_resumeList`);
    if (!listEl) return;
    let resumes = [];
    try { resumes = JSON.parse(resumesStr || '[]'); } catch(e){}

    if (!resumes.length) {
      listEl.innerHTML = `<span style="color:var(--text-muted); font-size:12px;">No resumes uploaded.</span>`;
      return;
    }

    listEl.innerHTML = resumes.map((r, i) => {
      const isFile = r.type === 'file';
      const name = typeof r === 'string' ? `Link ${i+1}` : r.name;
      const url = isFile ? `${API_BASE}download?fileId=${r.fileId}` : (r.url || r);
      return `
        <div class="resume-item">
          <span style="font-size:13px;">${isFile ? '📄' : '🔗'} ${name}</span>
          <a href="${url}" target="_blank" class="btn btn-secondary" style="padding:4px 12px; font-size:11px;">View</a>
        </div>
      `;
    }).join('');
  },

  // ─── ACTIONS ───
  saveFeedback: async (pfx) => {
    const decision = app.getVal(`${pfx}_feedbackDecision`);
    const remarks = app.getVal(`${pfx}_feedbackRemarks`);
    if (!remarks) return alert("Remarks are mandatory");

    const t = app._ticketsCache[app.currentTicketId];
    if (!t) return;

    if (pfx === 'hr') t.HrFeedBack = JSON.stringify({ decision, remarks });
    if (pfx === 'fh') t.FhFeedBack = JSON.stringify({ decision, remarks });
    if (decision) t.Status = 'Interview Completed';

    app.showLoading('Saving...');
    const res = await app.api('update-ticket', t);
    app.hideLoading();
    if (res.ok) alert("Feedback saved!");
    else alert("Failed to save feedback.");
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

    app.showLoading('Updating...');
    const res = await app.api('update-ticket', t);
    app.hideLoading();
    if (res.ok) alert("Details updated!");
    else alert("Update failed.");
  },

  addResumeFile: async () => {
    const file = document.getElementById('crt_newResumeFile')?.files[0];
    if (!file) return alert("Select a file");

    app.showLoading('Uploading...');
    const base64 = await new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(file); });
    const upRes = await app.api('upload-resume', { fileName: file.name, fileData: base64 });
    
    if (!upRes.ok) {
      app.hideLoading();
      return alert("Upload failed: " + upRes.error);
    }

    const t = app._ticketsCache[app.currentTicketId];
    let resumes = []; try { resumes = JSON.parse(t.Resumes || '[]'); } catch(e){}
    resumes.push({ type: 'file', name: file.name, fileId: upRes.fileId });
    t.Resumes = JSON.stringify(resumes);
    t.Status = 'Resumes Uploaded';

    const saveRes = await app.api('update-ticket', t);
    app.hideLoading();
    if (saveRes.ok) {
      app.searchTicket('crt-team'); // Reload view
    } else {
      alert("Failed to link resume to ticket");
    }
  },

  addResumeLink: async () => {
    const link = app.getVal('crt_newResumeLink');
    if (!link) return alert("Paste a link");

    const t = app._ticketsCache[app.currentTicketId];
    let resumes = []; try { resumes = JSON.parse(t.Resumes || '[]'); } catch(e){}
    resumes.push({ type: 'link', name: link, url: link });
    t.Resumes = JSON.stringify(resumes);
    t.Status = 'Resumes Uploaded';

    app.showLoading('Saving...');
    const saveRes = await app.api('update-ticket', t);
    app.hideLoading();
    
    if (saveRes.ok) {
      app.setVal('crt_newResumeLink', '');
      app.searchTicket('crt-team');
    }
  },

  closeTicket: async () => {
    const action = app.getVal('crt_closureAction');
    const status = app.getVal('crt_statusOverride');
    const t = app._ticketsCache[app.currentTicketId];
    if (!t) return;

    if (action) t.ClosureStatus = action;
    if (status) t.Status = status;
    if (action === 'Position Filled' || action === 'Cancelled') t.Status = 'Closed';

    app.showLoading('Closing...');
    const res = await app.api('update-ticket', t);
    app.hideLoading();
    if (res.ok) {
      alert("Ticket updated!");
      app.searchTicket('crt-team');
    }
  },

  adminCreateUser: () => alert("User creation available via Catalyst Console natively."),
  adminClearDataRange: () => alert("Maintenance tasks available via Catalyst Console natively.")
};

window.onload = () => {
  const fontLink = document.createElement('link');
  fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap";
  fontLink.rel = "stylesheet";
  document.head.appendChild(fontLink);
  app.showView('role-selector');
};
