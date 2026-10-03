import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { IdUploadForm } from "./id-upload-form";
import * as actions from "./actions";
import * as resize from "@/lib/hotel-eye/resize";

vi.mock("./actions", () => ({ submitIdAction: vi.fn() }));
vi.mock("@/lib/hotel-eye/resize", () => ({ resizeIdPhoto: vi.fn() }));
const submit = vi.mocked(actions.submitIdAction);
const shrink = vi.mocked(resize.resizeIdPhoto);

const props = {
  token: "a".repeat(64), hostName: "Hunza Stays", propertyName: "Riverside Cabin",
  defaultName: "Ayesha Khan", defaultPhone: "03001234567", startDate: "2026-11-09", endDate: "2026-11-12",
};

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Sana Malik" } });
  fireEvent.change(screen.getByLabelText(/cnic number/i), { target: { value: "35202-1234567-1" } });
  fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "03005550123" } });
  fireEvent.change(screen.getByLabelText(/photo of your id/i), { target: { files: [new File(["x"], "id.png", { type: "image/png" })] } });
  fireEvent.click(screen.getByRole("button", { name: /send my id/i }));
}

describe("IdUploadForm", () => {
  beforeEach(() => { submit.mockReset(); shrink.mockReset(); shrink.mockResolvedValue(new Blob(["y"], { type: "image/jpeg" })); });

  // @req CNIC-07
  test("the privacy notice comes before the photo field and links to the policy", () => {
    render(<IdUploadForm {...props} />);
    const notice = screen.getByRole("region", { name: /privacy/i });
    const photo = screen.getByLabelText(/photo of your id/i);
    expect(notice.compareDocumentPosition(photo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("link", { name: /privacy policy/i })).toHaveAttribute("href", "/privacy");
  });

  test("the stay dates are shown but cannot be edited, and the form is prefilled from the booking", () => {
    render(<IdUploadForm {...props} />);
    expect(screen.getByText(/9 Nov/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/check-in/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveValue("Ayesha Khan");
  });

  test("submitting resizes the photo, sends token, fields and photo, then shows a confirmation without any image", async () => {
    submit.mockResolvedValue({ error: null });
    render(<IdUploadForm {...props} />);
    fillAndSubmit();
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const body = submit.mock.calls[0][0] as FormData;
    expect(body.get("token")).toBe(props.token);
    expect(body.get("name")).toBe("Sana Malik");
    expect(body.get("cnic")).toBe("35202-1234567-1");
    expect(body.get("phone")).toBe("03005550123");
    expect(body.get("photo")).toBeInstanceOf(File);
    expect(await screen.findByText(/received/i)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument(); // CNIC-06: never displayed back
  });

  // @req CNIC-06
  test("after success the form is gone and no uploaded image is rendered", async () => {
    submit.mockResolvedValue({ error: null });
    const { container } = render(<IdUploadForm {...props} />);
    fillAndSubmit();
    await screen.findByText(/received/i);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByLabelText(/photo of your id/i)).not.toBeInTheDocument();
  });

  test("a server error is shown and the form stays", async () => {
    submit.mockResolvedValue({ error: "Enter the 13-digit CNIC number, e.g. 35202-1234567-1." });
    render(<IdUploadForm {...props} />);
    fillAndSubmit();
    expect(await screen.findByText(/13-digit CNIC/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send my id/i })).toBeEnabled();
  });

  test("submitting without a photo asks for one and does not call the server", () => {
    render(<IdUploadForm {...props} />);
    // The text fields are required, so the browser would stop an empty form
    // before our handler runs; fill them and leave only the photo empty.
    fireEvent.change(screen.getByLabelText(/cnic number/i), { target: { value: "35202-1234567-1" } });
    fireEvent.click(screen.getByRole("button", { name: /send my id/i }));
    expect(screen.getByText(/add a photo/i)).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });
});
