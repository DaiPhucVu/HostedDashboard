import React from "react";
import { act, render, screen } from "@testing-library/react";

import AiAssignmentReview from "./AiAssignmentReview";


describe("AI assignment loading state", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("shows staged matching progress while the AI request is running", () => {
    render(
      <AiAssignmentReview
        loading
        review={null}
        error=""
        providers={[]}
        selectedProviderId={null}
        jobStatus="Open"
      />
    );

    expect(screen.getByText("Smart matching in progress")).toBeTruthy();
    expect(screen.getByText("Understanding the request")).toBeTruthy();
    expect(screen.getByText("Reading the selected service category and customer description.")).toBeTruthy();

    act(() => jest.advanceTimersByTime(10000));

    expect(screen.getByText("Checking provider eligibility")).toBeTruthy();
    expect(screen.getByText("Applying verification, availability, capacity and distance rules.")).toBeTruthy();
    expect(screen.getByText("10s")).toBeTruthy();
  });
});
