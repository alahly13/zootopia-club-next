import type { Locale } from "@zootopia/shared-types";
import {
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";
import countryLabelsAr from "react-phone-number-input/locale/ar.json";
import countryLabelsEn from "react-phone-number-input/locale/en.json";

export const DEFAULT_PHONE_COUNTRY_ISO2 = "EG";

export type ProfileCountryOption = {
  iso2: string;
  label: string;
  canonicalLabel: string;
  callingCode: string;
  flag: string;
  searchTokens: string[];
};

function normalizeCountryValue(value: string) {
  return String(value || "").trim().toLocaleLowerCase();
}

export function buildCountryFlagEmoji(iso2: string) {
  const normalized = String(iso2 || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return "";
  }

  const firstCodePoint = normalized.codePointAt(0);
  const secondCodePoint = normalized.codePointAt(1);
  if (!firstCodePoint || !secondCodePoint) {
    return "";
  }

  return String.fromCodePoint(firstCodePoint + 127397, secondCodePoint + 127397);
}

/* Settings country selectors intentionally use the phone library's own country catalog and
   locale packs so the phone input, nationality, and origin selectors stay aligned on one
   stable dataset instead of drifting across multiple competing country sources. */
export function buildProfileCountryOptions(locale: Locale) {
  const localizedCountryLabels = locale === "ar" ? countryLabelsAr : countryLabelsEn;
  const collator = new Intl.Collator(locale === "ar" ? "ar" : "en", {
    sensitivity: "base",
  });

  return getCountries()
    .map((iso2) => {
      const canonicalLabel =
        countryLabelsEn[iso2 as keyof typeof countryLabelsEn] ?? iso2;
      const localizedLabel =
        localizedCountryLabels[iso2 as keyof typeof localizedCountryLabels] ??
        canonicalLabel;
      const callingCode = getCountryCallingCode(iso2 as CountryCode);

      return {
        iso2,
        label: localizedLabel,
        canonicalLabel,
        callingCode,
        flag: buildCountryFlagEmoji(iso2),
        searchTokens: [
          iso2,
          canonicalLabel,
          localizedLabel,
          `+${callingCode}`,
        ],
      } satisfies ProfileCountryOption;
    })
    .sort((left, right) => {
      if (left.iso2 === DEFAULT_PHONE_COUNTRY_ISO2 && right.iso2 !== DEFAULT_PHONE_COUNTRY_ISO2) {
        return -1;
      }

      if (right.iso2 === DEFAULT_PHONE_COUNTRY_ISO2 && left.iso2 !== DEFAULT_PHONE_COUNTRY_ISO2) {
        return 1;
      }

      return collator.compare(left.label, right.label);
    });
}

export function resolveProfileCountryOption(
  options: ProfileCountryOption[],
  iso2: string,
) {
  return (
    options.find((option) => option.iso2 === String(iso2 || "").toUpperCase()) ||
    options.find((option) => option.iso2 === DEFAULT_PHONE_COUNTRY_ISO2) ||
    options[0]
  );
}

export function findProfileCountryOptionByCanonicalLabel(
  options: ProfileCountryOption[],
  value: string,
) {
  const normalizedValue = normalizeCountryValue(value);
  if (!normalizedValue) {
    return null;
  }

  return (
    options.find(
      (option) => normalizeCountryValue(option.canonicalLabel) === normalizedValue,
    ) ?? null
  );
}
