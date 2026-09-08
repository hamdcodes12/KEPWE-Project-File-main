---
name: Provider-backed financial surfaces
description: Quant UI should distinguish unavailable provider data from zero values until an approved broker adapter is active.
---

Provider-dependent financial surfaces should remain explicit about disconnected, pending, error, and empty states; never imply a live account connection or invent market values before an approved broker adapter is wired.

**Why:** Trading balances, prices, fills, and performance are trust-critical. A polished placeholder that looks like live data can lead users to make decisions on false information.

**How to apply:** When adding a broker integration, replace the UI states with verified API-backed loading and error handling, and keep the no-provider state available for first-run and disconnected sessions.

The same boundary applies to KEPWE customer workspaces: company, compliance, document, payroll, and support indicators must come from the authenticated company record or remain explicitly empty/setup states.

**Why:** Business customers can reasonably interpret service-status cards and financial-looking metrics as operational facts, so static success claims are as misleading as fabricated market data.

**How to apply:** Scope every Ledger read/write through the verified session and company membership; show setup guidance for new accounts and derive status copy from persisted tasks, documents, and tickets.