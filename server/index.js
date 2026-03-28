require('dotenv').config();
const exifr = require('exifr');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// ── HEALTH CHECK ROUTE ────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('<div style="font-family: sans-serif; text-align: center; margin-top: 50px;"><h1>🚀 Vault API is Online</h1><p>Connected to MongoDB Atlas & Google Cloud.</p></div>');
});

// ── CONNECT TO MONGODB ────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || "mongodb+srv://shauryacocid_db_user:vcNuzVfB6qBPDtya@cluster0.3lo8tcv.mongodb.net/GrantTracker?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => console.log('✅ MongoDB Connected Permanently'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ── DATABASE SCHEMAS ──────────────────────────────────────────────────────────
const Grant = mongoose.model('Grant', new mongoose.Schema({
  id: Number, source: String, userId: String, amount: Number, type: String,
  status: String, actionBy: String, note: String, creditScore: String,
  date: String, disbursedAmount: Number, proofs: Array, privateNotes: Array,
  previousHash: String, currentHash: String, impact: Object,

  // NEW RISK MITIGATION FIELDS
  guarantorEmail: String,
  requireSignature: { type: Boolean, default: false },
  signature: String,
  signatureDate: String
}, { strict: false }));

const AuditLog = mongoose.model('AuditLog', new mongoose.Schema({
  id: Number, timestamp: String, admin: String, action: String,
  target: String, details: String, targetId: Number
}, { strict: false }));

const Strike = mongoose.model('Strike', new mongoose.Schema({ userId: String, count: Number }));
const HashBlacklist = mongoose.model('HashBlacklist', new mongoose.Schema({ hash: String }));

// ── EMAIL CONFIGURATION & MEMORY STATE ────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER || 'ss.sepm.project.ss@gmail.com',
    pass: process.env.EMAIL_PASS || 'lzxzdgccpgzcgrnu'
  }
});

let adminOtps = {};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const getCreditLimit = (score) => {
  const s = parseInt(score);
  if (isNaN(s)) return 0;
  if (s >= 750) return 100000;
  if (s >= 600) return 25000;
  return 0;
};

const generateHash = (data, previousHash) => {
  const payload = JSON.stringify(data) + previousHash;
  return crypto.createHash('sha256').update(payload).digest('hex');
};

const logAction = async (admin, action, target, details, targetId = null) => {
  await AuditLog.create({
    id: Date.now(), timestamp: new Date().toLocaleString(),
    admin: admin || 'System', action, target, details, targetId
  });
};

// ══════════════════════════════════════════════════════════════════════════════
// 🛑 SECRET WIPE ROUTE (FOR TESTING ONLY)
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/secret-wipe-database', async (req, res) => {
  await Grant.deleteMany({});
  await AuditLog.deleteMany({});
  await Strike.deleteMany({});
  await HashBlacklist.deleteMany({});
  res.send('<h1 style="color: #10b981; font-family: sans-serif;">✅ Database completely wiped!</h1><p style="font-family: sans-serif;">You can close this tab and refresh your app. Your data is fresh.</p>');
});

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.get('/grants', async (req, res) => {
  const grants = await Grant.find().lean();
  const strikes = await Strike.find().lean();
  const strikeMap = strikes.reduce((acc, s) => ({ ...acc, [s.userId]: s.count }), {});
  const enrichedGrants = grants.map(g => ({ ...g, strikes: strikeMap[g.userId] || 0 }));
  res.json(enrichedGrants);
});

app.get('/logs', async (req, res) => {
  const logs = await AuditLog.find().sort({ id: -1 }).lean();
  res.json(logs);
});

