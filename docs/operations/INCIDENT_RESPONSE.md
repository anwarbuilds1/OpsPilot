# Incident Response Playbook

> **Target Audience:** On-Call Engineers, SREs, Engineering Leads  
> **Target:** MTTA < 5 minutes, MTTR < 20 minutes

This operational runbook guides on-call engineers responding to production alerts detected by OpsPilot.

---

## 1. Incident Response Lifecycle Flowchart

```mermaid
flowchart TD
    Alert([Alert Fires: PagerDuty / Slack / Dashboard]) --> Ack[1. Acknowledge Incident in Dashboard]
    Ack --> Review[2. Review Incident Timeline & AI Report]
    
    Review --> CauseIdentified{Is Probable Cause Clear?}
    
    CauseIdentified -->|Yes & Regressed Deployment| Rollback[3. Click 'Rollback' to Preceding Deployment]
    CauseIdentified -->|Yes & Configuration Error| FixConfig[3. Update Service Environment & Redeploy]
    CauseIdentified -->|Inconclusive| DeepDive[3. Manual Deep Dive: Logs & Terminal]

    Rollback --> Verify[4. Post-Mitigation Verification]
    FixConfig --> Verify
    DeepDive --> Verify

    Verify --> ProbesHealthy{Are Health Checks 200 OK?}
    ProbesHealthy -->|Yes| Resolve[5. Mark Incident Resolved]
    ProbesHealthy -->|No| Escalate[5. Escalate to Secondary Lead]

    Resolve --> PostMortem[6. Export AI Diagnostic Report for Post-Mortem]

    classDef step fill:#e3f2fd,stroke:#1565c0,stroke-width:2px;
    classDef check fill:#fff3e0,stroke:#f57c00,stroke-width:2px;
    class Ack,Review,Rollback,FixConfig,DeepDive,Verify,Resolve,PostMortem step;
    class CauseIdentified,ProbesHealthy check;
```

---

## 2. Step-by-Step Response Procedure

### Step 1: Acknowledge the Incident
- Open the incident link in the OpsPilot dashboard (`/incidents/:id`).
- Click **"Acknowledge"** to notify teammates that investigation is in progress.

### Step 2: Review Timeline & AI Investigation Report
- Check the **Incident Timeline**: Did a deployment complete in the last 60 minutes?
- Review the **AI Diagnostic Summary**:
  - Read the **Observations** (verifiable facts).
  - Inspect the **Supporting Evidence** citations (exact log lines and commit diffs).
  - Note the **Confidence Level** (`High`, `Medium`, `Low`).

### Step 3: Mitigate the Production Outage
- **If caused by a bad deployment:** Click **"Trigger Rollback"** immediately. OpsPilot will revert the ECS Task Definition or VPS Compose file to the previous working version.
- **If caused by an external dependency outage:** Check third-party status pages; verify if circuit breakers or fallback providers can be enabled.

### Step 4: Verify Service Recovery
- Monitor the real-time health probe widget on the incident page.
- Ensure 3 consecutive probes report `200 OK` and error rates fall below 1%.

### Step 5: Post-Mortem & Remediation PR
- Export the structured AI report as a Markdown incident summary.
- If an automated code fix was proposed, review the PR in GitHub, run CI tests, and schedule a permanent fix.
