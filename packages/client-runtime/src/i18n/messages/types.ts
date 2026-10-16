/** Plural forms keyed by Intl.PluralRules category; `other` is the fallback. */
export type PluralMessage = {
  readonly one?: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
};

export type Message = string | PluralMessage;

export type CatalogNamespace = { readonly [key: string]: Message };

/** A catalog that may lack keys, as the translator sees it at runtime. */
export type Catalog = { readonly [namespace: string]: CatalogNamespace };
