/**
 * Driven port for secret retrieval and cryptographic credential operations.
 * Allows use cases and orchestrators to retrieve decrypted integration credentials
 * without coupling to concrete database tables, envelope encryption, or KMS implementations.
 */
export interface ISecretVaultPort {
  /**
   * Retrieves and decrypts the credentials associated with an integration.
   * Throws if the integration is not found or does not belong to organizationId.
   */
  getDecryptedCredentials(
    integrationId: string,
    organizationId: string,
  ): Promise<Readonly<Record<string, unknown>>>;

  /**
   * Securely encrypts and stores credentials for an integration.
   */
  storeCredentials(
    integrationId: string,
    organizationId: string,
    credentials: Readonly<Record<string, unknown>>,
  ): Promise<void>;
}
