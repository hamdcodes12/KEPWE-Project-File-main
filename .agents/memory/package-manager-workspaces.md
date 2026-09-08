---
name: Package manager behavior in nested workspaces
description: A Replit package install helper may target the repository root even when dependencies belong to a nested package.
---

When an imported project has a nested package manifest, verify the install location after using the package helper; install nested dependencies from that package directory so root manifests stay scoped.

**Why:** The helper can add nested-service dependencies to the root package and rewrite the root lockfile when invoked from a monorepo.

**How to apply:** Check both package manifests and `node_modules` locations after installation, then restore any accidental root manifest changes before configuring workflows.