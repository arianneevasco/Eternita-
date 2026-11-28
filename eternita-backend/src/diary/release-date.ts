export function isReleaseDateReached(
  releaseDate: string | undefined,
): boolean {
  if (!releaseDate) {
    return true;
  }

  const release = new Date(releaseDate);
  const now = new Date();

  return now >= release;
}
