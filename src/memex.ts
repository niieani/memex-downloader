import * as fs from "fs/promises";
import {
  ApiListPersonalContentResult,
  ApiListPersonalSpacesResult,
  ApiPersonalAnnotation,
  ApiPersonalSpace,
} from "./types.js";
import { uniqBy } from "remeda";
import { createCachedFetch } from "./localCachedFetch.js";
import { formatDateToYYYYMM, formatDateToYYYYMMDD } from "./date.js";
import filenamify from "filenamify";

const memexDomain = "memex.social";

// The state file path
const stateFilePath = "./state.json";

const cachedFetch = createCachedFetch("./cache");

const toWhenStart = process.env.START_TIMESTAMP
  ? Number(process.env.START_TIMESTAMP)
  : Math.floor(Date.now());

// Fetch all personal spaces
async function fetchAllPersonalSpaces(): Promise<ApiPersonalSpace[]> {
  let spaces: ApiPersonalSpace[] = [];
  let toWhen = toWhenStart;

  let lastSpace: ApiPersonalSpace | null = null;

  while (true) {
    const url = `https://${memexDomain}/api/personal/space/list?spacesToWhen=${toWhen}&maxSpaceCount=50`;
    console.log(`making a request to`, url);

    const response = await cachedFetch(url, {
      headers: {
        "X-Memex-Personal-Key-ID": process.env.MEMEX_KEY_ID!,
        "X-Memex-Personal-Key-Secret": process.env.MEMEX_KEY_SECRET!,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ApiListPersonalSpacesResult = await response.json();
    if (data.personalSpaces.length === 0) {
      break;
    }

    console.log(`Fetched ${data.personalSpaces.length} spaces`);
    // console.log(data.personalSpaces);

    spaces = spaces.concat(data.personalSpaces);

    const prevLastSpace = lastSpace;
    lastSpace = data.personalSpaces[data.personalSpaces.length - 1];
    if (prevLastSpace?.createdWhen === lastSpace.createdWhen) {
      console.error(
        "The API result of the next page returned the same result as the previous page. This is likely a bug in the Memex API. The last space returned previously was:",
        prevLastSpace,
        `whereas the last space returned in the current page is:`,
        lastSpace
      );
      throw new Error("Cannot continue, because we would loop forever.");
      break;
    } else {
      toWhen = lastSpace.createdWhen;
    }

    console.log(`next page before ${new Date(toWhen)}, ${toWhen}`);
  }

  const allSpaces = uniqBy(spaces, (space) => space.personalSpaceId);
  console.log(`Fetched all ${allSpaces.length} spaces`);
  return allSpaces;
}

// Fetch personal content
async function fetchPersonalContent(
  toWhen: number
): Promise<ApiListPersonalContentResult | null> {
  try {
    const response = await cachedFetch(
      `https://${memexDomain}/api/personal/content/list?contentToWhen=${toWhen}&maxContentCount=50&withMetadata=true&withAnnotations=true&withLocators=true&withPersonalSpaceIds=true`,
      {
        headers: {
          "X-Memex-Personal-Key-ID": process.env.MEMEX_KEY_ID!,
          "X-Memex-Personal-Key-Secret": process.env.MEMEX_KEY_SECRET!,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as ApiListPersonalContentResult;
    // console.log(data);
    console.log(`Fetched ${data.metadata.length} metadata values`);

    return data;
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
}

// Save data to files
async function saveJsonData(
  data: ApiListPersonalContentResult,
  personalSpaces: ApiPersonalSpace[],
  basePath = "./json-output"
) {
  for (const locator of data.locators) {
    const fileName = `${locator.personalContentId}.json`;
    const folderPrefix = formatDateToYYYYMM(locator.createdWhen);
    const targetFolder = `${basePath}/${folderPrefix}`;
    await fs.mkdir(targetFolder, { recursive: true });
    const filePath = `${targetFolder}/${fileName}`;

    const metadata = data.metadata.filter(
      (metadata) => metadata.personalContentId === locator.personalContentId
    );
    const spaceEntries = data.personalSpaceEntries
      .filter((entry) => entry.personalContentId === locator.personalContentId)
      .map((entry) => {
        const space = personalSpaces.find(
          (space) => space.personalSpaceId === entry.personalSpaceId
        );
        return {
          ...entry,
          personalSpace: space,
        };
      });

    console.log(
      `Entry`,
      locator.location,
      `with ${spaceEntries.length} spaces and ${metadata.length} metadata values`
    );

    const combinedData = {
      content: locator,
      metadata,
      spaceEntries,
    };
    await fs.writeFile(filePath, JSON.stringify(combinedData, null, 2));
  }
}

async function saveAnnotationsJson(
  annotations: ApiPersonalAnnotation[],
  basePath = "./json-output"
) {
  const annotationsFileName = `annotations.json`;
  const annotationsFilePath = `${basePath}/${annotationsFileName}`;
  await fs.writeFile(annotationsFilePath, JSON.stringify(annotations, null, 2));
}

async function saveMarkdownData(
  data: ApiListPersonalContentResult,
  personalSpaces: ApiPersonalSpace[],
  basePath = "./markdown-output"
) {
  // Process each locator (bookmark)
  for (const locator of data.locators) {
    const dateFolder = formatDateToYYYYMM(locator.createdWhen);
    const bookmarkDirPath = `${basePath}/${dateFolder}`;
    await fs.mkdir(bookmarkDirPath, { recursive: true });

    // Combine data for the bookmark
    const metadata = data.metadata.find(
      (m) => m.personalContentId === locator.personalContentId
    );
    const spaceEntries = data.personalSpaceEntries
      .filter((entry) => entry.personalContentId === locator.personalContentId)
      .map((entry) => ({
        ...entry,
        spaceName: personalSpaces.find(
          (space) => space.personalSpaceId === entry.personalSpaceId
        )?.title,
      }));

    // Markdown content for the bookmark
    const title = metadata?.title || locator.personalContentId;
    const filenameFriendlyTitle = getEntryFilename(
      title,
      locator.location,
      locator.personalContentId
    );
    const bookmarkFilePath = `${bookmarkDirPath}/${filenameFriendlyTitle}.md`;

    let markdownContent = `---\n`;
    markdownContent += `Title: ${title.replaceAll("\n", " ")}\n`;
    markdownContent += `Url: ${locator.originalLocation}\n`;
    markdownContent += `Created at: [[${formatDateToYYYYMMDD(
      locator.createdWhen
    )}]]\n`;
    markdownContent += `Updated at: [[${formatDateToYYYYMMDD(
      locator.updatedWhen
    )}]]\n`;
    markdownContent += `Type: ${locator.locationType}\n`;
    markdownContent += `Format: ${locator.format}\n`;
    markdownContent += `Memex Personal Content ID: ${locator.personalContentId}\n`;
    if (metadata?.canonicalUrl) {
      markdownContent += `Canonical Url: ${metadata.canonicalUrl}\n`;
    }

    // Spaces
    if (spaceEntries.length > 0) {
      markdownContent += `Spaces:\n`;

      spaceEntries.forEach((entry) => {
        markdownContent += `- "[[${entry.spaceName}]]"\n`;
      });
    }

    markdownContent += `---\n\n`;
    markdownContent += `## Details\n`;
    markdownContent += `Created at: ${new Date(
      locator.createdWhen
    ).toISOString()}\n`;
    markdownContent += `Updated at: ${new Date(
      locator.updatedWhen
    ).toISOString()}\n\n`;
    if (spaceEntries.length > 0) {
      markdownContent += `## Spaces\n`;
      spaceEntries.forEach((entry) => {
        if (!entry.spaceName) {
          return;
        }
        markdownContent += `- [${entry.spaceName}](../spaces/${filenameFriendly(
          entry.spaceName
        )}.md)\n`;
      });
    }

    // Write bookmark file
    await fs.writeFile(bookmarkFilePath, markdownContent);
  }
}

function getEntryFilename(
  title: string | undefined,
  fallback: string | undefined,
  id: string
) {
  return (
    (title && filenameFriendly(title)) ||
    (fallback && filenameFriendly(fallback)) ||
    id
  ).trim();
}

function filenameFriendly(title: string) {
  return filenamify(title, {
    replacement: " ",
  }).replace(/ +/g, " ");
}

async function saveMarkdownSpaceData(
  personalSpaces: ApiPersonalSpace[],
  data: ApiListPersonalContentResult,
  basePath = "./markdown-output"
) {
  const spacesBasePath = `${basePath}/spaces`;
  await fs.mkdir(spacesBasePath, { recursive: true });

  // Process each personal space
  for (const space of personalSpaces) {
    const spaceFilePath = `${spacesBasePath}/${filenameFriendly(
      space.title
    )}.md`;

    // Markdown content for the space
    let markdownContent = `---\n`;
    markdownContent += `Title: ${space.title}\n`;
    markdownContent += `Memex Space ID: ${space.personalSpaceId}\n`;
    markdownContent += `Type: ${space.type}\n`;
    markdownContent += `Created at: [[${formatDateToYYYYMMDD(
      space.createdWhen
    )}]]\n`;
    markdownContent += `Updated at: [[${formatDateToYYYYMMDD(
      space.updatedWhen
    )}]]\n`;

    // Bookmarks in this space
    const bookmarksInSpace = data.personalSpaceEntries
      .filter((entry) => entry.personalSpaceId === space.personalSpaceId)
      .map((entry) => {
        const metadata = data.metadata.find(
          (m) => m.personalContentId === entry.personalContentId
        );
        const locator = data.locators.find(
          (l) => l.personalContentId === entry.personalContentId
        );

        const dateFolder = formatDateToYYYYMM(entry.createdWhen);
        const filenameFriendlyTitle = getEntryFilename(
          metadata?.title,
          locator?.location,
          entry.personalContentId
        );
        return {
          ...entry,
          metadata,
          locator,
          filenameFriendlyTitle,
          link: `../${dateFolder}/${filenameFriendlyTitle}.md`,
        };
      });

    if (bookmarksInSpace.length > 0) {
      markdownContent += `Links:\n`;

      bookmarksInSpace.forEach((entry) => {
        if (entry.locator) {
          markdownContent += `- "[[${entry.filenameFriendlyTitle}]]"\n`;
        }
      });
    }

    markdownContent += `---\n\n`;
    markdownContent += `## Details\n`;

    markdownContent += `Created: ${new Date(
      space.createdWhen
    ).toISOString()}\n`;
    markdownContent += `Updated: ${new Date(
      space.updatedWhen
    ).toISOString()}\n\n`;

    if (bookmarksInSpace.length > 0) {
      markdownContent += `## Links\n`;

      bookmarksInSpace.forEach((entry) => {
        if (entry.locator) {
          markdownContent += `- [${entry.filenameFriendlyTitle}](${entry.locator.originalLocation})\n`;
        }
      });
    }

    // Write space file
    await fs.writeFile(spaceFilePath, markdownContent);
  }
}

// Load the last fetched date from state
async function loadState(): Promise<number> {
  try {
    if (await fs.stat(stateFilePath)) {
      const state = JSON.parse(await fs.readFile(stateFilePath, "utf8"));
      return state.lastFetchedDate;
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

// Save the last fetched date to state
async function saveState(state: number) {
  try {
    await fs.writeFile(
      stateFilePath,
      JSON.stringify({ lastFetchedDate: state }, null, 2)
    );
  } catch (error) {
    console.error("Error saving state:", error);
  }
}

// Main function
async function main() {
  const personalSpaces = await fetchAllPersonalSpaces();
  let lastFetchedDate = await loadState();
  let toWhen = lastFetchedDate || toWhenStart;
  let allData: ApiListPersonalContentResult = {
    annotations: [],
    locators: [],
    metadata: [],
    personalSpaceEntries: [],
    type: "personal-content-list-result",
  };

  while (true) {
    const data = await fetchPersonalContent(toWhen);
    if (!data || data.metadata.length === 0) {
      break;
    }

    allData.annotations.push(...data.annotations);
    allData.locators.push(...data.locators);
    allData.metadata.push(...data.metadata);
    allData.personalSpaceEntries.push(...data.personalSpaceEntries);

    await saveJsonData(data, personalSpaces);
    await saveMarkdownData(data, personalSpaces);

    toWhen = data.metadata[data.metadata.length - 1].updatedWhen;

    console.log(`Fetched data until ${toWhen}`);
    saveState(toWhen);
  }

  await Promise.all([
    saveAnnotationsJson(allData.annotations),
    saveMarkdownSpaceData(personalSpaces, allData),
  ]);
}

main().catch(console.error);
