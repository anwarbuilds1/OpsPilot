# VPS Integration Architecture & SSH Protocol

> **Transport Protocol:** OpenSSH (SSHv2) over TCP Port 22  
> **Key Cryptography:** Ed25519 / RSA 4096-bit  
> **Runtime Target:** Docker Engine & Docker Compose

This document details the connection, security, and execution model for registering and managing Ubuntu VPS instances.

---

## 1. Connection Architecture

```mermaid
flowchart LR
    subgraph OpsPilotPlane [OpsPilot Deployment Worker]
        Vault[Envelope Encryption Service]
        SSH_Client[SSH2 Client (Isolated Process)]
    end

    subgraph HostVPS [Customer Ubuntu VPS]
        SSHD[OpenSSH Daemon (Port 22)]
        OpsUser[opspilot User (Non-Root)]
        DockerDaemon[Docker Daemon (/var/run/docker.sock)]
        ServicesDir[/opt/opspilot/services/]
    end

    Vault -->|Decrypts Private Key in Memory| SSH_Client
    SSH_Client -->|SSH Protocol / Key Auth| SSHD
    SSHD --> OpsUser
    OpsUser --> DockerDaemon
    OpsUser --> ServicesDir
```

---

## 2. Server Validation & Connectivity Check

When a VPS is connected (`POST /integrations/vps/connect`):
1. **TCP Handshake:** Validates host reachability and verifies host key fingerprints to prevent Man-in-the-Middle (MITM) attacks.
2. **Authentication:** Authenticates using the generated or user-provided Ed25519 SSH private key.
3. **Environment Probes:** Executes three non-destructive validation commands:
   ```bash
   uname -s               # Verifies Linux OS
   docker --version       # Verifies Docker Engine is installed and running
   docker compose version # Verifies Docker Compose v2 is active
   ```
4. If all checks pass, the VPS status transitions to `active`.

---

## 3. Command Templating & Injection Defense

OpsPilot **never** concatenates arbitrary user inputs into shell commands executed over SSH. Commands use strict, pre-compiled parameter templates:
- Allowed commands: `mkdir`, `cp`, `docker compose pull`, `docker compose up`, `docker compose ps`, `docker compose down`.
- Target paths are strictly validated to conform to `/opt/opspilot/services/<uuid>/`.
