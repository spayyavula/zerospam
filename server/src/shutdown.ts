export type Closer = { name: string; close: () => void | Promise<void> };

/**
 * Close each resource in order. Never throws — collects and returns the
 * failures so a caller can log them, guaranteeing every closer is attempted.
 */
export async function closeAll(closers: Closer[]): Promise<Array<{ name: string; err: unknown }>> {
  const errors: Array<{ name: string; err: unknown }> = [];
  for (const c of closers) {
    try {
      await c.close();
    } catch (err) {
      errors.push({ name: c.name, err });
    }
  }
  return errors;
}
