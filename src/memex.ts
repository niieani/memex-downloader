import * as fs from "fs/promises";
import {
  ApiListPersonalContentResult,
  ApiListPersonalSpacesResult,
  ApiPersonalSpace,
} from "./types";
import { uniqBy } from "remeda";

const memexDomain = "memex.social";

// The state file path
const stateFilePath = "./state.json";

// Fetch all personal spaces
async function fetchAllPersonalSpaces(): Promise<ApiPersonalSpace[]> {
  let spaces: ApiPersonalSpace[] = [];
  let toWhen = Math.floor(Date.now());

  let lastSpace: ApiPersonalSpace | null = null;

  while (true) {
    const url = `https://${memexDomain}/api/personal/space/list?spacesToWhen=${toWhen}&maxSpaceCount=50`;
    console.log(`making a request to`, url);

    const response = await fetch(url, {
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
    if (prevLastSpace?.updatedWhen === lastSpace.updatedWhen) {
      console.error(
        "The API result of the next page returned the same result as the previous page. This is likely a bug in the Memex API. The last space returned previously was:",
        prevLastSpace,
        `whereas the last space returned in the current page is:`,
        lastSpace
      );
      throw new Error("Cannot continue, because we would loop forever.");
      break;
    } else {
      toWhen = lastSpace.updatedWhen;
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
    const response = await fetch(
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
async function saveData(
  data: ApiListPersonalContentResult,
  personalSpaces: ApiPersonalSpace[]
) {
  const format = "json";
  const basePath = "./json-output";
  await fs.mkdir(basePath, { recursive: true });

  for (const locator of data.locators) {
    const fileName = `${locator.personalContentId}.${format}`;
    const filePath = `${basePath}/${fileName}`;

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
    // const annotations = data.annotations.filter(
    //   (annotation) => annotation.personalContentId === locator.personalContentId
    // );

    const combinedData = {
      content: locator,
      metadata,
      spaceEntries,
      // annotations,
    };
    await fs.writeFile(filePath, JSON.stringify(combinedData, null, 2));
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
  let toWhen = lastFetchedDate || Math.floor(Date.now());

  while (true) {
    const data = await fetchPersonalContent(toWhen);
    if (!data || data.metadata.length === 0) {
      break;
    }

    await saveData(data, personalSpaces);

    toWhen = data.metadata[data.metadata.length - 1].updatedWhen;

    console.log(`Fetched data until ${toWhen}`);
    saveState(toWhen);
  }
}

main().catch(console.error);
