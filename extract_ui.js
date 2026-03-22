const fs = require('fs');
const path = require('path');

const adminDashboardPath = path.join(__dirname, 'client/src/components/AdminDashboard.js');
const uiComponentsPath = path.join(__dirname, 'client/src/components/Admin/AdminUIComponents.js');

let lines = fs.readFileSync(adminDashboardPath, 'utf8').split('\n');

// Lines 40 to 532 are the UI components (1-indexed). So lines[39] to lines[531]
const uiLines = lines.slice(39, 531);

const imports = `import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Search } from 'lucide-react';

`;

const exportsList = `
export {
  triggerEdgeGlow,
  SpringTooltip,
  Sparkline,
  CommandPalette,
  SkeletonCard,
  SkeletonRow,
  FramerBarChart,
  FramerDonutChart,
  CyberText,
  TiltCard,
  MagneticButton
};
`;

const newUIContent = imports + uiLines.join('\n') + exportsList;
fs.writeFileSync(uiComponentsPath, newUIContent, 'utf8');

// Replace those lines with an import statement
const newAdminDashboardLines = [
  ...lines.slice(0, 39),
  `import {
  triggerEdgeGlow,
  SpringTooltip,
  Sparkline,
  CommandPalette,
  SkeletonCard,
  SkeletonRow,
  FramerBarChart,
  FramerDonutChart,
  CyberText,
  TiltCard,
  MagneticButton
} from './Admin/AdminUIComponents';`,
  ...lines.slice(531)
];

fs.writeFileSync(adminDashboardPath, newAdminDashboardLines.join('\n'), 'utf8');
console.log('Successfully extracted components.');
