import React, { useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Clock, ShieldAlert } from 'lucide-react';

const API = 'http://localhost:3001';

export default function KYCPending({ currentUserEmail, onApproved, onRejected, rejectionNote, idType, handleLogout }) {
  useEffect(() => {
  const check = async () => {
    try {
      const res = await axios.get(`${API}/verification-status/${currentUserEmail}`);
      if (res.data.status === 'approved') onApproved();
      if (res.data.status === 'rejected') onRejected(res.data.rejectionNote);
    } catch {}
  };
  check(); // check immediately on mount too
  const interval = setInterval(check, 5000);
  return () => clearInterval(interval);
}, [currentUserEmail]); // only currentUserEmail — callbacks intentionally excluded

  const isRejected = !!rejectionNote;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif', padding: '24px' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', maxWidth: '440px', width: '100%' }}>

        {/* Animated icon */}
        <motion.div
          animate={isRejected ? {} : { scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 28px',
            background: isRejected ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)',
            border: `2px solid ${isRejected ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isRejected
              ? '0 0 30px rgba(239,68,68,0.15)'
              : '0 0 30px rgba(251,191,36,0.15)' }}>
          {isRejected
            ? <ShieldAlert size={36} color="var(--accent-red)" />
            : <Clock size={36} color="var(--accent-yellow)" />}
        </motion.div>

        <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '26px',
          color: 'var(--text-heading)', fontWeight: '400', margin: '0 0 12px' }}>
          {isRejected ? 'Verification Rejected' : 'Verification Pending'}
        </h1>

        <p style={{ color: 'var(--text-muted)', fontSize: '14px',
          lineHeight: '1.7', margin: '0 0 24px' }}>
          {isRejected
            ? 'Your ID verification was not approved. Please review the note below and resubmit.'
            : `Your ${idType || 'ID'} has been submitted and is currently under review by our team. This page will automatically unlock once approved.`}
        </p>

        {isRejected && rejectionNote && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '12px', padding: '16px 20px', marginBottom: '28px',
              textAlign: 'left' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-red)',
              textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
              Reason
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              {rejectionNote}
            </div>
          </motion.div>
        )}

        {!isRejected && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '10px', color: 'var(--text-muted)', fontSize: '13px' }}>
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ width: '8px', height: '8px', borderRadius: '50%',
                background: 'var(--accent-yellow)',
                boxShadow: '0 0 8px var(--accent-yellow)' }} />
            Checking for updates every 5 seconds...
          </div>
        )}

        {isRejected && (
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => onRejected(null)}
            style={{ padding: '13px 32px', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg,#2563eb,#4f46e5)',
              color: 'white', fontSize: '15px', fontWeight: '700',
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              boxShadow: '0 4px 20px rgba(37,99,235,0.35)' }}>
            Resubmit ID
          </motion.button>
        )}
        <button
  onClick={handleLogout}
  style={{
    position: 'absolute', top: '24px', right: '24px', zIndex: 10,
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#ef4444', padding: '8px 16px', borderRadius: '8px',
    fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s',
  }}
>
  Logout
</button>
      </motion.div>
    </div>
  );
}