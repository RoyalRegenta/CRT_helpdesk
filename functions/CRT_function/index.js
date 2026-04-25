const express = require('express');
const app = express();
const fs = require('fs');
const os = require('os');
const path = require('path');

// Helper to format dates for Catalyst Datastore
function catalystDatastoreDateTime(date = new Date()) {
  return date.toLocaleString('sv-SE', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(',', '');
}

function safe(v, max) { return String(v || '').trim().substring(0, max); }

app.use(express.json({ limit: '20mb' }));

// Health Check
// Health Check & Download Proxy
app.get('*', async (req, res) => {
    const action = req.query.action || req.header('x-action');
    
        if (action === 'download-resume') {
            const fileId = req.query.fileId;
            if (!fileId) return res.status(400).send('File ID missing');
            const FOLDER_ID = '36689000000042811';
            try {
                const catalyst = require('zcatalyst-sdk-node');
                const catalystApp = catalyst.initialize(req);
                const folder = catalystApp.filestore().folder(FOLDER_ID);
                
                // Retrieve file details to set content type and name
                const fileDetails = await folder.getFileDetails(fileId);
                
                // Get the actual file stream (this SDK uses getFileStream)
                const fileStream = await folder.getFileStream(fileId);
                
                res.writeHead(200, {
                    'Content-Type': fileDetails.content_type || 'application/octet-stream',
                    'Content-Disposition': `attachment; filename="${fileDetails.file_name}"`
                });

                fileStream.pipe(res);
                return;
            } catch (err) {
                console.error('Download error:', err);
                return res.status(404).send(`Download Error: ${err.message || 'File not found or access denied'}`);
            }
        }

    res.json({ ok: true, status: 'CRT_function is running' });
});

// Main Handler
app.post('*', async (req, res) => {
    const action = req.header('x-action');
    
    try {
        // Lazy-load SDK only when needed
        const catalyst = require('zcatalyst-sdk-node');
        const catalystApp = catalyst.initialize(req);
        const datastore = catalystApp.datastore();
        const table = datastore.table('36689000000042077');
        const data = req.body || {};

        if (action === 'send-otp') {
            // Auto-create the requested admin user if they don't exist yet
            if (data.username === 'it@royalorchidhotels.com' && data.password === 'admin123') {
                const checkAdmin = await catalystApp.zcql().executeZCQLQuery(`SELECT ROWID FROM CRT_users WHERE UserName = 'it@royalorchidhotels.com'`);
                if (!checkAdmin || checkAdmin.length === 0) {
                    await datastore.table('36689000000041016').insertRow({ UserName: 'it@royalorchidhotels.com', Password: 'admin123' });
                }
            }

            const query = `SELECT * FROM CRT_users WHERE UserName = '${data.username}' AND Password = '${data.password}'`;
            const users = await catalystApp.zcql().executeZCQLQuery(query);
            if (!users || users.length === 0) return res.json({ ok: false, error: 'Invalid credentials' });
            
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const row = users[0].CRT_users;
            
            await datastore.table('36689000000041016').updateRow({ 
                ROWID: row.ROWID, 
                OTP: otp,
                OTPExpiry: new Date(Date.now() + 10 * 60000).toISOString() // Valid for 10 mins
            });

            // Send OTP via Email
            try {
                await catalystApp.email().sendMail({
                    from_email: 'it@royalorchidhotels.com', // Replace this if your configured sender email is different
                    to_email: [data.username],
                    subject: 'Your Helpdesk Login OTP',
                    content: `Your OTP for login is: ${otp}. It is valid for 10 minutes.`
                });
            } catch (emailErr) {
                console.error("Email sending failed. Is 'it@royalorchidhotels.com' verified in Catalyst Mail?", emailErr);
                // We still return true so they can manually fetch OTP from DB if email fails during testing
            }

            return res.json({ ok: true, message: 'OTP generated and sent to email.' });
        }
        
        else if (action === 'crt-login') {
            const query = `SELECT * FROM CRT_users WHERE UserName = '${data.username}' AND Password = '${data.password}' AND OTP = '${data.otp}'`;
            const users = await catalystApp.zcql().executeZCQLQuery(query);
            if (!users || users.length === 0) return res.json({ ok: false, error: 'Invalid credentials or OTP' });
            
            const row = users[0].CRT_users;
            await datastore.table('36689000000041016').updateRow({ 
                ROWID: row.ROWID, 
                OTP: null,
                LoggedinTimeandDate: new Date().toISOString()
            });
            return res.json({ ok: true });
        }

        else if (action === 'create-ticket') {
            try {
                // Fetch all to find the highest TicketID
                const tixQuery = `SELECT TicketID FROM CRT_Tickets`;
                const allTix = await catalystApp.zcql().executeZCQLQuery(tixQuery);
                let maxNum = 0;
                if (allTix && allTix.length > 0) {
                    allTix.forEach(r => {
                        let tid = r.CRT_Tickets.TicketID;
                        if (tid && tid.startsWith('CRT-')) {
                            let num = parseInt(tid.replace('CRT-', ''));
                            if (!isNaN(num) && num > maxNum) maxNum = num;
                        }
                    });
                }
                data.TicketID = 'CRT-' + (maxNum + 1).toString().padStart(6, '0');
            } catch (err) {
                console.error("Ticket ID generation error:", err);
                data.TicketID = 'CRT-' + Date.now().toString().slice(-6); // Fallback
            }

            data.LoggedTimeandDate = new Date().toISOString();
            data.Status = data.Status || 'Created';
            const insert = await table.insertRow(data);
            
            // Send Ticket ID via Email to HR
            if (data.HREmailID) {
                try {
                    await catalystApp.email().sendMail({
                        from_email: 'it@royalorchidhotels.com',
                        to_email: [data.HREmailID],
                        subject: `Helpdesk Ticket Created: ${data.TicketID}`,
                        content: `Hello ${data.HRContactName || 'HR Team'},\n\nYour recruitment helpdesk ticket has been successfully created.\n\nTicket ID: ${data.TicketID}\nHotel: ${data.HotelName || 'N/A'}\nPosition: ${data.Designation || 'N/A'}\n\nPlease save this Ticket ID for future tracking.\n\nRegards,\nCRT Helpdesk System`
                    });
                } catch (emailErr) {
                    console.error("Failed to send ticket email to HR:", emailErr);
                }
            }

            return res.json({ ok: true, ticketId: data.TicketID, ROWID: insert.ROWID });
        }

        else if (action === 'get-ticket') {
            const input = data.ticketId.trim();
            
            // Fetch tickets using ZCQL - we try to match via ZCQL first for efficiency
            const query = `SELECT * FROM CRT_Tickets WHERE TicketID LIKE '%${input}%' OR ROWID = '${input}'`;
            let results = [];
            try {
                results = await catalystApp.zcql().executeZCQLQuery(query);
            } catch (e) {
                // If query fails (maybe table name alias issue), fallback to getting all and filtering
                const fallbackResults = await catalystApp.zcql().executeZCQLQuery("SELECT * FROM CRT_Tickets");
                if (fallbackResults && fallbackResults.length > 0) {
                    const tableName = Object.keys(fallbackResults[0])[0];
                    const match = fallbackResults.find(r => {
                        const t = r[tableName];
                        return (t.TicketID && t.TicketID.toLowerCase().includes(input)) || 
                               (t.ROWID && t.ROWID.toString() === input);
                    });
                    if (match) results = [match];
                }
            }

            if (results && results.length > 0) {
                const firstRow = results[0];
                const tableName = Object.keys(firstRow)[0];
                return res.json({ ok: true, ticket: firstRow[tableName] });
            }
            return res.json({ ok: false, error: 'Ticket not found' });
        }

        else if (action === 'get-all-tickets') {
            const query = `SELECT * FROM CRT_Tickets ORDER BY CREATEDTIME DESC`;
            const results = await catalystApp.zcql().executeZCQLQuery(query);
            // ZCQL returns an array of objects like { CRT_Tickets: { TicketID: "...", Status: "..." } }
            // We'll map this into a flat array for the frontend
            const tickets = results.map(row => row.CRT_Tickets);
            return res.json({ ok: true, tickets });
        }

        else if (action === 'admin-create-user') {
            if (!data.username || !data.password) return res.json({ ok: false, error: 'Username and password required' });
            const check = await catalystApp.zcql().executeZCQLQuery(`SELECT ROWID FROM CRT_users WHERE UserName = '${data.username}'`);
            if (check && check.length > 0) return res.json({ ok: false, error: 'User already exists' });
            
            await datastore.table('36689000000041016').insertRow({ 
                UserName: data.username, 
                Password: data.password,
                OTP: null,
                OTPExpiry: null,
                LoggedinTimeandDate: null,
                LoggedoutTimeandDate: null
            });
            return res.json({ ok: true });
        }

        else if (action === 'admin-get-users') {
            const query = `SELECT ROWID, UserName, CREATEDTIME, LoggedinTimeandDate, LoggedoutTimeandDate FROM CRT_users WHERE UserName != 'it@royalorchidhotels.com' ORDER BY CREATEDTIME DESC`;
            const results = await catalystApp.zcql().executeZCQLQuery(query);
            const users = results ? results.map(row => row.CRT_users) : [];
            return res.json({ ok: true, users });
        }

        else if (action === 'admin-delete-user') {
            if (!data.userId) return res.json({ ok: false, error: 'User ID required' });
            
            // Protect superadmin from deletion
            const check = await catalystApp.zcql().executeZCQLQuery(`SELECT UserName FROM CRT_users WHERE ROWID = ${data.userId}`);
            if (check && check.length > 0 && check[0].CRT_users.UserName === 'it@royalorchidhotels.com') {
                return res.json({ ok: false, error: 'Cannot delete superadmin' });
            }

            await datastore.table('36689000000041016').deleteRow(data.userId);
            return res.json({ ok: true });
        }

        else if (action === 'crt-logout') {
            const query = `SELECT ROWID FROM CRT_users WHERE UserName = '${data.username}'`;
            const users = await catalystApp.zcql().executeZCQLQuery(query);
            if (users && users.length > 0) {
                const row = users[0].CRT_users;
                await datastore.table('36689000000041016').updateRow({ 
                    ROWID: row.ROWID, 
                    LoggedoutTimeandDate: new Date().toISOString()
                });
            }
            return res.json({ ok: true });
        }

        else if (action === 'admin-clear-data') {
            if (!data.startDate || !data.endDate) return res.json({ ok: false, error: 'Start and end dates required' });
            const start = new Date(data.startDate).getTime();
            const end = new Date(data.endDate).getTime() + 86399999; // End of the day
            
            const query = `SELECT ROWID, LoggedTimeandDate FROM CRT_Tickets`;
            const results = await catalystApp.zcql().executeZCQLQuery(query);
            
            let deleteCount = 0;
            if (results && results.length > 0) {
                // To safely bulk-delete, we map to promises and Promise.all or process sequentially
                // Processing sequentially is safer for Catalyst rate limits
                for (let r of results) {
                    const rowId = r.CRT_Tickets.ROWID;
                    const loggedStr = r.CRT_Tickets.LoggedTimeandDate;
                    if (loggedStr) {
                        const loggedTime = new Date(loggedStr).getTime();
                        if (loggedTime >= start && loggedTime <= end) {
                            try {
                                await datastore.table('CRT_Tickets').deleteRow(rowId);
                                deleteCount++;
                            } catch (e) {
                                console.error("Error deleting row", rowId, e);
                            }
                        }
                    }
                }
            }
            return res.json({ ok: true, deleted: deleteCount });
        }

        else if (action === 'update-ticket') {
            let rowId = data.ROWID;
            if (!rowId && data.TicketID) {
                const q = await catalystApp.zcql().executeZCQLQuery(`SELECT ROWID FROM CRT_Tickets WHERE TicketID = '${data.TicketID}'`);
                if (q && q.length > 0) rowId = q[0].CRT_Tickets.ROWID;
            }
            if (!rowId) return res.json({ ok: false, error: 'System ROWID not found' });
            
            // 🚀 AUTOMATIC COLUMN DISCOVERY
            // This ensures we never send an "Invalid Column" error again.
            // We fetch a sample record to see exactly what columns exist in your table.
            let columns = [];
            try {
                const sample = await catalystApp.zcql().executeZCQLQuery("SELECT * FROM CRT_Tickets LIMIT 1");
                if (sample && sample.length > 0) {
                    columns = Object.keys(sample[0].CRT_Tickets);
                } else {
                    // Fallback to basic fields if table is empty
                    columns = ['ROWID', 'TicketID', 'Status', 'UpdatedTimeandDate'];
                }
            } catch (e) {
                console.error('Column Discovery Error:', e);
                columns = ['ROWID', 'TicketID', 'Status', 'UpdatedTimeandDate']; 
            }

            const updateData = { ROWID: rowId };

            // Filter data to ONLY include columns that actually exist in your database
            columns.forEach(f => {
                if (data[f] !== undefined && f !== 'ROWID') {
                    // Type casting for numeric fields
                    if (f === 'NumberOfPositions' || f === 'ExperienceRequired') {
                        updateData[f] = Number(data[f]) || 0;
                    } else {
                        updateData[f] = data[f];
                    }
                }
            });
            
            try {
                updateData.UpdatedTimeandDate = catalystDatastoreDateTime();
                await table.updateRow(updateData);
                return res.json({ ok: true });
            } catch (e) {
                console.error('Update Ticket Error:', e);
                // Return full error details for diagnostics
                return res.json({ 
                    ok: false, 
                    error: 'Database Update Failed', 
                    detail: e.message || JSON.stringify(e) 
                });
            }
        }

        else if (action === 'upload-resume') {
            if (!data.fileName || !data.fileData) return res.json({ ok: false, error: 'File data missing' });
            
            const FOLDER_ID = '36689000000042811'; 
            const fileName = safe(data.fileName, 255) || `resume_${Date.now()}.pdf`;
            const fileBase64 = String(data.fileData || '').replace(/^data:.*;base64,/, '');
            
            if (!fileBase64) return res.json({ ok: false, error: 'No file data provided' });

            const fileBuffer = Buffer.from(fileBase64, 'base64');
            const filestore = catalystApp.filestore();
            const folder = filestore.folder(FOLDER_ID);
            let tempPath = '';
            
            try {
                const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
                tempPath = path.join(os.tmpdir(), `${Date.now()}_${safeName}`);
                fs.writeFileSync(tempPath, fileBuffer);
                const fileStream = fs.createReadStream(tempPath);

                // Using the specific format the user provided (code: fileStream)
                const uploadRes = await folder.uploadFile({
                    code: fileStream,
                    name: safeName
                });

                const fileId = uploadRes && uploadRes.id ? uploadRes.id : '';
                return res.json({
                    ok: true,
                    fileId: fileId,
                    fileName: safeName
                });
            } catch (err) {
                console.error('Upload Error:', err);
                return res.json({ ok: false, error: `Upload failed: ${err.message}` });
            } finally {
                if (tempPath && fs.existsSync(tempPath)) fs.unlink(tempPath, () => {});
            }
        }

        else if (action === 'download-resume') {
            const fileId = req.query.fileId || data.fileId;
            if (!fileId) return res.status(400).send('File ID missing');
            const FOLDER_ID = '36689000000042811';
            try {
                const folder = catalystApp.filestore().folder(FOLDER_ID);
                const fileDetails = await folder.getFileDetails(fileId);
                const fileStream = await folder.downloadFile(fileId);
                
                res.setHeader('Content-Type', fileDetails.content_type || 'application/octet-stream');
                res.setHeader('Content-Disposition', `attachment; filename="${fileDetails.file_name}"`);
                fileStream.pipe(res);
            } catch (e) {
                console.error('Download Error:', e);
                res.status(404).send('File not found');
            }
            return; // Exit early to avoid res.json below
        }

        else if (action === 'get-resume-url') {
            if (!data.fileId) return res.json({ ok: false, error: 'File ID missing' });
            const FOLDER_ID = '36689000000042811';
            try {
                const folder = catalystApp.filestore().folder(FOLDER_ID);
                const url = await folder.getFileDownloadURL(data.fileId);
                return res.json({ ok: true, url: url });
            } catch (e) {
                return res.json({ ok: false, error: e.message });
            }
        }

        else {
            return res.json({ ok: false, error: 'Unknown action: ' + action });
        }

    } catch (e) {
        console.error('CRT_function Error:', e);
        return res.json({ ok: false, error: e.message || 'Internal server error' });
    }
});

module.exports = app;
