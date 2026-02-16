const rawBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

const withScheme = (value: string) => (
  value.startsWith('http://') || value.startsWith('https://')
    ? value
    : `https://${value}`
);

export const API_BASE_URL = withScheme(rawBaseUrl);
