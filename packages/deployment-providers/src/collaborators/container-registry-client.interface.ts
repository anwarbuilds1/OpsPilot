export interface ImageDigestResult {
  readonly exists: boolean;
  readonly digest?: string;
  readonly error?: string;
}

export interface IContainerRegistryClient {
  verifyImageDigest(
    imageUri: string,
    credentials?: Readonly<Record<string, unknown>>
  ): Promise<ImageDigestResult>;
}

export class MockContainerRegistryClient implements IContainerRegistryClient {
  async verifyImageDigest(
    imageUri: string,
    _credentials?: Readonly<Record<string, unknown>>
  ): Promise<ImageDigestResult> {
    if (!imageUri || imageUri.includes('invalid') || imageUri.includes('not-found')) {
      return { exists: false, error: `Image not found: ${imageUri}` };
    }
    return {
      exists: true,
      digest: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    };
  }
}
