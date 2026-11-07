-- OpsPilot Database Migration: 0001_initial_schema.sql
-- Enables core pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE org_role AS ENUM ('Owner', 'Admin', 'Engineer', 'Viewer');
CREATE TYPE integration_type AS ENUM ('github', 'aws', 'vps', 'cloudflare');
CREATE TYPE target_provider AS ENUM ('aws_ecs', 'vps_docker', 'cloudflare_workers', 'cloudflare_pages');
CREATE TYPE deployment_status AS ENUM (
    'Queued', 'Preparing', 'Building', 'Publishing', 
    'Deploying', 'HealthChecking', 'Succeeded', 'Failed', 'RollingBack', 'RolledBack', 'Cancelled'
);
CREATE TYPE build_strategy AS ENUM ('dockerfile', 'cloudflare_worker_bundle', 'static_export');
CREATE TYPE artifact_type AS ENUM ('oci_image', 'worker_bundle', 'pages_manifest');
CREATE TYPE application_runtime AS ENUM ('container', 'v8_isolate', 'static_cdn');

-- 1. Identity & Multi-Tenancy
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_organizations_slug ON organizations(slug);

CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role org_role NOT NULL DEFAULT 'Engineer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_user UNIQUE (organization_id, user_id)
);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);

-- 2. Projects & Services
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_project_slug UNIQUE (organization_id, slug)
);
CREATE INDEX idx_projects_org ON projects(organization_id);

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    repository_name VARCHAR(255) NOT NULL,
    branch VARCHAR(100) NOT NULL DEFAULT 'main',
    target_provider target_provider NOT NULL DEFAULT 'aws_ecs',
    build_strategy build_strategy NOT NULL DEFAULT 'dockerfile',
    artifact_type artifact_type NOT NULL DEFAULT 'oci_image',
    application_runtime application_runtime NOT NULL DEFAULT 'container',
    dockerfile_path VARCHAR(255),
    build_context VARCHAR(255) DEFAULT '.',
    container_port INT,
    healthcheck_path VARCHAR(255) NOT NULL DEFAULT '/health',
    cpu_units INT,
    memory_mb INT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_service_slug UNIQUE (project_id, slug),
    -- CONDITIONAL CONSTRAINT: Enforces container requirements only for container providers
    CONSTRAINT check_container_runtime_fields CHECK (
        target_provider NOT IN ('aws_ecs', 'vps_docker') OR (
            dockerfile_path IS NOT NULL AND
            container_port IS NOT NULL AND
            cpu_units IS NOT NULL AND
            memory_mb IS NOT NULL
        )
    )
);
CREATE INDEX idx_services_org ON services(organization_id);
CREATE INDEX idx_services_project ON services(project_id);
CREATE INDEX idx_services_provider ON services(target_provider);

-- 3. Integrations & Credentials
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type integration_type NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_integrations_org ON integrations(organization_id);

CREATE TABLE integration_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    encrypted_payload TEXT NOT NULL,
    auth_tag VARCHAR(64) NOT NULL,
    initialization_vector VARCHAR(64) NOT NULL,
    key_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_integration_cred UNIQUE (integration_id)
);
CREATE INDEX idx_integration_credentials_org ON integration_credentials(organization_id);

-- 4. Deployment Targets
CREATE TABLE deployment_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    provider target_provider NOT NULL,
    configuration JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_targets_org ON deployment_targets(organization_id);

-- 5. Deployments & Events
CREATE TABLE deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    deployment_target_id UUID NOT NULL REFERENCES deployment_targets(id),
    provider target_provider NOT NULL,
    environment VARCHAR(50) NOT NULL DEFAULT 'production',
    commit_sha VARCHAR(64) NOT NULL,
    commit_message TEXT,
    commit_author VARCHAR(255),
    image_uri TEXT,
    artifact_reference TEXT,
    status deployment_status NOT NULL DEFAULT 'Queued',
    failure_reason TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    triggered_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_deployments_service ON deployments(service_id, created_at DESC);
CREATE INDEX idx_deployments_org ON deployments(organization_id);
CREATE INDEX idx_deployments_status ON deployments(status);

CREATE TABLE deployment_events (
    id BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    level VARCHAR(20) NOT NULL DEFAULT 'INFO',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dep_events_dep ON deployment_events(deployment_id);
CREATE INDEX idx_dep_events_org ON deployment_events(organization_id);
