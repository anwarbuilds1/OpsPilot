import { TargetProvider } from '../enums/target-provider.enum.js';

export interface DeploymentTargetProps {
  id: string;
  organizationId: string;
  name: string;
  targetProvider: TargetProvider;
  configuration: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export class DeploymentTarget {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly targetProvider: TargetProvider;
  readonly configuration: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: DeploymentTargetProps) {
    this.id = props.id;
    this.organizationId = props.organizationId;
    this.name = props.name;
    this.targetProvider = props.targetProvider;
    this.configuration = Object.freeze({ ...props.configuration });
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }
}
