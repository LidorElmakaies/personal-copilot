export interface HashResult {
  hash: string;
  salt: string;
}

/** Implemented by SaltPepperSha256Hasher, consumed by AuthService. See docs/specs/services.md#auth. */
export interface IPasswordHasher {
  /** Generates a new random salt and returns the hash + salt to store. */
  hash(plaintext: string): HashResult;
  /** Recomputes the hash with the stored salt and compares. */
  verify(plaintext: string, hash: string, salt: string): boolean;
}
