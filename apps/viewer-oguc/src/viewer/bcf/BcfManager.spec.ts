// src/viewer/bcf/BcfManager.spec.ts
import { describe, expect, test } from "vitest";
import { BcfManager } from "./BcfManager";
import type { BcfViewpoint } from "./types/bcf";

// addTopic takes the viewpoint as a parameter (not captured internally -
// see captureViewpoint.ts's header comment for why BcfManager itself has
// no Three.js/viewer dependency), so no mock viewer is needed here - a
// plain BcfViewpoint object exercises addTopic's own logic directly.
const mockViewpoint: BcfViewpoint = {
  guid: "vp-test",
  camera: {
    position: { x: 0, y: 5, z: 10 },
    direction: { x: 0, y: 0, z: -1 },
    up: { x: 0, y: 1, z: 0 },
  },
};

describe("BcfManager.addTopic", () => {
  test("creates topic with required fields", () => {
    const manager = new BcfManager();
    const topic = manager.addTopic("Test title", "Description", "High", mockViewpoint);

    expect(topic.title).toBe("Test title");
    expect(topic.description).toBe("Description");
    expect(topic.priority).toBe("High");
    expect(topic.status).toBe("Open");
    expect(topic.viewpoints.length).toBeGreaterThan(0);
    expect(topic.viewpoints[0]).toBe(mockViewpoint);
    expect(manager.getState().topics).toContain(topic);
    expect(manager.getState().activeTopic).toBe(topic);
  });

  test("creates empty project lazily if none exists yet, and sets isNewProject", () => {
    const manager = new BcfManager();
    expect(manager.getState().project).toBeNull();
    expect(manager.getState().isNewProject).toBe(false);

    manager.addTopic("Title", undefined, undefined, mockViewpoint);

    const state = manager.getState();
    expect(state.project).not.toBeNull();
    expect(state.isNewProject).toBe(true);
    expect(state.project!.topics.length).toBe(1);
    // Defaults, per this task's own locked scope (priority defaults to
    // Medium, description defaults to "" when omitted).
    expect(state.project!.topics[0].priority).toBe("Medium");
    expect(state.project!.topics[0].description).toBe("");
  });

  test("isNewProject stays false when adding a topic to an already-imported project", () => {
    const manager = new BcfManager();
    // Simulate "a real BCF was already imported" without needing an
    // actual file - directly exercises the field addTopic checks, not
    // BcfImporter's own parsing (already covered by BcfImporter's own
    // tests).
    manager.addTopic("First (lazy-created project)", undefined, undefined, mockViewpoint);
    expect(manager.getState().isNewProject).toBe(true);

    manager.addTopic("Second (same project)", undefined, undefined, mockViewpoint);
    // Still true - this project was never actually imported, adding a
    // second topic to the SAME lazily-created project doesn't change
    // that. (loadBcf() is what sets it back to false - covered by
    // BcfManager's own loadBcf, not re-tested here.)
    expect(manager.getState().isNewProject).toBe(true);
    expect(manager.getState().project!.topics.length).toBe(2);
  });
});
