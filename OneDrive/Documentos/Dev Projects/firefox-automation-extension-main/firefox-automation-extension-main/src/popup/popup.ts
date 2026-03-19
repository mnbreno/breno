import type {
  AutomationAction,
  AutomationResult,
  ExtensionRequest,
} from "@shared/messages";
import { DEFAULT_SETTINGS, mergeSettings, type ExtensionSettings } from "@shared/settings";

const selectorInput = document.querySelector<HTMLInputElement>("#selector");
const valueInput = document.querySelector<HTMLTextAreaElement>("#value");
const resultOutput = document.querySelector<HTMLElement>("#result");
const actionButtons = document.querySelectorAll<HTMLButtonElement>("[data-action]");

function renderResult(value: unknown): void {
  if (!resultOutput) {
    return;
  }

  resultOutput.textContent =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

async function sendMessage<T>(message: ExtensionRequest): Promise<T> {
  return browser.runtime.sendMessage(message) as Promise<T>;
}

async function loadSettings(): Promise<void> {
  const settings = mergeSettings(
    await sendMessage<Partial<ExtensionSettings>>({ type: "getSettings" }),
  );

  if (selectorInput && !selectorInput.value) {
    selectorInput.value = settings.defaultSelector || DEFAULT_SETTINGS.defaultSelector;
  }
}

async function handleAction(action: AutomationAction): Promise<void> {
  const response = await sendMessage<AutomationResult>({
    type: "runAutomation",
    command: {
      action,
      selector: selectorInput?.value.trim(),
      value: valueInput?.value,
    },
  });

  renderResult(response);
}

for (const button of actionButtons) {
  button.addEventListener("click", () => {
    const action = button.dataset.action as AutomationAction | undefined;

    if (!action) {
      return;
    }

    void handleAction(action);
  });
}

void loadSettings().then(() => {
  renderResult("Ready. Choose an action to automate the active page.");
});