app.post('/add-grant', async (req, res) => {
  const { source, amount, type, creditScore, userId, guarantorEmail } = req.body;

  const userStrike = await Strike.findOne({ userId });
  if (userStrike && userStrike.count >= 3) {
    await logAction('Security Bot', 'BLOCKED', source, `Blacklisted entity attempted application.`);
    return res.status(403).json({ error: true, message: 'ERROR 403: ENTITY BLACKLISTED DUE TO REPEATED FRAUD.' });
  }

  const isDuplicate = await Grant.findOne({ userId, type, status: 'Pending' });
if (isDuplicate) return res.status(400).json({ error: true, message: `DUPLICATE DETECTED: You already have a Pending request for ${type}.` });

const activeInvestigation = await Grant.findOne({ userId, status: 'Blocked' });
if (activeInvestigation) {
  await logAction('Security Bot', 'BLOCKED APPLICATION', source, `Applicant attempted new grant while under active investigation (Case: ${activeInvestigation.id}).`);
  return res.status(403).json({ error: true, message: 'INVESTIGATION HOLD: You cannot submit new applications while an existing grant is under administrative investigation. Contact your institution for assistance.' });
}
  const reqAmount = parseInt(amount);
  const serverLimit = getCreditLimit(creditScore);
  if (reqAmount > serverLimit) {
    await logAction('Security Bot', 'BLOCKED', source, `Attempted ₹${reqAmount} with score ${creditScore}`);
    return res.status(400).json({ error: true, message: `SECURITY ALERT: Limit for score ${creditScore} is ₹${serverLimit.toLocaleString()}.` });
  }

  const newGrant = new Grant({
    id: Date.now(), source, userId, amount: reqAmount, type: type || 'General',
    status: 'Pending', actionBy: null, note: '', creditScore, date: new Date().toLocaleDateString(),
    disbursedAmount: 0, proofs: [], privateNotes: [], previousHash: 'GENESIS_BLOCK_0000', currentHash: '',
    guarantorEmail: guarantorEmail || null
  });

  newGrant.currentHash = generateHash({ source, amount: reqAmount, date: newGrant.date }, newGrant.previousHash);
  await newGrant.save();
  await logAction('System', 'SUBMITTED', source, `New ${type} grant application for ₹${reqAmount}${guarantorEmail ? ' (Guarantor attached)' : ''}`, newGrant.id);
  res.json(newGrant);
});

app.post('/edit-grant', async (req, res) => {
  const { id, source, amount, creditScore, type } = req.body;
  const grant = await Grant.findOne({ id });
  if (!grant) return res.status(404).json({ message: 'Grant not found' });
  if (grant.status !== 'Pending') return res.status(400).json({ message: 'Only Pending grants can be edited.' });

  const reqAmount = parseInt(amount);
  const serverLimit = getCreditLimit(creditScore);
  if (reqAmount > serverLimit) return res.status(400).json({ message: `Amount exceeds limit of ₹${serverLimit.toLocaleString()}.` });

  grant.source = source; grant.amount = reqAmount; grant.creditScore = creditScore; grant.type = type;
  grant.previousHash = grant.currentHash;
  grant.currentHash = generateHash({ source, amount: reqAmount, creditScore, type, edited: true }, grant.previousHash);

  await grant.save();
  await logAction('Applicant', 'EDITED', source, `Updated grant details (amount: ₹${reqAmount}, type: ${type})`, id);
  res.json({ message: 'Grant updated', grant });
});

app.post('/cancel-grant', async (req, res) => {
  const grant = await Grant.findOne({ id: req.body.id });
  if (!grant) return res.status(404).json({ message: 'Grant not found' });

  grant.status = 'Cancelled'; grant.disbursedAmount = 0; grant.previousHash = grant.currentHash;
  grant.currentHash = generateHash({ status: 'Cancelled', time: Date.now() }, grant.previousHash);

  await grant.save();
  await logAction('Applicant', 'CANCELLED', grant.source, `Application cancelled by applicant`, grant.id);
  res.json({ message: 'Grant cancelled', grant });
});

// ⚡ NEW ROUTE: E-Signature Processing
app.post('/sign-promissory-note', async (req, res) => {
  const { grantId, signature } = req.body;
  const grant = await Grant.findOne({ id: grantId });
  if (!grant) return res.status(404).json({ message: 'Grant not found' });

  grant.signature = signature;
  grant.signatureDate = new Date().toLocaleString();

  grant.previousHash = grant.currentHash;
  grant.currentHash = generateHash({ signature: grant.signature, date: grant.signatureDate }, grant.previousHash);

  await grant.save();
  await logAction('Applicant', 'CONTRACT SIGNED', grant.source, `Promissory note digitally signed by ${signature}.`, grantId);
  res.json(grant);
});

