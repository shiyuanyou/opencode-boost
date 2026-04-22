import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncStateWithOpencode } from "../../src/lib/sync.js";

vi.mock("../../src/lib/opencode.js", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("../../src/lib/store.js", () => ({
  readNames: vi.fn(),
  readState: vi.fn(),
  writeState: vi.fn(),
}));

import { getCurrentSession } from "../../src/lib/opencode.js";
import { readNames, readState, writeState } from "../../src/lib/store.js";

describe("syncStateWithOpencode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readNames).mockResolvedValue({});
    vi.mocked(readState).mockResolvedValue({});
  });

  it("does nothing when opencode has no active session", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    vi.mocked(readState).mockResolvedValue({ "/proj": { current: "my-sess" } });

    await syncStateWithOpencode("/proj");

    expect(writeState).not.toHaveBeenCalled();
  });

  it("does nothing when state already matches", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue("ses_abc");
    vi.mocked(readNames).mockResolvedValue({ "/proj": { "my-sess": "ses_abc" } });
    vi.mocked(readState).mockResolvedValue({ "/proj": { current: "my-sess" } });

    await syncStateWithOpencode("/proj");

    expect(writeState).not.toHaveBeenCalled();
  });

  it("updates state.current when opencode points to a managed session under different name", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue("ses_abc");
    vi.mocked(readNames).mockResolvedValue({ "/proj": { "old-name": "ses_abc", "other": "ses_xyz" } });
    vi.mocked(readState).mockResolvedValue({ "/proj": { current: "other" } });

    await syncStateWithOpencode("/proj");

    expect(writeState).toHaveBeenCalledWith({
      "/proj": { current: "old-name" },
    });
  });

  it("updates state.current to raw sid when session is unmanaged", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue("ses_unmanaged");
    vi.mocked(readNames).mockResolvedValue({ "/proj": { "my-sess": "ses_abc" } });
    vi.mocked(readState).mockResolvedValue({ "/proj": { current: "my-sess" } });

    await syncStateWithOpencode("/proj");

    expect(writeState).toHaveBeenCalledWith({
      "/proj": { current: "ses_unmanaged" },
    });
  });
});
