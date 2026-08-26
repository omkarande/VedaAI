export const MODEL: string;
export function hasApiKey(): boolean;
export function generateJson(args: {
  prompt: string;
  pages: { page: number; dataUrl: string }[];
  schema: unknown;
}): Promise<Record<string, unknown>>;
export function boxToRegion(
  page: number,
  box: unknown,
): {
  page: number;
  top: number;
  left: number;
  width: number;
  height: number;
} | null;
