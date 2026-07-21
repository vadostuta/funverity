export const R = '\x1b[0m';
export const B = '\x1b[1m';
export const D = '\x1b[2m';
export const GREEN = '\x1b[32m';
export const YELLOW = '\x1b[33m';
export const BLUE = '\x1b[34m';
export const CYAN = '\x1b[36m';
export const RED = '\x1b[31m';

export function banner(title: string): void {
  console.log(
    `\n${CYAN}╔═══════════════════════════════════════════════════════════╗${R}` +
      `\n${CYAN}║  ${B}${title}${R}${CYAN}${' '.repeat(Math.max(0, 57 - title.length))}║${R}` +
      `\n${CYAN}╚═══════════════════════════════════════════════════════════╝${R}\n`,
  );
}

export function phase(t: string): void {
  console.log(
    `\n${BLUE}${'═'.repeat(58)}${R}\n${BLUE}${B}  ${t}${R}\n${BLUE}${'═'.repeat(58)}${R}`,
  );
}
export function step(m: string): void {
  console.log(`\n${D}  ⏳ ${m}${R}`);
}
export function ok(m: string): void {
  console.log(`  ${GREEN}✅ ${m}${R}`);
}
export function warn(m: string): void {
  console.log(`  ${YELLOW}⚠️  ${m}${R}`);
}
export function err(m: string): void {
  console.log(`  ${RED}❌ ${m}${R}`);
}
export function info(m: string): void {
  console.log(`  ${CYAN}ℹ️  ${m}${R}`);
}
