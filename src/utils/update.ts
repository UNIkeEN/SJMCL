export function swapReleaseNotesLanguages(md: string): string {
  // match 3+ consecutive '-' delimiters with content above and below
  const match = md.match(/^([\s\S]*?)\n-{3,}\n([\s\S]*)$/m);

  if (!match) {
    return md;
  }

  const upper = match[1].trimEnd();
  const lower = match[2].trimStart();

  return `${lower}\n---\n${upper}`;
}
