import { createTranslator } from "@t3tools/client-runtime/i18n";
import { describe, expect, it } from "vite-plus/test";

import { getWizardStepAriaLabel } from "./wizard";

describe("getWizardStepAriaLabel", () => {
  const t = createTranslator("en");

  it("names steps with the same text by their position", () => {
    const labels = [0, 1].map((index) =>
      getWizardStepAriaLabel(t, { step: "Review", index, currentStep: 0 }),
    );

    expect(labels).toEqual(["Review, step 1", "Review, step 2"]);
  });

  it("adds the summary only for completed steps", () => {
    expect(
      getWizardStepAriaLabel(t, { step: "Account", index: 0, currentStep: 1, summary: "Work" }),
    ).toBe("Account, step 1, Work");
    expect(
      getWizardStepAriaLabel(t, { step: "Account", index: 1, currentStep: 1, summary: "Work" }),
    ).toBe("Account, step 2");
  });
});
