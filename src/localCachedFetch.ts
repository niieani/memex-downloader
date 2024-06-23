import { promises as fs } from "fs";
import path from "path";
import { URL } from "url";

type FetchFunction = (
  url: RequestInfo,
  init?: RequestInit
) => Promise<Response>;

export function createCachedFetch(cacheFolder: string): FetchFunction {
  return async (url: RequestInfo, init?: RequestInit) => {
    const cacheFilePath = path.join(
      cacheFolder,
      getCacheFilePath(url.toString())
    );

    // Check if the response is already cached
    try {
      const cachedResponse = await fs.readFile(cacheFilePath, "utf-8");
      return new Response(cachedResponse, {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      // Fetch the response
      const response = await fetch(url, init);
      const responseJson = await response.json();

      // Cache the response
      await fs.mkdir(path.dirname(cacheFilePath), { recursive: true });
      const responseBody = JSON.stringify(responseJson, null, 2);
      await fs.writeFile(cacheFilePath, responseBody);

      return new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
  };
}

function getCacheFilePath(urlString: string): string {
  const url = new URL(urlString);
  const domain = url.hostname;
  const pathSegments = url.pathname
    .split("/")
    .filter((segment) => segment.length > 0);
  const encodedSegments = pathSegments.map((segment) =>
    encodeURIComponent(segment)
  );
  const queryString = url.search; // Extracting the query string
  const encodedQueryString = encodeURIComponent(queryString); // Encoding the query string

  // If there is a query string, append it as the last part of the file path
  const fileName =
    queryString.length > 0 ? `${encodedQueryString}.json` : "index.json";

  return path.join(domain, ...encodedSegments, fileName);
}
