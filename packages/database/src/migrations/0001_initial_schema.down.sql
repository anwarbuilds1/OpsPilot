-- OpsPilot Database Migration Rollback: 0001_initial_schema.down.sql

DROP TABLE IF EXISTS deployment_events CASCADE;
DROP TABLE IF EXISTS deployments CASCADE;
DROP TABLE IF EXISTS deployment_targets CASCADE;
DROP TABLE IF EXISTS integration_credentials CASCADE;
DROP TABLE IF EXISTS integrations CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS application_runtime;
DROP TYPE IF EXISTS artifact_type;
DROP TYPE IF EXISTS build_strategy;
DROP TYPE IF EXISTS deployment_status;
DROP TYPE IF EXISTS target_provider;
DROP TYPE IF EXISTS integration_type;
DROP TYPE IF EXISTS org_role;
