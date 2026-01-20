import { ALERT_CATEGORIES, ALERT_PRESETS, DEFAULT_THRESHOLD_FORM, DEFAULT_EMAIL_SETTINGS } from "./alertConstants";
import type { ThresholdFormData, EmailAlertSettings } from "../types";
import { formatDate } from "@/lib/formatters";

export function getCategoryLabel(category: string): string {
  return ALERT_CATEGORIES.find((c) => c.value === category)?.label || category;
}

export function formatAlertDate(dateString: string | null): string {
  if (!dateString) {return "—";}
  return formatDate(dateString);
}

export function getPresetByKey(key: string) {
  return ALERT_PRESETS.find(p => p.key === key);
}

export function applyPresetToForm(presetKey: string): Partial<ThresholdFormData> {
  const preset = getPresetByKey(presetKey);
  if (!preset) {return {};}
  return {
    key: preset.key,
    name: preset.name,
    category: preset.category,
    thresholdValue: preset.thresholdValue,
    thresholdUnit: preset.thresholdUnit,
  };
}

export function createDefaultThresholdForm(): ThresholdFormData {
  return { ...DEFAULT_THRESHOLD_FORM };
}

export function createDefaultEmailSettings(): Partial<EmailAlertSettings> {
  return { ...DEFAULT_EMAIL_SETTINGS };
}

export function isEmailServiceConnected(settings: EmailAlertSettings | undefined): boolean {
  if (!settings) {return false;}
  return settings.emailEnabled && (settings.hasApiKey || settings.hasSmtpPassword);
}

export function getProviderDisplayName(provider: EmailAlertSettings["provider"]): string {
  switch (provider) {
    case "sendgrid":
      return "SendGrid";
    case "smtp":
      return "SMTP Server";
    case "aws_ses":
      return "AWS SES";
    default:
      return provider.toUpperCase();
  }
}

export function prepareSettingsPayload(
  formData: Partial<EmailAlertSettings>,
  apiKey?: string,
  smtpPassword?: string
): Partial<EmailAlertSettings> & { apiKey?: string; smtpPassword?: string } {
  const payload: Partial<EmailAlertSettings> & { apiKey?: string; smtpPassword?: string } = {
    ...formData,
  };
  if (apiKey) {payload.apiKey = apiKey;}
  if (smtpPassword) {payload.smtpPassword = smtpPassword;}
  return payload;
}
