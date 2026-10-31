# ADR-0006: AWS ECS Fargate Deployment Adapter

- **Status:** Accepted
- **Date:** 2026-11-01
- **Author:** Principal Software Architect
- **Deciders:** OpsPilot Core Team

---

## Context
Small engineering teams deploying to AWS typically choose between Elastic Beanstalk, EC2 instances, EKS (Kubernetes), App Runner, or ECS Fargate. We must choose an initial AWS compute target that balances container flexibility, low management overhead, and architectural longevity.

## Problem Statement
Which AWS container hosting service should OpsPilot support as its initial cloud target?

## Decision
We select **AWS ECS with Fargate serverless compute** paired with **Amazon ECR** as the primary AWS deployment target. Cross-account access will use AWS STS IAM role assumption with an External ID.

## Alternatives Considered
1. **AWS App Runner:**
   - *Pros:* Simpler deployment abstraction.
   - *Cons:* Lacks support for complex networking (VPC peering, private databases), background workers, and fine-grained resource scaling.
2. **AWS EKS (Kubernetes):**
   - *Pros:* Industry standard for large enterprises.
   - *Cons:* $73/month fixed cluster fee per cluster; immense operational complexity unsuitable for 2–10 person engineering teams.
3. **AWS Elastic Beanstalk:**
   - *Cons:* Legacy service, slow deployments, opaque failure modes.

## Rationale & Consequences
- **Positive:** True serverless container compute (no EC2 instances to patch); native integration with CloudWatch logs; atomic task definition revision rollback; pay-per-second resource billing.
- **Negative:** ECS deployment stabilization can take 2–5 minutes under default circuit breaker settings.

## Security Implications
No static AWS keys stored. Temporary STS credentials (1-hour expiry) assumed per deployment job.

## References
- [`docs/deployment/AWS_ECS_DEPLOYMENT.md`](../deployment/AWS_ECS_DEPLOYMENT.md)
