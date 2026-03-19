import { DEFAULT_SETTINGS, mergeSettings, sanitizeSettings } from "@shared/settings";

const form = document.querySelector<HTMLFormElement>("#options-form");
const status = document.querySelector<HTMLElement>("#status");
const defaultSelectorInput = document.querySelector<HTMLInputElement>("#defaultSelector");
const highlightDurationInput = document.querySelector<HTMLInputElement>("#highlightDurationMs");
const autoScrollInput = document.querySelector<HTMLInputElement>("#autoScrollIntoView");
const enableLeadSoundInput = document.querySelector<HTMLInputElement>("#enableLeadSound");
const enableLeadNotificationsInput = document.querySelector<HTMLInputElement>("#enableLeadNotifications");
const twentyBaseUrlInput = document.querySelector<HTMLInputElement>("#twentyBaseUrl");
const twentyApiKeyInput = document.querySelector<HTMLInputElement>("#twentyApiKey");
const twentyLeadEndpointPathInput = document.querySelector<HTMLInputElement>("#twentyLeadEndpointPath");
const twentyUploadAdfAttachmentsInput = document.querySelector<HTMLInputElement>("#twentyUploadAdfAttachments");
const twentyGraphqlPathInput = document.querySelector<HTMLInputElement>("#twentyGraphqlPath");
const twentyGraphqlUploadPathInput = document.querySelector<HTMLInputElement>("#twentyGraphqlUploadPath");
const twentyAttachmentFileFieldMetadataIdInput = document.querySelector<HTMLInputElement>(
  "#twentyAttachmentFileFieldMetadataId",
);
const twentyAttachmentParentFieldInput = document.querySelector<HTMLInputElement>(
  "#twentyAttachmentParentField",
);
const twentyUploadFileFolderInput = document.querySelector<HTMLInputElement>("#twentyUploadFileFolder");
const twentyLeadFieldMapInput = document.querySelector<HTMLTextAreaElement>("#twentyLeadFieldMap");
const testConnectionButton = document.querySelector<HTMLButtonElement>("#testTwentyConnection");

function setStatus(message: string): void {
  if (status) {
    status.textContent = message;
  }
}

async function loadSettings(): Promise<void> {
  const rawSettings = await browser.storage.local.get(DEFAULT_SETTINGS);
  const settings = mergeSettings(rawSettings);

  if (defaultSelectorInput) {
    defaultSelectorInput.value = settings.defaultSelector;
  }

  if (highlightDurationInput) {
    highlightDurationInput.value = String(settings.highlightDurationMs);
  }

  if (autoScrollInput) {
    autoScrollInput.checked = settings.autoScrollIntoView;
  }

  if (enableLeadSoundInput) {
    enableLeadSoundInput.checked = settings.enableLeadSound;
  }

  if (enableLeadNotificationsInput) {
    enableLeadNotificationsInput.checked = settings.enableLeadNotifications;
  }

  if (twentyBaseUrlInput) {
    twentyBaseUrlInput.value = settings.twentyBaseUrl;
  }

  if (twentyApiKeyInput) {
    twentyApiKeyInput.value = settings.twentyApiKey;
  }

  if (twentyLeadEndpointPathInput) {
    twentyLeadEndpointPathInput.value = settings.twentyLeadEndpointPath;
  }

  if (twentyUploadAdfAttachmentsInput) {
    twentyUploadAdfAttachmentsInput.checked = settings.twentyUploadAdfAttachments;
  }

  if (twentyGraphqlPathInput) {
    twentyGraphqlPathInput.value = settings.twentyGraphqlPath;
  }

  if (twentyGraphqlUploadPathInput) {
    twentyGraphqlUploadPathInput.value = settings.twentyGraphqlUploadPath;
  }

  if (twentyAttachmentFileFieldMetadataIdInput) {
    twentyAttachmentFileFieldMetadataIdInput.value = settings.twentyAttachmentFileFieldMetadataId;
  }

  if (twentyAttachmentParentFieldInput) {
    twentyAttachmentParentFieldInput.value = settings.twentyAttachmentParentField;
  }

  if (twentyUploadFileFolderInput) {
    twentyUploadFileFolderInput.value = settings.twentyUploadFileFolder;
  }

  if (twentyLeadFieldMapInput) {
    twentyLeadFieldMapInput.value = settings.twentyLeadFieldMap;
  }

  setStatus(JSON.stringify(settings, null, 2));
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();

  void (async () => {
    const payload = sanitizeSettings({
      defaultSelector: defaultSelectorInput?.value ?? DEFAULT_SETTINGS.defaultSelector,
      highlightDurationMs: Number(highlightDurationInput?.value ?? DEFAULT_SETTINGS.highlightDurationMs),
      autoScrollIntoView: autoScrollInput?.checked ?? DEFAULT_SETTINGS.autoScrollIntoView,
      enableLeadSound: enableLeadSoundInput?.checked ?? DEFAULT_SETTINGS.enableLeadSound,
      enableLeadNotifications:
        enableLeadNotificationsInput?.checked ?? DEFAULT_SETTINGS.enableLeadNotifications,
      twentyBaseUrl: twentyBaseUrlInput?.value ?? DEFAULT_SETTINGS.twentyBaseUrl,
      twentyApiKey: twentyApiKeyInput?.value ?? DEFAULT_SETTINGS.twentyApiKey,
      twentyLeadEndpointPath:
        twentyLeadEndpointPathInput?.value ?? DEFAULT_SETTINGS.twentyLeadEndpointPath,
      twentyUploadAdfAttachments:
        twentyUploadAdfAttachmentsInput?.checked ?? DEFAULT_SETTINGS.twentyUploadAdfAttachments,
      twentyGraphqlPath: twentyGraphqlPathInput?.value ?? DEFAULT_SETTINGS.twentyGraphqlPath,
      twentyGraphqlUploadPath:
        twentyGraphqlUploadPathInput?.value ?? DEFAULT_SETTINGS.twentyGraphqlUploadPath,
      twentyAttachmentFileFieldMetadataId:
        twentyAttachmentFileFieldMetadataIdInput?.value ??
        DEFAULT_SETTINGS.twentyAttachmentFileFieldMetadataId,
      twentyAttachmentParentField:
        twentyAttachmentParentFieldInput?.value ?? DEFAULT_SETTINGS.twentyAttachmentParentField,
      twentyUploadFileFolder:
        twentyUploadFileFolderInput?.value ?? DEFAULT_SETTINGS.twentyUploadFileFolder,
      twentyLeadFieldMap:
        twentyLeadFieldMapInput?.value ?? DEFAULT_SETTINGS.twentyLeadFieldMap,
    });

    if (!payload) {
      setStatus("Unable to parse settings.");
      return;
    }

    const nextSettings = mergeSettings({
      ...(await browser.storage.local.get(DEFAULT_SETTINGS)),
      ...payload,
    });

    await browser.storage.local.set(nextSettings);
    setStatus(`Saved settings:\n${JSON.stringify(nextSettings, null, 2)}`);
  })();
});

testConnectionButton?.addEventListener("click", () => {
  setStatus("Testing Twenty CRM connection...");

  void browser.runtime
    .sendMessage({ type: "testTwentyConnection" })
    .then((result: { ok: boolean; message: string }) => {
      setStatus(result.message);
    })
    .catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : "Failed to test Twenty CRM connection.");
    });
});

void loadSettings();
