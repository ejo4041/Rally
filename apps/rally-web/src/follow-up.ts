import type { Meeting, Report } from "./api.ts";
type Outcome = Report["actions"][number];
const statuses = {
  reported_agreement: "Reported agreement",
  proposal: "Proposal",
  unresolved: "Unresolved",
};
export const MAX_DRAFT_LENGTH = 1500;
export function draftFollowUp(title: string, rows: Outcome[]) {
  if (!rows.length) return "";
  return (
    `Rally follow-up — ${title}\n\n` +
    rows
      .map(
        (row) =>
          `[${statuses[row.status]}] ${row.text}\nOwner: ${row.owner || "Unresolved"} · Due: ${row.dueDate || "Unresolved"}`,
      )
      .join("\n\n")
  );
}
export function whatsappDraftUrl(text: string) {
  text = text.trim();
  if (!text || text.length > MAX_DRAFT_LENGTH) return null;
  const url = new URL("https://wa.me/");
  url.searchParams.set("text", text);
  return url.href;
}
export function setupFollowUp(current: () => Meeting | undefined) {
  const dialog = document.getElementById(
    "follow-up-dialog",
  ) as HTMLDialogElement;
  const choices = document.getElementById("follow-up-choices")!;
  const text = document.getElementById("follow-up-text") as HTMLTextAreaElement;
  const link = document.getElementById(
    "follow-up-whatsapp",
  ) as HTMLAnchorElement;
  const status = document.getElementById("follow-up-status")!;
  const warning = document.getElementById("follow-up-warning")!;
  const copy = document.getElementById("follow-up-copy") as HTMLButtonElement;
  let sourceId = "",
    sourceReport = "";
  const signature = (m: Meeting) =>
    JSON.stringify({
      report: m.report,
      labels: m.speakerNames,
      stale: !!m.reportStale,
    });
  function reset() {
    choices.replaceChildren();
    text.value = "";
    link.removeAttribute("href");
    link.setAttribute("aria-disabled", "true");
    copy.disabled = true;
    status.textContent = "";
    warning.textContent = "";
    sourceId = "";
    sourceReport = "";
  }
  function clear() {
    dialog.close();
    reset();
  }
  function update() {
    const url = whatsappDraftUrl(text.value);
    if (url) link.href = url;
    else link.removeAttribute("href");
    link.setAttribute("aria-disabled", String(!url));
    copy.disabled = !url;
    status.textContent =
      `${text.value.length}/${MAX_DRAFT_LENGTH} characters` +
      (text.value.length > MAX_DRAFT_LENGTH
        ? " · Shorten the draft to open WhatsApp."
        : "");
  }
  text.oninput = update;
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(text.value);
      status.textContent = "Draft copied. Review the recipient before sending.";
    } catch {
      status.textContent =
        "Select the draft text and copy it using your browser.";
    }
  };
  dialog.addEventListener("close", () => {
    if (!dialog.open) reset();
  });
  document.getElementById("draft-follow-up")!.onclick = () => {
    clear();
    const m = current();
    if (!m?.report || m.reportStatus !== "ready" || m.phase === "live") return;
    sourceId = m.id;
    sourceReport = signature(m);
    const rows = [...m.report.decisions, ...m.report.actions];
    warning.textContent = m.reportStale
      ? "The meeting changed after analysis. Conclusions may contain older names or omit newer speech; review the draft before sharing."
      : "";
    if (!rows.length)
      choices.textContent =
        "No decision or action rows. You can write a follow-up below.";
    rows.forEach((row) => {
      const label = document.createElement("label");
      label.className = "check";
      const check = document.createElement("input");
      check.type = "checkbox";
      const caption = document.createElement("span");
      caption.textContent = `${statuses[row.status]} · ${row.text}`;
      label.append(check, caption);
      choices.append(label);
      check.onchange = () => {
        const selected = [
          ...choices.querySelectorAll<HTMLInputElement>("input"),
        ].flatMap((item, i) => (item.checked ? [rows[i]] : []));
        text.value = draftFollowUp(m.title, selected);
        update();
      };
    });
    update();
    dialog.showModal();
  };
  return {
    clear,
    validate() {
      const m = current();
      if (
        sourceId &&
        (m?.id !== sourceId ||
          m.reportStatus !== "ready" ||
          m.phase === "live" ||
          signature(m) !== sourceReport)
      )
        clear();
    },
  };
}
