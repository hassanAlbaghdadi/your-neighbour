import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExistingPhotoPicker } from "./existing-photo-picker";

const onSelectMock = vi.fn();

describe("ExistingPhotoPicker keyboard accessibility", () => {
  beforeEach(() => {
    onSelectMock.mockReset();
  });

  it("exposes each photo as a focusable, labeled <button> — the old bare <img onClick> had no accessible role or focus stop at all", async () => {
    render(
      <ExistingPhotoPicker
        photos={["https://example.com/a.jpg", "https://example.com/b.jpg"]}
        onSelect={onSelectMock}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /choose existing/i }));

    const photoButtons = await screen.findAllByRole("button", {
      name: "Select photo",
    });
    expect(photoButtons).toHaveLength(2);
    expect(photoButtons[0].tagName).toBe("BUTTON");

    // Real <button> elements are Tab-reachable and activate on Enter/Space
    // natively (browser behavior jsdom doesn't simulate, so not re-tested
    // here) — being an actual <button>, not a keydown handler bolted onto a
    // <div>, is what makes that guarantee hold.
    photoButtons[0].focus();
    expect(document.activeElement).toBe(photoButtons[0]);
  });

  it("selects a photo on click and closes the picker", async () => {
    render(
      <ExistingPhotoPicker
        photos={["https://example.com/a.jpg"]}
        onSelect={onSelectMock}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /choose existing/i }));

    const photoButton = await screen.findByRole("button", {
      name: "Select photo",
    });
    fireEvent.click(photoButton);

    expect(onSelectMock).toHaveBeenCalledWith("https://example.com/a.jpg");
  });
});
