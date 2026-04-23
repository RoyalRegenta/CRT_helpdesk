const API_BASE = 'https://hr-helpdesk-60068587326.development.catalystserverless.in/server/HR_function/';

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
      return await res.json();
    } catch (e) {
      console.error(e);
      return { error: 'Network Error' };
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
    } else {
      alert(res.error || "Login Failed.");
    }
  },

  logout: () => {
    app.currentRole = null;
    app.loggedInUser = null;
    app.showView('role-selector');
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

    if (!req.hotelName || !req.hrEmail || !req.department) return alert("Fill required fields.");

    app.showLoading('Submitting...');
    const res = await app.api('create-ticket', {
      Status: 'Created',
      HotelName: req.hotelName,
      State: req.stateName,
      HrName: req.hrName,
      HrEmail: req.hrEmail,
      HrContact: req.hrContact,
      Department: req.department,
      Designation: req.designation,
      NumPositions: req.numPositions,
      Experience: req.experience
    });
    app.hideLoading();

    if (res.ok) {
      alert(`Ticket Created! ID: ${res.ticketId}`);
      ['hr_hotelName', 'hr_stateName', 'hr_hrName', 'hr_hrContact', 'hr_hrEmail', 'hr_department', 'hr_designation', 'hr_numPositions', 'hr_experience'].forEach(id => app.setVal(id, ''));
    } else {
      alert("Failed to create ticket.");
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
    document.getElementById(`${pfx}_ticketDetails`)?.classList.remove('hidden');
    document.getElementById(`${pfx}_dispId`).innerText = res.ticket.TicketID;
    document.getElementById(`${pfx}_dispStatus`).innerText = res.ticket.Status;
    document.getElementById(`${pfx}_dispStatus`).className = `status-badge status-${res.ticket.Status.replace(/ /g, '-')}`;
  },

  // Mock implementation for UI interactions requested in index.html
  saveFeedback: () => alert("Feedback saved!"),
  crtSaveDetails: () => alert("Details updated!"),
  addResumeFile: () => alert("Resume file uploaded!"),
  addResumeLink: () => alert("Resume link added!"),
  closeTicket: () => alert("Ticket closed!"),
  adminCreateUser: () => alert("User created!"),
  adminClearDataRange: () => alert("Data cleared!")
};

window.onload = () => {
  const fontLink = document.createElement('link');
  fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap";
  fontLink.rel = "stylesheet";
  document.head.appendChild(fontLink);
  app.showView('role-selector');
};
