import { isSignedIn, type NewApplication, saveApplication } from "./api";
import { type ExtractedJob, extractJob } from "./extract";

// Set at build time (build.mjs): the web app's address.
declare const __APP_URL__: string;
const APP_URL = __APP_URL__;

const t = (key: string): string => chrome.i18n.getMessage(key) || key;

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`#${id} is missing from popup.html`);
  return found as T;
}

function show(view: "loading" | "signed-out" | "form" | "saved"): void {
  for (const section of Array.from(document.querySelectorAll<HTMLElement>("[data-view]"))) {
    section.hidden = section.dataset.view !== view;
  }
}

/** The tab to read: the one the popup was opened over. (`?tab=` is for the tests, which
 * open the popup as a page of its own.) */
async function targetTab(): Promise<chrome.tabs.Tab | undefined> {
  const requested = Number(new URLSearchParams(location.search).get("tab"));
  if (requested) return chrome.tabs.get(requested);
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  return active;
}

/** Reads the job from the page. Only now, when the user opened the popup: the
 * activeTab permission allows nothing else. */
async function readJob(): Promise<{ job: ExtractedJob; read: boolean }> {
  const tab = await targetTab();
  const empty: ExtractedJob = { company: "", role_title: "", job_url: "", source: "other", job_description: "" };
  if (tab?.id === undefined || !tab.url || !/^https?:/.test(tab.url)) return { job: empty, read: false };
  try {
    const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractJob });
    const job = injection?.result as ExtractedJob | undefined;
    if (job) return { job, read: Boolean(job.company || job.role_title) };
  } catch {
    // Pages the browser protects (the Web Store, other extensions) can't be read.
  }
  return { job: { ...empty, job_url: tab.url }, read: false };
}

function translatePage(): void {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  document.documentElement.dir = chrome.i18n.getMessage("@@bidi_dir") || "ltr";
  for (const node of Array.from(document.querySelectorAll<HTMLElement>("[data-i18n]"))) {
    node.textContent = t(node.dataset.i18n ?? "");
  }
}

async function main(): Promise<void> {
  translatePage();
  show("loading");

  const signIn = element<HTMLAnchorElement>("sign-in");
  signIn.href = `${APP_URL}/login`;
  const [signedIn, { job, read }] = await Promise.all([isSignedIn(APP_URL), readJob()]);
  if (signedIn === false) {
    show("signed-out");
    return;
  }

  const form = element<HTMLFormElement>("form");
  const company = element<HTMLInputElement>("company");
  const role = element<HTMLInputElement>("role");
  const link = element<HTMLInputElement>("link");
  const status = element<HTMLSelectElement>("status");
  const includeDescription = element<HTMLInputElement>("description");
  const message = element<HTMLParagraphElement>("message");
  const submit = element<HTMLButtonElement>("save");

  company.value = job.company;
  role.value = job.role_title;
  link.value = job.job_url;
  // Too long to show here: the user reads and edits it on the website.
  element<HTMLLabelElement>("description-row").hidden = !job.job_description;
  const note = (key: string | null, kind: "info" | "error" = "info") => {
    message.textContent = key ? t(key) : "";
    message.dataset.kind = kind;
    message.hidden = !key;
  };
  note(signedIn === null ? "errorNetwork" : read ? null : "unreadable", signedIn === null ? "error" : "info");
  show("form");
  (company.value ? role : company).focus();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled = true;
    submit.textContent = t("saving");
    const application: NewApplication = {
      company: company.value.trim(),
      role_title: role.value.trim(),
      job_url: link.value.trim(),
      source: job.source,
      job_description: includeDescription.checked ? job.job_description : "",
      status: status.value === "wishlist" ? "wishlist" : "applied",
    };
    const result = await saveApplication(APP_URL, application);
    submit.disabled = false;
    submit.textContent = t("save");
    if (result.ok) {
      element<HTMLAnchorElement>("open").href = `${APP_URL}/applications/${result.id}`;
      show("saved");
      return;
    }
    if (result.error === "not_signed_in") {
      show("signed-out");
      return;
    }
    note(
      { invalid: "errorInvalid", network: "errorNetwork", unknown: "errorUnknown" }[result.error],
      "error",
    );
  });
}

void main();
