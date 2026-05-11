import http from 'node:http';

export interface CdpTarget {
  id: string;
  title: string;
  url: string;
  type: string;
  webSocketDebuggerUrl: string;
}

export function discoverTargets(port: number): Promise<CdpTarget[]> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}/json`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data) as CdpTarget[]);
        } catch {
          reject(new Error('Failed to parse CDP targets'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`Timeout connecting to CDP on port ${port}`));
    });
  });
}

export function findPageTarget(targets: CdpTarget[], url?: string): CdpTarget | undefined {
  // Filter out internal browser pages (devtools://, chrome://, about:, etc.)
  const pages = targets.filter(
    (t) => t.type === 'page' && (t.url.startsWith('http://') || t.url.startsWith('https://')),
  );
  if (url) {
    return pages.find((t) => t.url.startsWith(url)) ?? pages[0];
  }
  return pages[0];
}