app.post('/add-expense', async (req, res) => {
  const { grantId, description, proofImages } = req.body;
  const grant = await Grant.findOne({ id: grantId });
  if (!grant) return res.status(404).json({ message: 'Grant not found' });
if (grant.status === 'Blocked') {
  return res.status(403).json({ message: 'INVESTIGATION HOLD: Expense uploads are disabled while this grant is under administrative review.' });
}
  for (let base64Str of proofImages) {
    const fileHash = crypto.createHash('sha256').update(base64Str).digest('hex');
    const isBlacklisted = await HashBlacklist.findOne({ hash: fileHash });
    if (isBlacklisted) {
      await logAction('Security Bot', 'BLOCKED UPLOAD', grant.source, 'Applicant attempted to upload a known fraudulent file.', grantId);
      return res.status(403).json({ message: 'SECURITY ALERT: ONE OR MORE FILES IDENTIFIED IN PREVIOUS FRAUD CASE.' });
    }
  }

  const forensicReports = await Promise.all(proofImages.map(async (base64Str) => {
    let report = { status: 'CLEAN', details: 'Metadata verified' };
    if (base64Str.startsWith('data:application/pdf')) return { status: 'CLEAN', details: '📄 PDF Document' };

    try {
      const base64Data = base64Str.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');
      const exifData = await exifr.parse(buffer);

      if (!exifData) {
        report = { status: 'FLAGGED', details: '⚠️ Metadata stripped (Possible web download)' };
      } else {
        const dateTaken = exifData.DateTimeOriginal || exifData.CreateDate;
        report.details = exifData.Make ? `📸 ${exifData.Make} ${exifData.Model}` : '📸 Unknown Device';
        if (dateTaken && new Date(dateTaken) < new Date(grant.date)) {
          report.status = 'FLAGGED';
          report.details = `🛑 Fraud Alert: Image taken on ${new Date(dateTaken).toLocaleDateString()}, before grant approval.`;
        }
      }
    } catch (err) { report = { status: 'FLAGGED', details: '⚠️ Forensic scan failed or corrupt file.' }; }
    return report;
  }));

  grant.proofs.push({ date: new Date().toLocaleDateString(), description, images: proofImages, forensics: forensicReports, finalized: false });
  grant.previousHash = grant.currentHash;
  grant.currentHash = generateHash({ proofCount: grant.proofs.length, desc: description }, grant.previousHash);

  grant.markModified('proofs');
  await grant.save();
  await logAction('Applicant', 'EXPENSE ADDED', grant.source, `Added expense: "${description}"`, grantId);
  res.json(grant);
});

app.post('/delete-expense', async (req, res) => {
  const { grantId, index } = req.body;
  const grant = await Grant.findOne({ id: grantId });
  if (!grant) return res.status(404).json({ message: 'Grant not found' });

  grant.proofs.splice(index, 1);
  grant.previousHash = grant.currentHash;
  grant.currentHash = generateHash({ proofCount: grant.proofs.length, time: Date.now() }, grant.previousHash);

  grant.markModified('proofs');
  await grant.save();
  await logAction('Applicant', 'DRAFT DELETED', grant.source, `Deleted unsubmitted expense entry.`, grantId);
  res.json({ message: 'Expense deleted', grant });
});

app.post('/submit-proof', async (req, res) => {
  const grant = await Grant.findOne({ id: req.body.grantId });
  if (!grant) return res.status(404).json({ message: 'Grant not found' });

  grant.proofs.forEach(p => { p.finalized = true; });
  grant.status = 'Awaiting Review';
  grant.previousHash = grant.currentHash;
  grant.currentHash = generateHash(grant.proofs, grant.previousHash);

  grant.markModified('proofs');
  await grant.save();
  await logAction('System', 'PROOF UPLOADED', grant.source, `Submitted ${grant.proofs.length} expense(s) for review.`, grant.id);
  res.json(grant);
});

