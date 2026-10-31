# Release Process & Versioning Policy

> **Versioning Standard:** Semantic Versioning (SemVer 2.0.0)  
> **Release Cadence:** Bi-weekly minor releases, ad-hoc security patches

This document defines the release lifecycle, tagging conventions, and changelog management for OpsPilot.

---

## 1. Versioning Format

OpsPilot follows `MAJOR.MINOR.PATCH`:
- **MAJOR:** Incompatible API changes, breaking database migrations, or significant architectural shifts.
- **MINOR:** Backward-compatible new features, new deployment provider adapters, or enhanced investigation tools.
- **PATCH:** Backward-compatible bug fixes and security hotfixes.

---

## 2. Release Steps

1. **Pre-Release Freeze:** Verify all CI checks on `main` are green.
2. **Update Changelog:** Move items from `[Unreleased]` in `CHANGELOG.md` into the new release header with the release date.
3. **Tag Release:**
   ```bash
   git tag -a v0.1.0 -m "Release v0.1.0"
   git push origin v0.1.0
   ```
4. **Automated Docker Publishing:** The GitHub Actions release workflow builds multi-arch container images (`linux/amd64`, `linux/arm64`) and pushes them to GitHub Container Registry (GHCR) and Docker Hub.
5. **Publish GitHub Release:** Generate release notes and link to the changelog.
