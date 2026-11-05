import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileBadge } from "./ProfileBadge";

describe("ProfileBadge", () => {
  it("greets by first name with the photo as decoration", () => {
    const { container } = render(
      <ProfileBadge fullName="Pessoa Exemplo" photoUrl="https://example.test/p.png" />,
    );
    expect(screen.getByText("Olá, Pessoa")).toBeInTheDocument();
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "https://example.test/p.png");
    expect(img).toHaveAttribute("alt", "");
  });

  it("renders nothing without a name", () => {
    const { container } = render(<ProfileBadge fullName={null} photoUrl={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
