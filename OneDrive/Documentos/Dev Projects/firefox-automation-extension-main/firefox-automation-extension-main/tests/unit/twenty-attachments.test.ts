import { buildAdfArtifactUploadKey, toReadableAdfFileName } from "../../src/background/twenty";
import type { AdfArtifact } from "../../src/shared/lead";

function sampleArtifact(overrides: Partial<AdfArtifact> = {}): AdfArtifact {
  return {
    fileName: "3_10_26_task_abc_MotoMate123.adf.xml",
    contentType: "text/xml",
    content: "<adf><id>1</id></adf>",
    sourceUrl: "https://example.com/m",
    taskId: "abc",
    completedAt: "3/10/26",
    ...overrides,
  };
}

describe("twenty ADF attachment helpers", () => {
  it("buildAdfArtifactUploadKey is stable for same content", () => {
    const a = sampleArtifact();
    const b = sampleArtifact({ fileName: "other.xml" });
    expect(buildAdfArtifactUploadKey(a)).toBe(buildAdfArtifactUploadKey(b));
  });

  it("buildAdfArtifactUploadKey differs when content differs", () => {
    const a = sampleArtifact();
    const b = sampleArtifact({ content: "<adf><id>2</id></adf>" });
    expect(buildAdfArtifactUploadKey(a)).not.toBe(buildAdfArtifactUploadKey(b));
  });

  it("toReadableAdfFileName uses .txt and preserves basename hints", () => {
    const name = toReadableAdfFileName(sampleArtifact());
    expect(name.endsWith(".txt")).toBe(true);
    expect(name).toContain("3_10_26_task_abc_MotoMate123");
  });
});
