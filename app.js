const API_BASE = 'https://crt-helpdesk-60068587326.development.catalystserverless.in/server/CRT_function/';

var app = {
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
      'Spa Manager', 'Spa Executive', 'Spa Therapist', 'Nail Technician', 
      'Spa supervisor'
    ],
    'Sales': [
      'Regional Sales Manager', 'Sales Manager', 'Assistant Sales Manager', 
      'Sales Executive', 'Sales Coordinator', 'Revenue Manager', 
      'Asst Revenue Manager', 'Digital Marketing Executive', 'Digital Marketing Manager', 
      'Graphic Designer', 'Director Sales and Marketing'
    ],
    'Reservation': [
      'Reservation Manager', 'Reservation Executive', 'Reservation Supervisor', 
      'Asst. Reservation Manager'
    ],
    'F&B Production': [
      'Executive Chef', 'Sous Chef', 'Commis I', 'Commis II', 'Commis III', 
      'Kitchen Helper', 'Pastry Chef', 'CDP', 'DCDP', 'Executive Sous Chef', 
      'Jr. Sous Chef', 'KST Executive', 'KST Supervisor', 'Utility'
    ],
    'Finance': [
      'Financial Controller', 'Finance Manager', 'Asst. Manager Finance', 
      'Accounts Executive', 'Accounts Assistant', 'General Cashier', 
      'Cost Controller', 'Accounts Supervisor', 'Purchase Manager'
    ],
    'Security': [
      'Security Manager', 'Asst. Manager Security', 'Security Supervisor', 
      'Security Guard', 'Security In-charge'
    ],
    'Human Resource': [
      'Director Human Resource', 'Human Resource Manager', 'Assistant Manager HR', 
      'HR Executive', 'HR Coordinator', 'Training Manager', 'Training Associate'
    ],
    'Information Technology': [
      'Assistant Manager IT', 'IT Executive', 'IT Manager', 'IT Supervisor'
    ]
  },

  getVal: id => document.getElementById(id)?.value || '',
  setVal: (id, val) => { if(document.getElementById(id)) document.getElementById(id).value = val; },

  api: async (action, data = {}) => {
    try {
      const response = await fetch(API_BASE + '?action=' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      return { ok: false, error: 'Network or Server Error' };
    }
  },

  showLoading: (msg) => {
    document.querySelector('.loading-text').innerText = msg || 'Processing...';
    document.getElementById('loadingOverlay').classList.add('active');
  },
  hideLoading: () => {
    document.getElementById('loadingOverlay').classList.remove('active');
  },

  showView: (viewId) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');
    if (viewId === 'admin') app.loadAllTickets();
    if (viewId === 'crt-team') app.loadCrtTickets();
  },

  switchTab: (role, tabId) => {
    document.querySelectorAll(`#view-${role} .tab-btn`).forEach(b => b.classList.remove('active'));
    document.querySelectorAll(`#view-${role} .form-panel`).forEach(p => p.classList.add('hidden'));
    
    event.currentTarget?.classList.add('active');
    document.getElementById(`tab-${role}-${tabId}`).classList.remove('hidden');
    
    if (tabId === 'all-tickets') app.loadCrtTickets();
    if (tabId === 'users') app.loadAllUsers();
  },

  setRole: (role) => {
    app.currentRole = role;
    if (role === 'unit-hr') {
      app.showView('unit-hr');
    } else {
      document.getElementById('login_title').innerText = role === 'admin' ? 'Admin Login' : 'CRT Team Login';
      document.getElementById('login_id_label').innerText = role === 'admin' ? 'Email ID' : 'Username';
      app.showView('login');
    }
  },

  sendOTP: async () => {
    const id = app.getVal('login_username');
    if (!id) return alert("Enter " + (app.currentRole === 'admin' ? "Email" : "Username"));

    app.showLoading("Sending OTP...");
    const res = await app.api('crt-send-otp', { id, role: app.currentRole });
    app.hideLoading();

    if (res.ok) {
      alert("OTP sent to your registered email!");
      document.getElementById('otp_block').classList.remove('hidden');
    } else {
      alert(res.error || "User not found or error sending OTP");
    }
  },

  handleLogin: async () => {
    const id = app.getVal('login_username');
    const otp = app.getVal('login_otp');
    if (!otp) return alert("Enter OTP");

    app.showLoading("Verifying...");
    const res = await app.api('crt-verify-otp', { id, otp, role: app.currentRole });
    app.hideLoading();

    if (res.ok) {
      app.loggedInUser = id;
      app.showView(app.currentRole);
    } else {
      alert(res.error || "Invalid OTP");
    }
  },

  login: async (role) => {
    const username = app.getVal(`${role}-username`);
    const password = app.getVal(`${role}-password`);
    if (!username || !password) return alert("Enter credentials.");

    app.showLoading('Logging in...');
    const res = await app.api('crt-login', { username, password });
    app.hideLoading();

    if (res.ok) {
      app.currentRole = role;
      app.loggedInUser = username;
      app.showView(role);
    } else {
      alert("Login failed: " + (res.error || "Unknown error"));
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
            <td>${new Date(t.LoggedTimeandDate).toLocaleString() || '-'}</td>
            <td>${t.HotelName || '-'}</td>
            <td>${t.Designation || '-'} (${t.Department || '-'})</td>
            <td><span class="status-badge status-${(t.Status || 'Created').replace(/ /g, '-')}">${t.Status || 'Created'}</span></td>
            <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${remarks}</td>
            <td>${t.UpdatedTimeandDate ? new Date(t.UpdatedTimeandDate).toLocaleString() : '-'}</td>
            <td>
              <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="event.stopPropagation(); app.searchTicket('admin')">View</button>
              <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px; border-color:var(--urgent); color:var(--urgent);" onclick="event.stopPropagation(); app.adminDeleteTicket('${t.ROWID}', '${t.TicketID}')">Delete</button>
            </td>
          </tr>
        `;
    }).join('');
  },

  populateDesignations: (deptId, desigId) => {
    const deptEl = document.getElementById(deptId);
    if (!deptEl) return;
    const dept = deptEl.value;
    const desigSelect = document.getElementById(desigId);
    if (!desigSelect) return;
    
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
    
    const t = res.ticket;
    app.currentTicketId = t.TicketID;
    app._ticketsCache[app.currentTicketId] = t;
    
    document.getElementById(`${pfx}_ticketDetails`)?.classList.remove('hidden');
    document.getElementById(`${pfx}_dispId`).innerText = t.TicketID;
    document.getElementById(`${pfx}_dispStatus`).innerText = t.Status;
    document.getElementById(`${pfx}_dispStatus`).className = `status-badge status-${t.Status.replace(/ /g, '-')}`;

    const details = `${t.HotelName} | ${t.Designation} (${t.Department})`;
    const detailsEl = document.getElementById(`${pfx}_dispDetails`);
    if (detailsEl) detailsEl.innerText = details;

    const updatedEl = document.getElementById(`${pfx}_dispUpdated`);
    if (updatedEl) updatedEl.innerText = `Updated: ${t.UpdatedTimeandDate ? new Date(t.UpdatedTimeandDate).toLocaleString() : new Date(t.LoggedTimeandDate).toLocaleString()}`;

    let hrFb = {}; try { hrFb = JSON.parse(t.HrFeedBack || '{}'); } catch(e){}
    let fhFb = {}; try { fhFb = JSON.parse(t.FhFeedBack || '{}'); } catch(e){}
    const currentRemarks = fhFb.remarks || hrFb.remarks || '-';

    if (pfx === 'hr') {
      const posStrip = document.getElementById('hr_positionStrip');
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
      app.setVal('crt_edit_hotelName', t.HotelName);
      app.setVal('crt_edit_stateName', t.StateName);
      app.setVal('crt_edit_hrName', t.HRContactName);
      app.setVal('crt_edit_hrContact', t.HRContactNumber);
      app.setVal('crt_edit_hrEmail', t.HREmailID);
      app.setVal('crt_edit_department', t.Department);
      app.populateDesignations('crt_edit_department', 'crt_edit_designation');
      app.setVal('crt_edit_designation', t.Designation);
      app.setVal('crt_edit_numPositions', t.NumberOfPositions);
      app.setVal('crt_edit_experience', t.ExperienceRequired);
      app.setVal('crt_statusOverride', t.Status);
      app.setVal('crt_closureAction', t.ClosureStatus || '');
    }

    if (pfx === 'fh') {
      app.setVal('fh_feedbackDecision', fhFb.decision || '');
      app.setVal('fh_feedbackRemarks', fhFb.remarks || '');
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
        alert("Evaluation saved!");
        app.searchTicket(pfx === 'hr' ? 'unit-hr' : 'functional-head');
    } else alert(res.error);
  },

  loadCrtTickets: async () => {
    const tbody = document.querySelector('#crt_ticketsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Loading tickets...</td></tr>';
    
    const res = await app.api('get-all-tickets');
    if (!res.ok) return;

    tbody.innerHTML = res.tickets.map(t => {
        let resumes = []; try { resumes = JSON.parse(t.Resumes || '[]'); } catch(e){}
        const resumeCount = resumes.length;
        let hrFb = {}; try { hrFb = JSON.parse(t.HrFeedBack || '{}'); } catch(e){}
        let fhFb = {}; try { fhFb = JSON.parse(t.FhFeedBack || '{}'); } catch(e){}
        const remarks = fhFb.remarks || hrFb.remarks || '-';

        return `
          <tr style="cursor: pointer" onclick="app.setVal('crt_searchTicket', '${t.TicketID || t.ROWID}'); app.searchTicket('crt-team')">
            <td>${t.TicketID || t.ROWID || '-'}</td>
            <td>${new Date(t.LoggedTimeandDate).toLocaleString() || '-'}</td>
            <td>${t.HotelName || '-'}</td>
            <td>${t.Designation || '-'} (${t.Department || '-'})</td>
            <td>${t.NumberOfPositions || '0'}</td>
            <td><span class="status-badge status-${(t.Status || 'Created').replace(/ /g, '-')}">${t.Status || 'Created'}</span></td>
            <td style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${remarks}</td>
            <td>${resumeCount > 0 ? `📁 ${resumeCount}` : '-'}</td>
            <td>${t.UpdatedTimeandDate ? new Date(t.UpdatedTimeandDate).toLocaleString() : '-'}</td>
            <td><button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;">Manage</button></td>
          </tr>
        `;
    }).join('');
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
    t.Status = app.getVal('crt_statusOverride') || t.Status;
    t.ClosureStatus = app.getVal('crt_closureAction');

    app.showLoading('Updating...');
    const res = await app.api('update-ticket', t);
    app.hideLoading();
    if (res.ok) {
        alert("Details updated!");
        app.searchTicket('crt-team');
    } else alert("Update failed: " + (res.detail || res.error));
  },

  closeTicket: async () => {
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

  adminDeleteUser: async (rowid, username) => {
    if (!confirm(`Delete user ${username}?`)) return;
    app.showLoading("Deleting...");
    const res = await app.api('admin-delete-user', { rowid });
    app.hideLoading();
    if (res.ok) {
        alert("User deleted!");
        app.loadAllUsers();
    } else alert(res.error);
  },

  adminDeleteTicket: async (rowid, ticketId) => {
    if (!confirm(`Permanently delete ticket ${ticketId}?`)) return;
    app.showLoading("Deleting...");
    const res = await app.api('admin-delete-ticket', { rowid });
    app.hideLoading();
    if (res.ok) {
        alert("Ticket deleted!");
        app.loadAllTickets();
    } else alert(res.error);
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
