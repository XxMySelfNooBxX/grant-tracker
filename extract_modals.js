const fs = require('fs');
const path = require('path');

const adminDashboardPath = path.join(__dirname, 'client/src/components/AdminDashboard.js');
const modalsPath = path.join(__dirname, 'client/src/components/Admin/AdminModals.js');

let lines = fs.readFileSync(adminDashboardPath, 'utf8').split('\n');

function getLineRange(startMarker, endMarker) {
    let start = -1;
    let end = -1;
    for(let i=0; i<lines.length; i++){
        if(start === -1 && lines[i].includes(startMarker)) start = i;
        if(start !== -1 && i > start && lines[i].includes(endMarker)) {
            end = i;
            break;
        }
    }
    return { start, end };
}

const appModal = getLineRange('{viewingApplication && (() => {', '        })()}');
const rejectModal = getLineRange('{rejectTarget && (', '        )}');
const historyModal = getLineRange('{historyApplicant && (() => {', '        })()}');
const grantModal = getLineRange('{viewingGrant && (', '          </>');
const impactModal = getLineRange('{viewingImpact && (() => {', '          </motion.div>');

const newModalsContent = `import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';
import {
  FileText, XCircle, User, Clock, FileSignature, ShieldCheck, CheckCircle,
  ShieldAlert, Fingerprint, ScanLine, Receipt, Eye, Building2, AlertTriangle, Rocket
} from 'lucide-react';
import { SpringTooltip, CyberText } from './AdminUIComponents';

export const ApplicationModal = ({
  viewingApplication, setViewingApplication, getRisk, daysSince, STANDARD_TYPES,
  setHistoryApplicant, updateStatus, setRejectTarget, setRejectNote
}) => {
  if (!viewingApplication) return null;
  const g = viewingApplication;
  const risk = getRisk(g.creditScore);
  const wait = daysSince(g.date);
  const disbPct = g.amount > 0 ? Math.round(((g.disbursedAmount || 0) / g.amount) * 100) : 0;
  const CIRC_R = 28;
  const CIRC = 2 * Math.PI * CIRC_R;
  const scoreNorm = Math.min(100, Math.max(0, ((parseInt(g.creditScore) || 300) - 300) / 600 * 100));
  const creditColor = parseInt(g.creditScore) >= 750 ? 'var(--accent-green)' : parseInt(g.creditScore) >= 600 ? 'var(--accent-yellow)' : 'var(--accent-red)';

` + lines.slice(appModal.start + 9, appModal.end).join('\n') + `
};

export const RejectModal = ({
  rejectTarget, setRejectTarget, STANDARD_TYPES, rejectNote, setRejectNote, updateStatus
}) => {
  if(!rejectTarget) return null;
  return (
` + lines.slice(rejectModal.start + 1, rejectModal.end).join('\n') + `
  );
};

export const HistoryModal = ({
  historyApplicant, setHistoryApplicant, getApplicantGrants, STANDARD_TYPES, getRisk
}) => {
  if(!historyApplicant) return null;
  const ag = getApplicantGrants(historyApplicant);
  const totalReq = ag.reduce((s, g) => s + g.amount, 0);
  const totalDisb = ag.reduce((s, g) => s + (g.disbursedAmount || 0), 0);
  const completed = ag.filter((g) => g.status === 'Evaluated' || g.status === 'Fully Disbursed').length;
  const rejected = ag.filter((g) => g.status === 'Rejected').length;

` + lines.slice(historyModal.start + 7, historyModal.end).join('\n') + `
};

export const GrantModal = ({
  viewingGrant, setViewingGrant, xrayMode, setXrayMode, STANDARD_TYPES, getRisk,
  privateNoteText, setPrivateNoteText, handleAddPrivateNote, verifyVendor, verifyingVendor, vendorStatus, setEnlargedImage
}) => {
  if(!viewingGrant) return null;
  return (
    <>
` + lines.slice(grantModal.start + 2, grantModal.end).join('\n') + `
    </>
  );
};

export const ImpactModal = ({
  viewingImpact, setViewingImpact
}) => {
  if(!viewingImpact) return null;
  const metric = viewingImpact.impact?.metric || 0;
  const amt = viewingImpact.amount || 1;
  const efficiency = (metric / (amt / 1000)).toFixed(1);

` + lines.slice(impactModal.start + 5, impactModal.end + 1).join('\n') + `
};
`;

fs.writeFileSync(modalsPath, newModalsContent, 'utf8');

function spliceRange(s, e, content) {
    if (s !== -1 && e !== -1) {
        lines.splice(s, e - s + 1, content);
    }
}

spliceRange(impactModal.start, impactModal.end, "{viewingImpact && <ImpactModal viewingImpact={viewingImpact} setViewingImpact={setViewingImpact} />}");

spliceRange(grantModal.start, grantModal.end, "{viewingGrant && <GrantModal viewingGrant={viewingGrant} setViewingGrant={setViewingGrant} xrayMode={xrayMode} setXrayMode={setXrayMode} STANDARD_TYPES={STANDARD_TYPES} getRisk={getRisk} privateNoteText={privateNoteText} setPrivateNoteText={setPrivateNoteText} handleAddPrivateNote={handleAddPrivateNote} verifyVendor={verifyVendor} verifyingVendor={verifyingVendor} vendorStatus={vendorStatus} setEnlargedImage={setEnlargedImage} />}");

spliceRange(historyModal.start, historyModal.end, "{historyApplicant && <HistoryModal historyApplicant={historyApplicant} setHistoryApplicant={setHistoryApplicant} getApplicantGrants={getApplicantGrants} STANDARD_TYPES={STANDARD_TYPES} getRisk={getRisk} />}");

spliceRange(rejectModal.start, rejectModal.end, "{rejectTarget && <RejectModal rejectTarget={rejectTarget} setRejectTarget={setRejectTarget} STANDARD_TYPES={STANDARD_TYPES} rejectNote={rejectNote} setRejectNote={setRejectNote} updateStatus={updateStatus} />}");

spliceRange(appModal.start, appModal.end, "{viewingApplication && <ApplicationModal viewingApplication={viewingApplication} setViewingApplication={setViewingApplication} getRisk={getRisk} daysSince={daysSince} STANDARD_TYPES={STANDARD_TYPES} setHistoryApplicant={setHistoryApplicant} updateStatus={updateStatus} setRejectTarget={setRejectTarget} setRejectNote={setRejectNote} />}");

const finalSource = lines.join('\n').replace("import './AdminDashboard.css';", "import './AdminDashboard.css';\nimport { ApplicationModal, RejectModal, HistoryModal, GrantModal, ImpactModal } from './Admin/AdminModals';");
fs.writeFileSync(adminDashboardPath, finalSource, 'utf8');

console.log('Extraction complete!');
