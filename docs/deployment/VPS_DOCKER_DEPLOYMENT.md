# VPS Docker Compose Deployment Guide

This guide details how OpsPilot deploys, monitors, and rolls back containerized applications on standard **Ubuntu Linux VPS** instances using Docker Compose over SSH.

---

## 1. Supported Operating Systems & Prerequisites

- **Supported OS:** Ubuntu 22.04 LTS, Ubuntu 24.04 LTS (Debian 12 compatible).
- **Required Software:**
  - Docker Engine `>= 24.0.0`
  - Docker Compose Plugin (`docker compose version >= 2.20.0`)
  - OpenSSH Server running on port 22

---

## 2. Setting Up the `opspilot` Deployment User on the VPS

To enforce the principle of least privilege, do not use the `root` user for OpsPilot deployments. Create a dedicated `opspilot` user with Docker permissions:

```bash
# 1. Create the unprivileged opspilot user
sudo adduser --disabled-password --gecos "" opspilot

# 2. Add opspilot user to the docker group
sudo usermod -aG docker opspilot

# 3. Create SSH directory
sudo mkdir -p /home/opspilot/.ssh
sudo chmod 700 /home/opspilot/.ssh

# 4. Authorize the OpsPilot Public Key
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... opspilot-deployer" | sudo tee -a /home/opspilot/.ssh/authorized_keys
sudo chmod 600 /home/opspilot/.ssh/authorized_keys
sudo chown -R opspilot:opspilot /home/opspilot/.ssh

# 5. Create deployment directory with proper ownership
sudo mkdir -p /opt/opspilot/services
sudo chown -R opspilot:opspilot /opt/opspilot
```

---

## 3. Deployment Directory Structure on the Host

OpsPilot manages each service in an isolated directory under `/opt/opspilot/services/`:

```text
/opt/opspilot/services/5e6f7a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b/
├── docker-compose.yml          # Active running compose manifest
├── docker-compose.yml.backup   # Preserved prior manifest for instant rollback
├── .env                        # Injected environment variables (chmod 600)
└── deployment.meta.json        # Commit SHA, timestamp, and deployment ID
```

---

## 4. Deployment Execution Sequence

When `VpsDockerProvider.deploy()` is invoked:

1. **Verify Connectivity:**
   ```bash
   ssh opspilot@<host> "docker info --format '{{.ServerVersion}}'"
   ```
2. **Backup Previous Manifest:**
   ```bash
   ssh opspilot@<host> "if [ -f /opt/opspilot/services/<id>/docker-compose.yml ]; then cp /opt/opspilot/services/<id>/docker-compose.yml /opt/opspilot/services/<id>/docker-compose.yml.backup; fi"
   ```
3. **Upload Rendered Compose File & Environment:**
   Transfers the newly generated `docker-compose.yml` and `.env` file via SCP/SFTP directly to the service directory.
4. **Pull Images & Recreate Containers:**
   ```bash
   ssh opspilot@<host> "cd /opt/opspilot/services/<id> && docker compose pull && docker compose up -d --remove-orphans"
   ```
5. **Verify Running State:**
   ```bash
   ssh opspilot@<host> "cd /opt/opspilot/services/<id> && docker compose ps --format json"
   ```

---

## 5. Rollback Procedure

If post-deployment health checks fail or an operator triggers a rollback:

```bash
ssh opspilot@<host> "cd /opt/opspilot/services/<id> && \
  cp docker-compose.yml.backup docker-compose.yml && \
  docker compose up -d --remove-orphans"
```

Because the prior container image already resides in the local Docker image cache on the VPS, restoring the backup manifest executes in **under 5 seconds**.
