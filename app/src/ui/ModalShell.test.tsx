import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModalShell } from "./ModalShell";

function renderShell(props: Partial<Parameters<typeof ModalShell>[0]> = {}) {
  const onClose = vi.fn();
  const utils = render(
    <ModalShell onClose={onClose} {...props}>
      <div data-testid="panel">panel</div>
    </ModalShell>,
  );
  return { onClose, ...utils };
}

describe("ModalShell", () => {
  it("renders its panel", () => {
    renderShell();
    expect(screen.getByTestId("panel")).toBeInTheDocument();
  });

  it("closes on backdrop click", () => {
    const { onClose, container } = renderShell();
    fireEvent.click(container.firstElementChild as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores Escape unless closeOnEscape is set", () => {
    const { onClose } = renderShell();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape when closeOnEscape is set", () => {
    const { onClose } = renderShell({ closeOnEscape: true });
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("removes its Escape listener on unmount", () => {
    const { onClose, unmount } = renderShell({ closeOnEscape: true });
    unmount();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("exposes dialog semantics only when asked", () => {
    renderShell();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("marks the overlay as a modal dialog", () => {
    renderShell({ dialog: true });
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("renders into document.body when portal is set", () => {
    const { container } = renderShell({ portal: true });
    expect(container).toBeEmptyDOMElement();
    expect(document.body).toContainElement(screen.getByTestId("panel"));
  });
});
