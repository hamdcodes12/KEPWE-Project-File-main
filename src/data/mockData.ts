import { CRMLead, FollowupCadence, CustomerTask, CustomerDocument } from '../types';

export const MOCK_CRM_LEADS: CRMLead[] = [
  {
    id: 'lead-101',
    companyName: 'ABC Technologies Pvt Ltd',
    contactName: 'Your name',
    mobile: '+91 933477XXXX',
    email: 'naviXXXX@gmail.com',
    cin: 'U72200MH2026PTC384920',
    gstin: '27AABCA1234H1Z5',
    incorporationDate: '05 Aug 2026',
    industry: 'IT Services',
    state: 'Maharashtra',
    gstStatus: 'Active',
    leadScore: 'HOT',
    leadSource: 'New Incorporation Database',
    salesActivity: ['Call 1 — No Answer', 'Call 2 — Interested', 'Call 3 — Demo Scheduled'],
    assignedExecutive: 'Agent 1 (Vikram)',
    status: 'Interested'
  },
  {
    id: 'lead-102',
    companyName: 'Apex Global Logistics LLP',
    contactName: 'Your name',
    mobile: '+91 98111 XXXXX',
    email: 'naviXXXX@gmail.com',
    cin: 'AAB-9821',
    gstin: '07AAFFA9988G1Z2',
    incorporationDate: '01 Aug 2026',
    industry: 'Exporters / Freight',
    state: 'Delhi',
    gstStatus: 'Active',
    leadScore: 'HOT',
    leadSource: 'GST Filing Portal Inbound',
    salesActivity: ['Call 1 — Connected', 'Compliance Check Sent'],
    assignedExecutive: 'Agent 3 (Ananya)',
    status: 'Connected'
  },
  {
    id: 'lead-103',
    companyName: 'Zenith Retail & E-Commerce',
    contactName: 'Your name',
    mobile: '+91 99000 XXXXX',
    email: 'naviXXXX@gmail.com',
    cin: 'U52100GJ2026PTC443102',
    gstin: '24AAACZ4321J1Z9',
    incorporationDate: '28 Jul 2026',
    industry: 'E-commerce',
    state: 'Gujarat',
    gstStatus: 'Active',
    leadScore: 'WARM',
    leadSource: 'Free Compliance Check Form',
    salesActivity: ['Call 1 — Interested in GST & Payroll'],
    assignedExecutive: 'Agent 2 (Rohan)',
    status: 'Called'
  },
  {
    id: 'lead-104',
    companyName: 'Sunrise Food & Spices',
    contactName: 'Your name',
    mobile: '+91 97777 XXXXX',
    email: 'naviXXXX@gmail.com',
    cin: 'U15100KA2026PTC112233',
    gstin: 'Pending Registration',
    incorporationDate: '10 Aug 2026',
    industry: 'Restaurants & Food',
    state: 'Karnataka',
    gstStatus: 'Pending',
    leadScore: 'COLD',
    leadSource: 'MCA Incorporation Feed',
    salesActivity: ['Lead Imported'],
    assignedExecutive: 'Unassigned',
    status: 'New'
  }
];

export const MOCK_FOLLOWUPS: FollowupCadence[] = [
  { day: 'Day 0', channel: 'WhatsApp/SMS', message: 'Your free compliance assessment is ready.' },
  { day: 'Day 1', channel: 'Email', message: '5 things your newly incorporated company should complete.' },
  { day: 'Day 3', channel: 'WhatsApp', message: 'Would you like us to handle your monthly GST and accounting?' },
  { day: 'Day 7', channel: 'Offer', message: 'Start your compliance plan this month with 10% onboarding discount.' },
  { day: 'Day 15', channel: 'Follow-up', message: 'Standard re-engagement touch for MCA annual filing deadlines.' },
  { day: 'Day 30', channel: 'Campaign', message: 'Reactivation campaign: Virtual CFO & payroll audit offer.' }
];

export const MOCK_CUSTOMER_TASKS: CustomerTask[] = [
  { id: 'task-1', category: 'GST', title: 'GSTR-1 Sales Return Filing', dueDate: '12 Aug 2026', status: 'Upcoming' },
  { id: 'task-2', category: 'GST', title: 'GSTR-3B Summary Return Filing', dueDate: '20 Aug 2026', status: 'Upcoming' },
  { id: 'task-3', category: 'TDS', title: 'Monthly TDS Payment Challan', dueDate: '07 Aug 2026', status: 'Completed' },
  { id: 'task-4', category: 'MCA', title: 'DIR-3 KYC Director Annual Verification', dueDate: '30 Sep 2026', status: 'In Progress' },
  { id: 'task-5', category: 'Payroll', title: 'Monthly Salary & PF/ESI Processing', dueDate: '31 Aug 2026', status: 'Completed' },
];

export const MOCK_CUSTOMER_DOCUMENTS: CustomerDocument[] = [
  { id: 'doc-1', name: 'Certificate_of_Incorporation.pdf', category: 'Company Documents', uploadDate: '06 Aug 2026', size: '1.2 MB', status: 'Verified' },
  { id: 'doc-2', name: 'Company_PAN_TAN.pdf', category: 'Company Documents', uploadDate: '06 Aug 2026', size: '680 KB', status: 'Verified' },
  { id: 'doc-3', name: 'July_2026_Bank_Statement.pdf', category: 'Bank Statements', uploadDate: '08 Aug 2026', size: '3.4 MB', status: 'Processing' },
  { id: 'doc-4', name: 'July_Sales_Invoices.zip', category: 'Sales', uploadDate: '09 Aug 2026', size: '5.1 MB', status: 'Uploaded' },
];
