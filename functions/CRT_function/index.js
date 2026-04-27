const catalyst = require('zcatalyst-sdk-node');
const express = require('express');
const app = express();

app.use(express.json());

// Helper to respond
const respond = (res, code, data) => res.status(code).json(data);

// ── GET Actions (Downloads) ──────────────────────────────────────────────────
app.get('*', async (req, res) => {
    const action = req.query.action;
    const catalystApp = catalyst.initialize(req);

    if (action === 'download-resume') {
        const fileId = req.query.fileId;
        if (!fileId) return respond(res, 400, { ok: false, error: 'No fileId' });

        try {
            const folder = catalystApp.filestore().folder('36689000000042811');
            const fileDetails = await folder.getFileDetails(fileId);
            res.writeHead(200, {
                'Content-Type': fileDetails.content_type || 'application/octet-stream',
                'Content-Disposition': `inline; filename="${fileDetails.file_name}"`
            });
            const stream = await folder.getFileStream(fileId);
            stream.pipe(res);
            return;
        } catch (err) {
            return res.status(404).send("File error");
        }
    }
    res.json({ ok: true, status: 'Running' });
});

// ── POST Actions ─────────────────────────────────────────────────────────────
app.post('*', async (req, res) => {
    const action = req.header('x-action') || req.query.action;
    const catalystApp = catalyst.initialize(req);
    const datastore = catalystApp.datastore();
    const data = req.body || {};

    try {
        // --- 1. AUTHENTICATION ---
        if (action === 'send-otp' || action === 'crt-send-otp') {
            const query = `SELECT * FROM CRT_users WHERE UserName = '${data.username}' AND Password = '${data.password}'`;
            const users = await catalystApp.zcql().executeZCQLQuery(query);
            if (!users || users.length === 0) return res.json({ ok: false, error: 'Invalid credentials' });
            
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            await datastore.table('36689000000041016').updateRow({ 
                ROWID: users[0].CRT_users.ROWID, 
                OTP: otp,
                OTPExpiry: new Date(Date.now() + 10 * 60000).toISOString()
            });

            try {
                await catalystApp.email().sendMail({
                    from_email: 'it@royalorchidhotels.com',
                    to_email: [data.username],
                    subject: 'Login OTP',
                    content: `Your OTP is: ${otp}`
                });
            } catch (e) {}
            return res.json({ ok: true });
        }

        if (action === 'crt-login' || action === 'verify-otp') {
            const query = `SELECT * FROM CRT_users WHERE UserName = '${data.username}' AND Password = '${data.password}' AND OTP = '${data.otp}'`;
            const users = await catalystApp.zcql().executeZCQLQuery(query);
            if (!users || users.length === 0) return res.json({ ok: false, error: 'Invalid OTP' });
            
            await datastore.table('36689000000041016').updateRow({ 
                ROWID: users[0].CRT_users.ROWID, 
                OTP: null,
                LoggedinTimeandDate: new Date().toISOString()
            });
            return res.json({ ok: true });
        }

        // --- 2. TICKETS ---
        if (action === 'get-all-tickets') {
            const results = await catalystApp.zcql().executeZCQLQuery("SELECT * FROM CRT_Tickets ORDER BY CREATEDTIME DESC");
            return res.json({ ok: true, tickets: results.map(r => r.CRT_Tickets) });
        }

        if (action === 'get-ticket') {
            const tid = String(data.ticketId || '').trim();
            if (!tid) return res.json({ ok: false, error: 'Ticket ID required' });
            
            console.log(`Searching for Ticket: [${tid}]`);

            // Tier 1: Multi-column search
            const query = `SELECT * FROM CRT_Tickets WHERE TicketID = '${tid}' OR TicketID LIKE '%${tid}%' OR ROWID = '${tid}'`;
            let results = [];
            try {
                results = await catalystApp.zcql().executeZCQLQuery(query);
            } catch (e) {
                console.error("ZCQL Error:", e);
            }

            if (results && results.length > 0) {
                const firstRow = results[0];
                const tableName = Object.keys(firstRow)[0];
                console.log(`Found via Tier 1 in table: ${tableName}`);
                return res.json({ ok: true, ticket: firstRow[tableName] });
            }

            // Tier 2: Full Scan Fallback
            console.log("Tier 1 failed. Performing full scan...");
            const all = await catalystApp.zcql().executeZCQLQuery("SELECT * FROM CRT_Tickets");
            if (all && all.length > 0) {
                const tableName = Object.keys(all[0])[0];
                const match = all.find(r => {
                    const t = r[tableName];
                    const dbId = String(t.TicketID || '').trim().toLowerCase();
                    const sId = tid.toLowerCase();
                    return dbId === sId || dbId.includes(sId) || String(t.ROWID) === tid;
                });
                if (match) {
                    console.log("Found via Tier 2 scan.");
                    return res.json({ ok: true, ticket: match[tableName] });
                }
            }
            return res.json({ ok: false, error: 'Ticket not found' });
        }

        if (action === 'create-ticket') {
            const tix = await catalystApp.zcql().executeZCQLQuery("SELECT TicketID FROM CRT_Tickets");
            let max = 0;
            tix.forEach(r => {
                let n = parseInt((r.CRT_Tickets.TicketID || '').replace('CRT-', ''));
                if (n > max) max = n;
            });
            data.TicketID = 'CRT-' + (max + 1).toString().padStart(6, '0');
            data.LoggedTimeandDate = new Date().toISOString();
            data.Status = 'Created';
            const ins = await datastore.table('36689000000042077').insertRow(data);
            return res.json({ ok: true, ticketId: data.TicketID });
        }

        if (action === 'update-ticket') {
            await datastore.table('36689000000042077').updateRow({ ...data, UpdatedTimeandDate: new Date().toISOString() });
            return res.json({ ok: true });
        }

        // --- 3. UPLOADS ---
        if (action === 'upload-resume') {
            const folder = catalystApp.filestore().folder('36689000000042811');
            const stream = require('stream');
            const buffer = Buffer.from(data.fileData.split(',')[1], 'base64');
            const bufferStream = new stream.PassThrough();
            bufferStream.end(buffer);
            const uploadRes = await folder.uploadFile({ code: bufferStream, name: data.fileName });
            return res.json({ ok: true, fileId: uploadRes.id });
        }

        // --- 4. ADMIN USERS ---
        if (action === 'admin-get-users') {
            const resu = await catalystApp.zcql().executeZCQLQuery("SELECT * FROM CRT_users ORDER BY CREATEDTIME DESC");
            return res.json({ ok: true, users: resu.map(r => r.CRT_users) });
        }

        if (action === 'admin-create-user') {
            await datastore.table('36689000000041016').insertRow({ UserName: data.username, Password: data.password });
            return res.json({ ok: true });
        }

        if (action === 'admin-delete-user') {
            await datastore.table('36689000000041016').deleteRow(data.rowid);
            return res.json({ ok: true });
        }

        if (action === 'admin-delete-ticket') {
            await datastore.table('36689000000042077').deleteRow(data.rowId);
            return res.json({ ok: true });
        }

        if (action === 'admin-clear-tickets') {
            const start = data.startDate;
            const end = data.endDate;
            if (!start || !end) return res.json({ ok: false, error: 'Start and end dates required' });
            
            // Format for ZCQL: YYYY-MM-DD HH:MM:SS
            // Input date from <input type="date"> is YYYY-MM-DD
            const query = `DELETE FROM CRT_Tickets WHERE CREATEDTIME >= '${start} 00:00:00' AND CREATEDTIME <= '${end} 23:59:59'`;
            await catalystApp.zcql().executeZCQLQuery(query);
            return res.json({ ok: true, deletedCount: 'Check Table' }); // ZCQL DELETE doesn't return count easily
        }

        if (action === 'admin-clear-resumes') {
            const start = new Date(data.startDate + 'T00:00:00').getTime();
            const end = new Date(data.endDate + 'T23:59:59').getTime();
            if (!start || !end) return res.json({ ok: false, error: 'Start and end dates required' });

            const folder = catalystApp.filestore().folder('36689000000042811');
            const files = await folder.getAllFiles();
            let deletedCount = 0;

            for (const file of files) {
                const createdTime = new Date(file.created_time).getTime();
                if (createdTime >= start && createdTime <= end) {
                    await folder.deleteFile(file.id);
                    deletedCount++;
                }
            }
            return res.json({ ok: true, deletedCount });
        }

        respond(res, 404, { ok: false, error: 'Invalid Action' });
    } catch (e) {
        console.error(e);
        res.json({ ok: false, error: e.message });
    }
});

module.exports = app;
