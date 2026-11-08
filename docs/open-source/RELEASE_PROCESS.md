# Release Process & Versioning Policy (Deprecated)

> [!NOTE]
> **Canonical Document Location:** [`docs/releases/RELEASE_PROCESS.md`](../releases/RELEASE_PROCESS.md)
> This open-source release stub has been superseded by the canonical release engineering specification, which details automated changelogs, Syft SPDX SBOM generation, Sigstore Cosign container signing, and security hotfix procedures.

For the authoritative release engineering guide, versioning policies, and signing instructions, please see:

👉 [**OpsPilot Release Engineering & Release Process**](../releases/RELEASE_PROCESS.md)

---

### Historical Summary (Archived Context)

OpsPilot follows **Semantic Versioning 2.0.0 (`MAJOR.MINOR.PATCH`)**:
- **MAJOR:** Incompatible API changes, breaking database migrations, or significant architectural shifts.
- **MINOR:** Backward-compatible new features, new deployment provider adapters, or enhanced investigation tools.
- **PATCH:** Backward-compatible bug fixes and security hotfixes.

#### Historical Release Steps:
1. **Pre-Release Freeze:** Verify all CI checks on `main` are green.
2. **Update Changelog:** Move items from `[Unreleased]` in `CHANGELOG.md` into the new release header with the release date.
3. **Tag Release:** Tag annotated release on Git.
4. **Automated Docker Publishing:** The GitHub Actions release workflow builds multi-arch container images (`linux/amd64`, `linux/arm64`) and pushes them to GHCR.
5. **Publish GitHub Release:** Generate release notes and link to the changelog.
