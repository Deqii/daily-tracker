declare module 'node:fs' {
  interface Dirent {
    readonly name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  }

  function readFileSync(path: string | URL, encoding: 'utf8'): string;
  function readdirSync(path: string, options: { withFileTypes: true }): Dirent[];
  function writeFileSync(path: string | URL, data: string): void;
}

declare module 'node:path' {
  function join(...parts: string[]): string;
  function relative(from: string, to: string): string;
}

declare module 'node:url' {
  function fileURLToPath(url: string | URL): string;
}
