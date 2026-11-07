export interface DockerComposeGeneratorOptions {
  serviceName: string;
  imageUri: string;
  containerPort: number;
  environmentVariables: Record<string, string>;
  restartPolicy?: string;
}

export class DockerComposeGenerator {
  generate(options: DockerComposeGeneratorOptions): string {
    const envLines = Object.entries(options.environmentVariables)
      .map(([k, v]) => `      - ${k}=${v}`)
      .join('\n');

    return `version: '3.8'
services:
  ${options.serviceName}:
    image: ${options.imageUri}
    ports:
      - "${options.containerPort}:${options.containerPort}"
    restart: ${options.restartPolicy ?? 'unless-stopped'}
    environment:
${envLines ? envLines : '      {}'}
`;
  }
}
