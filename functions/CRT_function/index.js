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
            const query = `SELECT * FROM CRT_Tickets WHERE TicketID = '${tid}' OR TicketID LIKE '%${tid}%' OR ROWID = '${tid}'`;
            const results = await catalystApp.zcql().executeZCQLQuery(query);
            if (results && results.length > 0) {
                return res.json({ ok: true, ticket: results[0].CRT_Tickets });
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
            await datastore.table('36689000000042077').deleteRow(data.rowid);
            return res.json({ ok: true });
        }

        respond(res, 404, { ok: false, error: 'Invalid Action' });
    } catch (e) {
        console.error(e);
        res.json({ ok: false, error: e.message });
    }
});

module.exports = app;
