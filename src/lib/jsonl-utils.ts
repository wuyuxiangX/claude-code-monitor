// JSONL chunk-based parsing utilities
export const RE_INPUT_TOKENS = /"input_tokens"\s*:\s*(\d+)/g;
export const RE_OUTPUT_TOKENS = /"output_tokens"\s*:\s*(\d+)/g;
export const RE_CACHE_READ = /"cache_read_input_tokens"\s*:\s*(\d+)/g;
export const RE_CACHE_CREATION = /"cache_creation_input_tokens"\s*:\s*(\d+)/g;
export const RE_MODEL = /"model"\s*:\s*"([^"]+)"/g;
export const RE_TYPE_ASSISTANT = /"type"\s*:\s*"assistant"/g;
export const RE_TYPE_USER = /"type"\s*:\s*"(?:user|human)"/g;
export const RE_GIT_BRANCH = /"gitBranch"\s*:\s*"([^"]+)"/;

export function sumAllMatches(text: string, re: RegExp): number {
  re.lastIndex = 0;
  let total = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    total += parseInt(m[1], 10);
  }
  return total;
}

export function countMatches(text: string, re: RegExp): number {
  re.lastIndex = 0;
  let count = 0;
  while (re.exec(text) !== null) count++;
  return count;
}

export function lastMatch(text: string, re: RegExp): string | undefined {
  re.lastIndex = 0;
  let last: string | undefined;
  let m;
  while ((m = re.exec(text)) !== null) last = m[1];
  return last;
}
