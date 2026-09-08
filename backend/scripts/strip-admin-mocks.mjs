import fs from 'fs';
import { resolve } from 'path';

const filePath = resolve('src/routes/admin-panel.routes.js');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Remove import of mockAdminDb
code = code.replace(/import\s*\{\s*mockAdminDb[^\}]*\}\s*from\s*'\.\.\/services\/admin\.mock\.service\.js';\r?\n?/, '');

// 2. Remove mock block in /admin/dashboard
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return\s+res\.json\(getMockAdminDashboard\(range\.range\)\);\s*\}/, '');

// 3. Remove mock block in /admin/users
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*let filtered = \[\.\.\.mockAdminDb\.users\];[\s\S]*?return res\.json\(\{\s*users:\s*filtered,\s*pagination:\s*paginationPayload\(page,\s*pageSize,\s*filtered\.length\),\s*\}\);\s*\}/, '');

// 4. Remove mock block in /admin/subscriptions
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return res\.json\(\{\s*subscriptions:\s*mockAdminDb\.subscriptions,\s*pagination:\s*paginationPayload\(page,\s*pageSize,\s*mockAdminDb\.subscriptions\.length\),\s*\}\);\s*\}/, '');

// 5. Remove mock block in /admin/subscriptions/:id
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*const sub = mockAdminDb\.subscriptions\.find[\s\S]*?invoices:\s*mockAdminDb\.payments,\s*\}\);\s*\}/, '');

// 6. Remove mock block in /admin/subscriptions/:id/cancel
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return res\.json\(\{\s*subscription:\s*\{\s*id:\s*req\.params\.id,\s*status:\s*'cancelled',\s*auto_renew:\s*false\s*\}\s*\}\);\s*\}/, '');

// 7. Remove mock block in /admin/plans
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return res\.json\(\{\s*plans:\s*mockAdminDb\.plans\.map[\s\S]*?\}\);\s*\}/, '');

// 8. Remove mock block in /admin/plans/:id
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return res\.json\(\{\s*plan:\s*\{\s*id:\s*req\.params\.id,\s*\.\.\.req\.body\s*\}\s*\}\);\s*\}/, '');

// 9. Remove mock block in /admin/payments
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return res\.json\(\{\s*payments:\s*mockAdminDb\.payments\.map[\s\S]*?\}\);\s*\}/, '');

// 10. Remove mock block in /admin/payments/:id
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*const p = mockAdminDb\.payments\.find[\s\S]*?return res\.json\(\{\s*payment:\s*\{[\s\S]*?\}\s*\}\);\s*\}/, '');

// 11. Remove mock block in /admin/leads
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return res\.json\(\{\s*leads:\s*mockAdminDb\.crmLeads\.map[\s\S]*?\}\);\s*\}/, '');

// 12. Remove mock block in /admin/leads/:id
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*const l = mockAdminDb\.crmLeads\.find[\s\S]*?return res\.json\(\{[\s\S]*?\}\);\s*\}/, '');

// 13. Remove mock block in patch /admin/leads/:id
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return res\.json\(\{\s*lead:\s*\{\s*id:\s*req\.params\.id,\s*\.\.\.req\.body\s*\}\s*\}\);\s*\}/, '');

// 14. Remove mock block in /admin/reports
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return res\.json\(\{\s*users:\s*\{\s*total:\s*mockAdminDb\.users\.length[\s\S]*?\}\);\s*\}/, '');

// 15. Remove mock block in /admin/audit-logs
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return res\.json\(\{\s*logs:\s*mockAdminDb\.auditLogs,[\s\S]*?\}\);\s*\}/, '');

// 16. Remove mock block in /admin/users/:id/private-data
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return res\.json\(\{\s*notes:\s*\[\],\s*tags:[\s\S]*?\}\);\s*\}/, '');

// 17. Remove mock block in post /admin/users/:id/notes
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return res\.status\(201\)\.json\(\{\s*note:\s*\{\s*id:\s*'note_'[\s\S]*?\}\);\s*\}/, '');

// 18. Remove mock block in delete /admin/users/:userId/notes/:noteId
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return res\.json\(\{\s*success:\s*true\s*\}\);\s*\}/, '');

// 19. Remove mock block in put /admin/users/:id/tags
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return res\.json\(\{\s*tags:\s*\(req\.body\.tags[\s\S]*?\}\);\s*\}/, '');

// 20. Remove mock block in /admin/revenue-analytics
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return res\.json\(\{\s*range:\s*range\.range,[\s\S]*?trialToPaidConversion:\s*42\.5,\s*\}\);\s*\}/, '');

// 21. Remove mock block in /admin/notifications
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return res\.json\(\{\s*notifications:\s*mockAdminDb\.notifications,[\s\S]*?\}\);\s*\}/, '');

// 22. Remove mock block in patch /admin/notifications/:id/read
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return res\.json\(\{\s*notification:\s*\{\s*id:\s*req\.params\.id,\s*is_read:\s*true\s*\}\s*\}\);\s*\}/, '');

// 23. Remove mock blocks in csv exports
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return sendCsv\(res,\s*'users\.csv'[\s\S]*?mockAdminDb\.users\);\s*\}/, '');
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return sendCsv\(res,\s*'payments\.csv'[\s\S]*?mockAdminDb\.payments\);\s*\}/, '');
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return sendCsv\(res,\s*'subscriptions\.csv'[\s\S]*?mockAdminDb\.subscriptions\);\s*\}/, '');

// 24. Remove mock block in /admin/algo/overview
code = code.replace(/if\s*\(!process\.env\.DATABASE_URL\)\s*\{\s*return res\.json\(\{\s*overview:[\s\S]*?risks:\s*\[\],\s*\}\);\s*\}/, '');

fs.writeFileSync(filePath, code, 'utf8');
console.log('Stripped mock blocks from admin-panel.routes.js');
