export type ApiRequest =
  | ApiGetSharedSpaceRequest
  | ApiListPersonalContentRequest
  | ApiListPersonalSpacesRequest;
export type ApiResponse =
  | ApiErrorResponse
  | (ApiSuccessResponseMetadata & ApiSuccessResult);
export type ApiSuccessResult =
  | ApiGetSharedSpaceResult
  | ApiListPersonalContentResult
  | ApiListPersonalSpacesResult;
export type ApiErrorResponse =
  | {
      error: "invalid-endpoint";
      endpoint: string;
    }
  | {
      error:
        | "invalid-key"
        | "missing-key"
        | "missing-key-id"
        | "missing-key-secret";
    }
  | { error: "invalid-params"; errors: ErrorFieldsResult<any, any> }
  | {
      error: "rate-limited";
    }
  | { error: "space-not-found"; spaceId: string }
  | { error: "space-access-denied"; spaceId: string }
  | { error: "internal-error" };

export type ErrorFieldsResult<T, E> = object;

export type ApiSuccessResponseMetadata = {
  error: null;
  readCount: number;
  writeCount: number;
};
export type ApiTimestamp = number; // in miliseconds
export type ApiListOrder = "asc" | "desc";
export type ApiObjectId = string;

//
// Endpoint types
//

export type ApiGetSharedSpaceRequest = {
  path: "/shared/space/get";
  method: "GET";
  params: {
    spaceId: ApiObjectId;
    withSpace?: boolean; // default: true
    withPages?: boolean;
    pagesFromWhen?: ApiTimestamp; // inclusive
    pagesToWhen?: ApiTimestamp; // non-inclusive
    // pageOrder?: ApiListOrder // always 'desc'
    maxPageCount?: number; // default: 10, max: 50
    withAnnotations?: boolean;
    // annotationOrder?: ApiListOrder
    withReplies?: boolean;
    // replyOrder?: ApiListOrder
  };
};
export type ApiGetSharedSpaceResult = {
  type: "get-shared-space-result";
  space: ApiSharedSpace | null;
  pages: ApiSharedSpacePage[];
  annotations: ApiSharedSpaceAnnotation[];
  replies: ApiSharedAnnotationReply[];
};

export type ApiListPersonalContentRequest = {
  path: "/personal/content/list";
  method: "GET";
  params: {
    withLocators?: boolean; //needed to the page urls
    contentFromWhen?: ApiTimestamp; // inclusive, default: unlimited
    contentToWhen?: ApiTimestamp; // non-inclusive, default: now
    maxContentCount?: number; // default: 10, max: 50
    withMetadata?: boolean;
    withAnnotations?: boolean;
    withSpaceEntries?: boolean;
  };
};
export type ApiListPersonalContentResult = {
  type: "personal-content-list-result";
  metadata: ApiPersonalContentMetadata[];
  locators: ApiPersonalContentLocator[];
  annotations: ApiPersonalAnnotation[];
  personalSpaceEntries: Array<ApiPersonalSpaceEntry>;
};

export type ApiListPersonalSpacesRequest = {
  path: "/personal/space/list";
  method: "GET";
  params: {
    spacesFromWhen?: ApiTimestamp; // inclusive, default: unlimited
    spacesToWhen?: ApiTimestamp; // non-inclusive, default: now
    maxSpaceCount?: number; // default: 10, max: 50
  };
};
export type ApiListPersonalSpacesResult = {
  type: "personal-space-list-result";
  personalSpaces: ApiPersonalSpace[];
};

//
// Object types
//

export type ApiSharedSpacePage = {
  type: "shared-space-page";
  normalizedPageUrl: string;
  createdWhen: ApiTimestamp;
  updatedWhen: ApiTimestamp;
  originalPageUrl: string;
  sharedSpaceId: ApiObjectId;
  creatorId: string;
  title: string;
};
export type ApiSharedSpaceAnnotation = {
  type: "shared-space-annotation";
  normalizedPageUrl: string;
  sharedSpaceId: string;
} & Omit<ApiSharedAnnotation, "type">;
export type ApiSharedAnnotation = {
  type: "shared-annotation";
  createdWhen: ApiTimestamp;
  updatedWhen: ApiTimestamp;
  sharedAnnotationId: ApiObjectId;
  creatorId: ApiObjectId;
  highlight?: string;
  comment?: ApiRichText;
  selector?: any; // more docs soon
};
export type ApiSharedAnnotationReply = {
  type: "shared-annotation-reply";
  replyId: ApiObjectId;
  sharedAnnotationId: ApiObjectId;
  sharedSpaceId: ApiObjectId;
  normalizedPageUrl: string;
  content: ApiRichText;
};
export type ApiSharedSpace = {
  type: "shared-space";
  sharedSpaceId: ApiObjectId;
  creatorId: ApiObjectId;
  title: string;
  description?: string; // markdown
};
export type ApiPersonalSpace = {
  type: "personal-space";
  createdWhen: ApiTimestamp;
  updatedWhen: ApiTimestamp;
  personalSpaceId: ApiObjectId;
  title: string;
};
export type ApiPersonalContentMetadata = {
  type: "personal-content-metadata";
  createdWhen: ApiTimestamp;
  updatedWhen: ApiTimestamp;
  personalContentId: ApiObjectId;
  canonicalUrl: string;
  title?: string;
};
export type ApiPersonalContentLocator = {
  type: "personal-content-locator";
  createdWhen: ApiTimestamp;
  updatedWhen: ApiTimestamp;
  personalContentId: ApiObjectId;
  locationType: ApiContentLocationType;
  locationScheme: ApiContentLocationSchemeType;
  format: ApiContentLocatorFormat;
  location: string;
  originalLocation: string;
};
export type ApiPersonalSpaceEntry = {
  type: "personal-space-entry";
  createdWhen: ApiTimestamp;
  updatedWhen: ApiTimestamp;
  personalContentId: ApiObjectId;
  personalSpaceId: ApiObjectId;
};
export type ApiContentLocationType = "local" | "remote" | "memex-cloud";
export type ApiContentLocatorFormat = "html" | "pdf";
export type ApiContentLocationSchemeType =
  | "normalized-url-v1"
  | "filesystem-path-v1";
export type ApiPersonalAnnotation = {
  type: "personal-annotation";
  createdWhen: ApiTimestamp;
  updatedWhen: ApiTimestamp;
  highlight?: string;
  comment?: ApiRichText;
};
export type ApiRichText = {
  // format: 'html' | 'markdown'; // may be added later
  value: string;
};
