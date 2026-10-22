export function subscribePreference(onStoreChange: () => void): () => void {
  window.addEventListener("spt-preference", onStoreChange);
  return () => window.removeEventListener("spt-preference", onStoreChange);
}

export function readUserName(): string {
  return window.localStorage.getItem("spt-user") ?? "";
}

export function serverUserName(): string {
  return "";
}

export function writeUserName(name: string): void {
  window.localStorage.setItem("spt-user", name);
  window.dispatchEvent(new Event("spt-preference"));
}

export function readDifficulty(): string {
  return window.localStorage.getItem("spt-difficulty") ?? "medium";
}

export function serverDifficulty(): string {
  return "medium";
}

export function writeDifficulty(difficulty: string): void {
  window.localStorage.setItem("spt-difficulty", difficulty);
  window.dispatchEvent(new Event("spt-preference"));
}
