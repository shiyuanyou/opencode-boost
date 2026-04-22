export async function originAvailableCommand(_cwd: string): Promise<void> {
  console.log("  Tip: `ocb list` now shows all sessions including unmanaged ones.");
  console.log("  Use `ocb attach --all` to manage all sessions at once.");
  console.log("");
}
