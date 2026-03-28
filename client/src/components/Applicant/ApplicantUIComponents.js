// ============================================================================
// BLOCK 1: IMPORTS
// ============================================================================
import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Clock, ShieldAlert } from 'lucide-react';

// ============================================================================
// BLOCK 2: GRANT LIFECYCLE STEPPER COMPONENT
// ============================================================================
export const LifecycleStepper = ({ status, date }) => {
    const steps = [
        { label: 'Applied', sub: date },
        { label: 'Phase 1', sub: '35% Unlocked' },
        { label: 'Review', sub: 'Proofs Sent' },
        { label: 'Disbursed', sub: '100% Cleared' }
    ];

    let activeIndex = 0;
    let isError = false;
    let errorLabel = '';

    if (status === 'Phase 1 Approved') activeIndex = 1;
    else if (status === 'Awaiting Review') activeIndex = 2;
    else if (status === 'Fully Disbursed' || status === 'Evaluated') activeIndex = 3;
    else if (status === 'Rejected') { isError = true; errorLabel = 'Application Rejected'; }
    else if (status === 'Blocked') { isError = true; errorLabel = 'Security Hold'; }

    return (
        <div className="lifecycle-stepper-container">
            <div className="stepper-track-bg"></div>

            {!isError && (
                <motion.div
                    className="stepper-track-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${(activeIndex / (steps.length - 1)) * 100}%` }}
                    transition={{ duration: 1, ease: "easeInOut", delay: 0.2 }}
                />
            )}

            {isError ? (
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '12px', color: 'var(--accent-red)', padding: '10px 0' }}>
                    <ShieldAlert size={24} />
                    <span style={{ fontFamily: 'DM Serif Display', fontSize: '20px' }}>{errorLabel}</span>
                </div>
            ) : (
                steps.map((step, idx) => {
                    const isCompleted = idx < activeIndex;
                    const isActive = idx === activeIndex;

                    let color = 'var(--text-muted)';
                    if (isCompleted) color = 'var(--accent-green)';
                    if (isActive) color = 'var(--accent-blue)';

                    return (
                        <div key={step.label} className={`stepper-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                            <div className="step-icon-wrapper" style={{ backgroundColor: 'var(--bg-base)', color }}>
                                {isCompleted ? (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}><CheckCircle2 size={22} /></motion.div>
                                ) : isActive ? (
                                    <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }} transition={{ duration: 2, repeat: Infinity }}><Clock size={22} /></motion.div>
                                ) : (
                                    <Circle size={20} strokeWidth={2} />
                                )}
                            </div>
                            <div className="step-text-container">
                                <div className="step-label" style={{ color: isActive ? 'var(--text-primary)' : color }}>{step.label}</div>
                                <div className="step-sub">{step.sub}</div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
};