app.post('/generate-otp', (req, res) => {
  const adminEmail = req.body.adminEmail || 'shauryacocid@gmail.com';
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  adminOtps[adminEmail] = { otp, expires: Date.now() + 5 * 60 * 1000 };

  transporter.sendMail({
    from: '"Grant Tracker" <ss.sepm.project.ss@gmail.com>',
    to: adminEmail,
    subject: `${otp} is your Grant Tracker authorization code`,
    text: `Your Grant Tracker Vault authorization code is: ${otp}\n\nThis code expires in 5 minutes.\nIf you did not request this, contact your administrator immediately.`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">

        <!-- Top accent bar -->
        <tr><td style="background:#1d4ed8;height:4px;font-size:0;">&nbsp;</td></tr>

        <!-- Logo / Brand -->
        <tr>
          <td style="padding:32px 40px 24px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#1d4ed8;letter-spacing:1.5px;text-transform:uppercase;">Grant Tracker</p>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <h2 style="margin:0 0 12px;font-size:20px;color:#0f172a;font-weight:600;">Vault Release Authorization</h2>
            <p style="margin:0 0 28px;font-size:14px;color:#475569;line-height:1.7;">
              You requested to authorize a final vault disbursement from your admin session. Use the code below to complete the action. <strong>Do not share this code with anyone.</strong>
            </p>

            <!-- OTP Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:28px 20px;">
                  <p style="margin:0 0 8px;font-size:11px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Your one-time code</p>
                  <p style="margin:0;font-size:40px;font-weight:700;letter-spacing:16px;color:#1d4ed8;font-family:'Courier New',monospace;">${otp}</p>
                  <p style="margin:12px 0 0;font-size:12px;color:#f59e0b;font-weight:600;">⏱ &nbsp;Expires in 5 minutes</p>
                </td>
              </tr>
            </table>

            <!-- Meta row -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <tr style="background:#f8fafc;">
                <td style="padding:12px 16px;border-right:1px solid #e2e8f0;">
                  <p style="margin:0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Action</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#0f172a;font-weight:600;">Full Disbursement</p>
                </td>
                <td style="padding:12px 16px;border-right:1px solid #e2e8f0;">
                  <p style="margin:0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Requested by</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#0f172a;font-weight:600;">Admin Session</p>
                </td>
                <td style="padding:12px 16px;">
                  <p style="margin:0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Time (IST)</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#0f172a;font-weight:600;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                </td>
              </tr>
            </table>

            <!-- Warning -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;">
                  <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
                    <strong>⚠ Didn't request this?</strong> Your account may be at risk. Contact your system administrator immediately and do not enter this code.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr><td style="padding:0 40px;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>
        <tr>
          <td style="padding:20px 40px;">
            <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.8;">
              This is an automated security email from <strong>Grant Tracker Vault System</strong>. Do not reply.<br>
              This code is single-use and will expire automatically after 5 minutes.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
    `
  })
  .then(() => res.json({ message: 'OTP Sent successfully' }))
  .catch(err => {
    console.error("🔴 NODEMAILER CRASH REASON:", err.message);
    console.error("🔴 FULL ERROR:", err);
    res.status(500).json({ message: err.message });
  });
});

app.post('/add-private-note', async (req, res) => {
  const { grantId, text, admin } = req.body;
  const grant = await Grant.findOne({ id: grantId });
  if (!grant) return res.status(404).json({ message: 'Grant not found' });

  if (!grant.privateNotes) grant.privateNotes = [];
  grant.privateNotes.push({ text, admin, timestamp: new Date().toLocaleString() });

  grant.markModified('privateNotes');
  await grant.save();
  await logAction(admin, 'PRIVATE NOTE ADDED', grant.source, 'Added internal investigation note.', grantId);
  res.json(grant);
});

app.post('/update-status', async (req, res) => {
  const { id, status, actionBy, note, otp, adminEmail, requireSignature } = req.body;
  const grant = await Grant.findOne({ id });
  if (!grant) return res.status(404).json({ message: 'Grant not found' });

  const oldStatus = grant.status;

  if (status === 'Blocked') {
  const email = grant.userId;
  const freezeReason = req.body.freezeReason || 'Suspicious activity detected';

  let strikeRec = await Strike.findOne({ userId: email });
  if (!strikeRec) strikeRec = new Strike({ userId: email, count: 0 });
  strikeRec.count += 1;
  await strikeRec.save();

  const isBlacklisted = strikeRec.count >= 3;

  // Auto-generate private note
  if (!grant.privateNotes) grant.privateNotes = [];
  grant.privateNotes.push({
    text: `🔒 FREEZE INITIATED — Reason: "${freezeReason}" | Strike: ${strikeRec.count}/3 | Admin: ${actionBy} | Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
    admin: actionBy || 'System',
    timestamp: new Date().toLocaleString()
  });
  grant.markModified('privateNotes');

  grant.status = 'Blocked'; if (note) grant.note = note;
  grant.previousHash = grant.currentHash;
  grant.currentHash = generateHash({ status: 'Blocked', note: grant.note, time: Date.now() }, grant.previousHash);
  await grant.save();

  if (email) {
    transporter.sendMail({
      from: '"Grant Tracker" <ss.sepm.project.ss@gmail.com>',
      to: email,
      subject: `Action Required: Your Grant Application is Under Review — Case #${grant.id}`,
      text: `Dear ${grant.source},\n\nYour grant application (Case #${grant.id}) has been placed under administrative review.\n\nReason: ${freezeReason}\n\nYou cannot submit new applications until this investigation is resolved. Please contact your institution for assistance.\n\nStrike Record: ${strikeRec.count} of 3.\n\nGrant Tracker Compliance Team`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">

        <tr><td style="background:#dc2626;height:4px;font-size:0;">&nbsp;</td></tr>

        <tr>
          <td style="padding:32px 40px 20px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#dc2626;letter-spacing:1.5px;text-transform:uppercase;">Grant Tracker — Compliance</p>
          </td>
        </tr>

        <tr><td style="padding:0 40px;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>

        <tr>
          <td style="padding:32px 40px;">
            <h2 style="margin:0 0 6px;font-size:20px;color:#0f172a;font-weight:600;">Your Application is Under Review</h2>
            <p style="margin:0 0 24px;font-size:13px;color:#64748b;">Case Reference: <strong>#${grant.id}</strong></p>

            <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.7;">
              Dear <strong>${grant.source}</strong>,<br><br>
              Your grant application has been placed under administrative review by our compliance team. During this period, your account is temporarily restricted from submitting new applications.
            </p>

            <!-- Reason Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:0 8px 8px 0;padding:16px 18px;">
                  <p style="margin:0 0 4px;font-size:10px;color:#991b1b;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Reason for Review</p>
                  <p style="margin:0;font-size:14px;color:#7f1d1d;font-weight:600;">${freezeReason}</p>
                </td>
              </tr>
            </table>

            <!-- Case Details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f8fafc;">
                <td style="padding:12px 16px;border-right:1px solid #e2e8f0;">
                  <p style="margin:0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Case ID</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#0f172a;font-weight:600;">#${grant.id}</p>
                </td>
                <td style="padding:12px 16px;border-right:1px solid #e2e8f0;">
                  <p style="margin:0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Strike Record</p>
                  <p style="margin:4px 0 0;font-size:13px;color:${strikeRec.count >= 3 ? '#dc2626' : '#0f172a'};font-weight:600;">${strikeRec.count} of 3 ${strikeRec.count >= 3 ? '⚠ Final Warning' : ''}</p>
                </td>
                <td style="padding:12px 16px;">
                  <p style="margin:0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Initiated</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#0f172a;font-weight:600;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                </td>
              </tr>
            </table>

            <!-- What to do -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
              <tr>
                <td style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;">
                  <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#92400e;">What happens next?</p>
                  <p style="margin:0;font-size:13px;color:#78350f;line-height:1.7;">
                    Our compliance team will review your submitted documents. You will be notified once the investigation is resolved. If you believe this is an error, please contact your institutional representative with your Case ID.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr><td style="padding:0 40px;"><div style="height:1px;background:#e2e8f0;"></div></td></tr>
        <tr>
          <td style="padding:20px 40px;">
            <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.8;">
              This is an automated compliance notice from <strong>Grant Tracker</strong>. Do not reply to this email.<br>
              ${isBlacklisted ? '<strong style="color:#dc2626;">⚠ Warning: Reaching 3 strikes will result in permanent blacklisting from the platform.</strong>' : ''}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
      `
    }).catch(err => console.error('Failed to send freeze email:', err));
  }

  await logAction(actionBy, 'FLAGGED FRAUD', grant.source, `Account frozen. Reason: "${freezeReason}". Strike ${strikeRec.count}/3. ${isBlacklisted ? 'ENTITY BLACKLISTED.' : ''}`, id);
  return res.json({ message: `Account Frozen. User has ${strikeRec.count}/3 Strikes.`, grant });
}

  if (status === 'Rejected' && oldStatus === 'Blocked') {
    let addedHashes = 0;
    grant.proofs.forEach(async p => {
      if (p.images) p.images.forEach(async imgStr => {
        const h = crypto.createHash('sha256').update(imgStr).digest('hex');
        await HashBlacklist.updateOne({ hash: h }, { hash: h }, { upsert: true });
        addedHashes++;
      });
    });
    if (addedHashes > 0) {
      await logAction('Security Bot', 'BLACKLISTED FILES', grant.source, `Added compromised proofs to global hash blacklist.`, id);
    }
  }

  if (oldStatus === 'Blocked' && status === 'Awaiting Review') {
    await Strike.updateOne({ userId: grant.userId, count: { $gt: 0 } }, { $inc: { count: -1 } });
    await logAction(actionBy, 'FREEZE LIFTED', grant.source, `Investigation cleared. Strike removed.`, id);
  }

  if (status === 'Fully Disbursed') {
    const validOtpData = adminOtps[adminEmail];
    if (!validOtpData) return res.status(401).json({ message: 'SECURITY ALERT: No OTP generated or OTP has expired.' });
    if (Date.now() > validOtpData.expires) { delete adminOtps[adminEmail]; return res.status(401).json({ message: 'SECURITY ALERT: OTP has expired. Request a new one.' }); }
    if (validOtpData.otp !== otp) return res.status(401).json({ message: 'SECURITY ALERT: Incorrect OTP provided. Vault remains locked.' });

    delete adminOtps[adminEmail];
    grant.disbursedAmount = grant.amount;
  }

  grant.status = status; grant.actionBy = actionBy; if (note !== undefined) grant.note = note;

  // Save the signature requirement flag during Phase 1
  if (status === 'Phase 1 Approved') {
    grant.disbursedAmount = grant.amount * 0.35;
    if (requireSignature !== undefined) grant.requireSignature = requireSignature;

    if (grant.userId) {
      transporter.sendMail({
        from: '"Grant Administrator" <ss.sepm.project.ss@gmail.com>',
        to: grant.userId,
        subject: '🎉 Grant Phase 1 Approved - Milestone Funds Released',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 25px; color: #1a2540; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <h2 style="color: #10b981; margin-top: 0; border-bottom: 2px solid #10b981; padding-bottom: 10px;">Phase 1 Approved!</h2>
            <p style="font-size: 16px;">Hello <b>${grant.source}</b>,</p>
            <p style="font-size: 15px; line-height: 1.5;">Your grant application for the <b>${grant.type}</b> category has been successfully evaluated and Phase 1 is approved.</p>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 5px solid #3b82f6; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
              <h3 style="margin: 0 0 10px 0; color: #0f172a;">Funds Released</h3>
              <p style="margin: 0; font-size: 20px; font-weight: bold; color: #3b82f6;">₹${grant.disbursedAmount.toLocaleString()}</p>
            </div>
            <p style="font-size: 15px;"><b>Next Steps:</b> Please log in to access your funds and upload digital forensic proofs.</p>
          </div>`
      }).catch(err => console.error(err));
    }
  } else if (status === 'Rejected') {
    grant.disbursedAmount = 0;
  }

  grant.previousHash = grant.currentHash;
  grant.currentHash = generateHash({ status, disbursed: grant.disbursedAmount, note: grant.note, reqSig: grant.requireSignature, time: Date.now() }, grant.previousHash);

  await grant.save();
  await logAction(actionBy, status.toUpperCase(), grant.source, `Changed from ${oldStatus} to ${status}`, id);
  res.json({ message: 'Status Updated', grant });
});

app.post('/verify-ledger', async (req, res) => {
  const { grantId } = req.body;
  const grant = await Grant.findOne({ id: grantId });
  if (!grant) return res.status(404).json({ message: 'Grant not found' });
  const ok = grant.currentHash.length === 64;
  res.json(ok ? { verified: true, message: 'Cryptographic Hash Chain Intact. Data is authentic.' } : { verified: false, message: 'DATA COMPROMISE DETECTED.' });
});

app.post('/submit-impact', async (req, res) => {
  const { grantId, outcome, metric, link } = req.body;
  const grant = await Grant.findOne({ id: grantId });
  grant.impact = { date: new Date().toLocaleDateString(), outcome, metric: parseInt(metric), link };
  grant.status = 'Evaluated';
  grant.previousHash = grant.currentHash;
  grant.currentHash = generateHash(grant.impact, grant.previousHash);

  grant.markModified('impact');
  await grant.save();
  await logAction('System', 'IMPACT LOGGED', grant.source, `Final impact evaluated.`, grantId);
  res.json(grant);
});

// ── SERVER STARTUP ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`❌ ERROR: Port ${PORT} is already in use.`);
  else console.error('❌ SERVER ERROR:', err);
});