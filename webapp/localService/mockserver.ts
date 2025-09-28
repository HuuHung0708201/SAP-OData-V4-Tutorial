// mockserver.ts
import JSONModel from "sap/ui/model/json/JSONModel";
import sinon from "sinon";
import Log from "sap/base/Log";

type XhrLike = any;

let oSandbox: sinon.SinonSandbox | null = sinon.createSandbox();
let aUsers: any[] = []; // The array that holds the cached user data
let sMetadata: string = ""; // The string that holds the cached mock service metadata
const sNamespace: string = "sap/ui/core/tutorial/odatav4";
// Component for writing logs into the console
const sLogComponent: string = "sap.ui.core.tutorial.odatav4.mockserver";
const rBaseUrl: RegExp = /services.odata.org\/TripPinRESTierService/;

export default {
  /**
   * Creates a Sinon fake service, intercepting all http requests to
   * the URL defined in variable sBaseUrl above.
   * @returns{Promise} a promise that is resolved when the mock server is started
   */
  init(): Promise<void> {
    // Read the mock data
    return readData().then(() => {
      // Initialize the sinon fake server
      if (!oSandbox) {
        oSandbox = sinon.createSandbox();
      }
      oSandbox!.useFakeServer();
      // Make sure that requests are responded to automatically. Otherwise we would need
      // to do that manually.
      // @ts-ignore - server exists on sandbox at runtime
      oSandbox.server.autoRespond = true;

      // Register the requests for which responses should be faked.
      // @ts-ignore
      oSandbox.server.respondWith(rBaseUrl, handleAllRequests);

      // Apply a filter to the fake XmlHttpRequest.
      // Otherwise, ALL requests (e.g. for the component, views etc.) would be
      // intercepted.
      // @ts-ignore
      sinon.FakeXMLHttpRequest.useFilters = true;
      // @ts-ignore
      sinon.FakeXMLHttpRequest.addFilter(function (_sMethod: string, sUrl: string) {
        // If the filter returns true, the request will NOT be faked.
        // We only want to fake requests that go to the intended service.
        return !rBaseUrl.test(sUrl);
      });

      // Set the logging level for console entries from the mock server
      Log.setLevel(Log.Level.INFO, sLogComponent);

      Log.info("Running the app with mock data", sLogComponent);
    });
  },

  /**
   * Stops the request interception and deletes the Sinon fake server.
   */
  stop(): void {
    // @ts-ignore
    sinon.FakeXMLHttpRequest.filters = [];
    // @ts-ignore
    sinon.FakeXMLHttpRequest.useFilters = false;
    if (oSandbox) {
      oSandbox.restore();
      oSandbox = null;
    }
  }
};

/**
 * Returns the base URL from a given URL.
 * @param {string} sUrl - the complete URL
 * @returns {string} the base URL
 */
function getBaseUrl(sUrl: string): string {
  // try to match the common TripPin style with session - fallback to generic origin
  const aMatches = sUrl.match(/http.+\(S\(.+\)\)\//);
  if (Array.isArray(aMatches) && aMatches.length >= 1) {
    return aMatches[0];
  }
  // fallback to protocol + host + path until service root (best effort)
  try {
    const u = new URL(sUrl);
    return u.origin + u.pathname.replace(/(.*\/).*/, "$1");
  } catch (e) {
    // last fallback: try to extract up to services.odata.org portion
    const m = sUrl.match(/.*services\.odata\.org\/[^/]*\//);
    if (m && m[0]) {
      return m[0];
    }
    throw new Error("Could not find a base URL in " + sUrl);
  }
}

/**
 * Looks for a user with a given user name and returns its index in the user array.
 * @param {string} sUserName - the user name to look for.
 * @returns {int} index of that user in the array, or -1 if the user was not found.
 */
function findUserIndex(sUserName: string): number {
  for (let i = 0; i < aUsers.length; i++) {
    if (aUsers[i].UserName === sUserName) {
      return i;
    }
  }
  return -1;
}

/**
 * Retrieves any user data from a given http request body.
 * @param {string} sBody - the http request body.
 * @returns {Object} the parsed user data.
 */
function getUserDataFromRequestBody(sBody: string): any {
  if (!sBody) {
    throw new Error("Request body is empty");
  }

  // Try to find a JSON object in the request body.
  // Accept either raw JSON or multipart payloads that contain a JSON part.
  const firstJsonMatch = sBody.match(/\{[\s\S]*\}/);
  if (!firstJsonMatch || !firstJsonMatch[0]) {
    throw new Error("Could not find any user data in " + sBody);
  }
  try {
    return JSON.parse(firstJsonMatch[0]);
  } catch (e) {
    throw new Error("Could not parse JSON body: " + e);
  }
}

/**
 * Retrieves a user name from a given request URL.
 * @param {string} sUrl - the request URL.
 * @returns {string} the user name or undefined if no user was found.
 */
function getUserKeyFromUrl(sUrl: string): string | undefined {
  const aMatches = sUrl.match(/People\('(.*)'\)/);
  return aMatches ? aMatches[1] : undefined;
}

/**
 * Checks if a given UserName is unique or already used
 * @param {string} sUserName - the UserName to be checked
 * @returns {boolean} True if the UserName is unique (not used), false otherwise
 */
function isUnique(sUserName: string): boolean {
  return findUserIndex(sUserName) < 0;
}

/**
 * Returns a proper HTTP response body for "duplicate key" errors
 * @param {string} sKey - the duplicate key
 * @returns {string} the proper response body
 */
function duplicateKeyError(sKey: string): string {
  return JSON.stringify({
    error: {
      code: "409",
      message: "There is already a user with user name '" + sKey + "'.",
      target: "UserName"
    }
  });
}

function invalidKeyError(sKey: string): string {
  return JSON.stringify({
    error: {
      code: "404",
      message: "There is no user with user name '" + sKey + "'.",
      target: "UserName"
    }
  });
}

function getSuccessResponse(sResponseBody: string): [number, Record<string, string>, string] {
  return [
    200,
    {
      "Content-Type": "application/json; odata.metadata=minimal",
      "OData-Version": "2.0"
    },
    sResponseBody
  ];
}

/**
 * Reads and caches the fake service metadata and data from their
 * respective files.
 * @returns{Promise} a promise that is resolved when the data is loaded
 */
function readData(): Promise<void> {
  const oMetadataPromise = new Promise<void>(function (fnResolve, fnReject) {
    const sResourcePath = sap.ui.require.toUrl(sNamespace + "/localService/metadata.xml");
    const oRequest = new XMLHttpRequest();

    oRequest.onload = function () {
      // 404 is not an error for XMLHttpRequest so we need to handle it here
      if (oRequest.status === 404) {
        const sError = "resource " + sResourcePath + " not found";
        Log.error(sError, sLogComponent);
        fnReject(new Error(sError));
        return;
      }
      sMetadata = (this as any).responseText;
      fnResolve();
    };
    oRequest.onerror = function () {
      const sError = "error loading resource '" + sResourcePath + "'";
      Log.error(sError, sLogComponent);
      fnReject(new Error(sError));
    };
    oRequest.open("GET", sResourcePath);
    oRequest.send();
  });

  const oMockDataPromise = new Promise<void>(function (fnResolve, fnReject) {
    const sResourcePath = sap.ui.require.toUrl(sNamespace + "/localService/mockdata/people.json");
    const oMockDataModel = new JSONModel(sResourcePath);

    oMockDataModel.attachRequestCompleted(function (this: JSONModel, oEvent: any) {
      // 404 is not an error for JSONModel so we need to handle it here
      if (oEvent.getParameter && oEvent.getParameter("errorobject")
        && oEvent.getParameter("errorobject").statusCode === 404) {
        const sError = "resource '" + sResourcePath + "' not found";
        Log.error(sError, sLogComponent);
        fnReject(new Error(sError));
        return;
      }
      // JSONModel was loaded with a path (sResourcePath) so getData() returns the parsed file content
      const data = this.getData();
      // original code assigned aUsers = this.getData().value;
      if (data && data.value) {
        aUsers = data.value;
      } else if (Array.isArray(data)) {
        aUsers = data;
      } else {
        aUsers = [];
      }
      fnResolve();
    });

    oMockDataModel.attachRequestFailed(function () {
      const sError = "error loading resource '" + sResourcePath + "'";
      Log.error(sError, sLogComponent);
      fnReject(new Error(sError));
    });
  });

  return Promise.all([oMetadataPromise, oMockDataPromise]).then(() => { /* void */ });
}

/**
 * Reduces a given result set by applying the OData URL parameters 'skip' and 'top' to it.
 * Does NOT change the given result set but returns a new array.
 * @param {Object} oXhr - the Sinon fake XMLHttpRequest
 * @param {Array} aResultSet - the result set to be reduced.
 * @returns {Array} the reduced result set.
 */
function applySkipTop(oXhr: XhrLike, aResultSet: any[]): any[] {
  let iSkip: number;
  let iTop: number;
  const aReducedUsers = [...aResultSet];  // clone array
  const aMatches = oXhr.url.match(/\$skip=(\d+)&\$top=(\d+)/);

  if (Array.isArray(aMatches) && aMatches.length >= 3) {
    iSkip = Number(aMatches[1]);
    iTop = Number(aMatches[2]);
    return aResultSet.slice(iSkip, iSkip + iTop);
  }

  return aReducedUsers;
}

/**
 * Sorts a given result set by applying the OData URL parameter 'orderby'.
 * Does NOT change the given result set but returns a new array.
 * @param {Object} oXhr - the Sinon fake XMLHttpRequest
 * @param {Array} aResultSet - the result set to be sorted.
 * @returns {Array} the sorted result set.
 */
function applySort(oXhr: XhrLike, aResultSet: any[]): any[] {
  let sFieldName: string;
  let sDirection: string;
  const aSortedUsers = [...aResultSet]; // work with a copy
  const aMatches = oXhr.url.match(/\$orderby=(\w*)(?:%20(\w*))?/);

  if (!Array.isArray(aMatches) || aMatches.length < 2) {
    return aSortedUsers;
  }
  sFieldName = aMatches[1];
  sDirection = aMatches[2] || "asc";

  if (sFieldName !== "LastName") {
    throw new Error("Filters on field " + sFieldName + " are not supported.");
  }

  aSortedUsers.sort(function (a: any, b: any) {
    const nameA = (a.LastName || "").toUpperCase();
    const nameB = (b.LastName || "").toUpperCase();
    const bAsc = sDirection === "asc";

    if (nameA < nameB) {
      return bAsc ? -1 : 1;
    }
    if (nameA > nameB) {
      return bAsc ? 1 : -1;
    }
    return 0;
  });

  return aSortedUsers;
}


/**
 * Filters a given result set by applying the OData URL parameter 'filter'.
 * Does NOT change the given result set but returns a new array.
 * @param {Object} oXhr - the Sinon fake XMLHttpRequest
 * @param {Array} aResultSet - the result set to be filtered.
 * @returns {Array} the filtered result set.
 */
function applyFilter(oXhr: XhrLike, aResultSet: any[]): any[] {
  let sFieldName: string;
  let sQuery: string;
  let aFilteredUsers = [...aResultSet]; // work with a copy
  const aMatches = oXhr.url.match(/\$filter=.*\((.*),'(.*)'\)/);

  // If the request contains a filter command, apply the filter
  if (Array.isArray(aMatches) && aMatches.length >= 3) {
    sFieldName = aMatches[1];
    sQuery = aMatches[2];

    if (sFieldName !== "LastName") {
      throw new Error("Filters on field " + sFieldName + " are not supported.");
    }

    aFilteredUsers = aUsers.filter(function (oUser) {
      return (oUser.LastName || "").indexOf(sQuery) !== -1;
    });
  }

  return aFilteredUsers;
}

/**
 * Handles GET requests for metadata.
 * @returns {Array} an array with the response information needed by Sinon's respond() function
 */
function handleGetMetadataRequests(): [number, Record<string, string>, string] {
  return [
    200,
    {
      "Content-Type": "application/xml",
      "OData-Version": "2.0"
    },
    sMetadata
  ];
}

/**
 * Handles GET requests for a pure user count and returns a fitting response.
 * @returns {Array} an array with the response information needed by Sinon's respond() function
 */
function handleGetCountRequests(): [number, Record<string, string>, string] {
  return getSuccessResponse(aUsers.length.toString());
}

/**
 * Handles GET requests for user data and returns a fitting response.
 * @param {Object} oXhr - the Sinon fake XMLHttpRequest
 * @param {boolean} _bCount - true if the request should include a counter
 * @returns {Array} an array with the response information needed by Sinon's respond() function
 */
function handleGetUserRequests(oXhr: XhrLike, _bCount: boolean): [number, Record<string, string>, string] {
  let iCount: number;
  let aExpand: any;
  let sExpand: any;
  let iIndex: number;
  let sKey: string | undefined;
  let oResponse: any;
  let sResponseBody: string;
  let aResult: any[];
  let aSelect: any;
  let sSelect: any;
  let aSubSelects: any;
  let i: number;

  // Get expand parameter
  aExpand = oXhr.url.match(/\$expand=([^&]+)/);

  // Sort out expand parameter values + subSelects in brackets
  if (aExpand) {
    sExpand = aExpand[0];
    sExpand = sExpand.substring(8);

    // Sort out subselects (e.g. BestFriend($select=Age,UserName),Friend)
    aSubSelects = sExpand.match(/\([^\)]*\)/g) || [];
    for (i = 0; i < aSubSelects.length; i++) {
      // strip ($select= .. ) and split by comma
      aSubSelects[i] = aSubSelects[i].replace(/\(\$select=/, "").replace(/\)/, "").split(",");
    }
    sExpand = sExpand.replace(/\([^\)]*\)/g, "");
    aExpand = sExpand.split(",");
  }

  // Get select parameter
  aSelect = oXhr.url.match(/[^(]\$select=([\w|,]+)/);

  // Sort out select parameter values
  if (Array.isArray(aSelect)) {
    sSelect = aSelect[0];
    sSelect = sSelect.replace(/&/, "").replace(/\?/, "").substring(8);
    aSelect = sSelect.split(",");
  }

  // Check if an individual user or a user range is requested
  sKey = getUserKeyFromUrl(oXhr.url);
  if (sKey) {
    iIndex = findUserIndex(sKey);

    if (/People\(.+\)\/Friends/.test(oXhr.url)) {
      // ownRequest for friends
      oResponse = { value: [] };
      oResponse.value = createFriendsArray(aUsers[iIndex].Friends, aSelect);
    } else {
      // specific user was requested
      oResponse = getUserObject(iIndex, aSelect, aExpand, aSubSelects);
    }

    if (iIndex > -1) {
      sResponseBody = JSON.stringify(oResponse);
      return getSuccessResponse(sResponseBody);
    }
    sResponseBody = invalidKeyError(sKey);
    return [
      400,
      {
        "Content-Type": "application/json; charset=utf-8"
      },
      sResponseBody
    ];
  }
  // all users requested
  aResult = applyFilter(oXhr, aUsers);
  iCount = aResult.length; // the total no. of people found, after filtering
  aResult = applySort(oXhr, aResult);
  aResult = applySkipTop(oXhr, aResult);

  // generate sResponse
  oResponse = { "@odata.count": iCount, value: [] };

  aResult.forEach(function (oUser) {
    const iUserIndex = findUserIndex(oUser.UserName);
    oResponse.value.push(getUserObject(iUserIndex, aSelect, aExpand, aSubSelects));
  });

  sResponseBody = JSON.stringify(oResponse);

  return getSuccessResponse(sResponseBody);
}

/**
 * Returns a specific user in the aUsers array.
 * @param {Number} iIndex - index of the requested user in the aUsers array
 * @param {string[]} aProperties - array with properties from select parameter of request
 * @returns {Object} object containing the selected user information or null if user not found
 */
function getUserByIndex(iIndex: number, aProperties: string[] = []): any | null {
  const oHelper: Record<string, any> = {};
  const oUser = aUsers[iIndex];

  if (oUser) {
    aProperties.forEach(function (selectProperty: string) {
      oHelper[selectProperty] = oUser[selectProperty];
    });

    return oHelper;
  }
  return null;
}

/**
 * Returns the user with iIndex in the aUsers array with all its information
 * @param  {Number} iIndex index of user in aUsers
 * @param  {string[]} aSelect properties of user which should be returned
 * @param  {string[]} aExpand navigation properties of user which should be expanded
 * @param  {string[]} aSubSelects select parameters according to the expand parameters
 * @returns {Object} user with all its requested information
 */
function getUserObject(iIndex: number, aSelect?: string[], aExpand?: string[], aSubSelects?: any[]): any {
  let sBestFriend: string;
  let iFriendIndex: number;
  let aFriends: any[];
  let oObject: any = {};
  let oUser: any;
  let i: number;

  oObject = getUserByIndex(iIndex, aSelect || []);
  if (aExpand) {
    oUser = aUsers[iIndex];
    for (i = 0; i < aExpand.length; i++) {
      switch (aExpand[i]) {
        case "Friends":
          oObject.Friends = [];
          aFriends = oUser.Friends;
          oObject.Friends = createFriendsArray(aFriends, aSubSelects ? aSubSelects[i] : undefined);
          break;
        case "BestFriend":
          sBestFriend = oUser.BestFriend;
          iFriendIndex = findUserIndex(sBestFriend);
          oObject.BestFriend = getUserByIndex(iFriendIndex, aSubSelects ? aSubSelects[i] : undefined);
          break;
        default:
          break;
      }
    }
  }
  return oObject;
}

/**
 * creates array of friends for a given user
 * @param  {string[]} aFriends array containing the usernames of the friends
 * @param  {string[]} aSubSelects array containing the select parameters for the expand on
 *     friends
 * @returns {Object[]} array containing the friends as objects
 */
function createFriendsArray(aFriends: string[] = [], aSubSelects?: string[]): any[] {
  let aArray: any[] = [];
  let iFriendIndex: number;

  if (aFriends) {
    aFriends.forEach(function (sFriend: string) {
      iFriendIndex = findUserIndex(sFriend);
      aArray.push(getUserByIndex(iFriendIndex, aSubSelects || []));
    });

    aArray = aArray.filter(function (element) {
      return element !== null;
    });
  }

  return aArray;
}

/**
 * Handles PATCH requests for users and returns a fitting response.
 * Changes the user data according to the request.
 * @param {Object} oXhr - the Sinon fake XMLHttpRequest
 * @returns {Array} an array with the response information needed by Sinon's respond() function
 */
function handlePatchUserRequests(oXhr: XhrLike): [number, Record<string, string>, null | string] {
  let sKey: string | undefined;
  let oUser: any;
  let oChanges: any;
  let sResponseBody: string | null = null;
  let sFieldName: string;

  // Get the key of the person to change
  sKey = getUserKeyFromUrl(oXhr.url);

  // Get the list of changes
  oChanges = getUserDataFromRequestBody(oXhr.requestBody);

  // Check if the UserName is changed to a duplicate.
  // If the UserName is "changed" to its current value, that is not an error.
  if (oChanges.hasOwnProperty("UserName")
    && oChanges.UserName !== sKey
    && !isUnique(oChanges.UserName)) {
    // Error
    sResponseBody = duplicateKeyError(oChanges.UserName);
    return [
      400,
      {
        "Content-Type": "application/json; charset=utf-8"
      },
      sResponseBody
    ];
  }
  // No error: make the change(s)
  oUser = aUsers[findUserIndex(sKey || "")];
  for (sFieldName in oChanges) {
    if (Object.prototype.hasOwnProperty.call(oChanges, sFieldName)) {
      oUser[sFieldName] = oChanges[sFieldName];
    }
  }

  // The response to PATCH requests is always http 204 (No Content)
  sResponseBody = null;
  return [
    204,
    {
      "OData-Version": "2.0"
    },
    sResponseBody
  ];
}

/**
 * Handles DELETE requests for users and returns a fitting response.
 * Deletes the user according to the request.
 * @param {Object} oXhr - the Sinon fake XMLHttpRequest
 * @returns {Array} an array with the response information needed by Sinon's respond() function
 */
function handleDeleteUserRequests(oXhr: XhrLike): [number, Record<string, string>, null | string] {
  const sKey = getUserKeyFromUrl(oXhr.url);
  aUsers.splice(findUserIndex(sKey || ""), 1);

  // The response to DELETE requests is always http 204 (No Content)
  return [
    204,
    {
      "OData-Version": "2.0"
    },
    null
  ];
}

/**
 * Handles POST requests for users and returns a fitting response.
 * Creates a new user according to the request.
 * Does NOT check for duplicate user names because that is how the live service behaves.
 * @param {Object} oXhr - the Sinon fake XMLHttpRequest
 * @returns {Array} an array with the response information needed by Sinon's respond() function
 */
function handlePostUserRequests(oXhr: XhrLike): [number, Record<string, string>, string] {
  const oUser = getUserDataFromRequestBody(oXhr.requestBody);

  // Check if that user already exists
  if (isUnique(oUser.UserName)) {
    aUsers.push(oUser);

    let sResponseBody = '{"@odata.context": "' + getBaseUrl(oXhr.url)
      + '$metadata#People/$entity",';
    sResponseBody += JSON.stringify(oUser).slice(1);

    // The response to POST requests is http 201 (Created)
    return [
      201,
      {
        "Content-Type": "application/json; odata.metadata=minimal",
        "OData-Version": "2.0"
      },
      sResponseBody
    ];
  }
  // Error
  const sResponseBody = duplicateKeyError(oUser.UserName);
  return [
    400,
    {
      "Content-Type": "application/json; charset=utf-8"
    },
    sResponseBody
  ];
}

/**
 * Handles POST requests for resetting the data and returns a fitting response.
 * Reloads the base user data from file.
 * Does NOT check for duplicate user names because that is how the live service behaves.
 * @returns {Array} an array with the response information needed by Sinon's respond() function
 */
function handleResetDataRequest(): [number, Record<string, string>, null] {
  // reload data (async). We don't wait here - keep same behavior as original.
  readData();

  return [
    204,
    {
      "OData-Version": "2.0"
    },
    null
  ];
}

/**
 * Builds a response to direct (= non-batch) requests.
 * Supports GET, PATCH, DELETE and POST requests.
 * @param {Object} oXhr - the Sinon fake XMLHttpRequest
 * @returns {Array} an array with the response information needed by Sinon's respond() function
 */
function handleDirectRequest(oXhr: XhrLike): any[] {
  let aResponse: any[] = [];

  switch (oXhr.method) {
    case "GET":
      if (/\$metadata/.test(oXhr.url)) {
        aResponse = handleGetMetadataRequests();
      } else if (/\/\$count/.test(oXhr.url)) {
        aResponse = handleGetCountRequests();
      } else if (/People/.test(oXhr.url)) {
        // handle People requests (with or without query)
        aResponse = handleGetUserRequests(oXhr, /\$count=true/.test(oXhr.url));
      }
      break;
    case "PATCH":
      if (/People/.test(oXhr.url)) {
        aResponse = handlePatchUserRequests(oXhr);
      }
      break;
    case "POST":
      if (/People/.test(oXhr.url)) {
        aResponse = handlePostUserRequests(oXhr);
      } else if (/ResetDataSource/.test(oXhr.url)) {
        aResponse = handleResetDataRequest();
      }
      break;
    case "DELETE":
      if (/People/.test(oXhr.url)) {
        aResponse = handleDeleteUserRequests(oXhr);
      }
      break;
    case "HEAD":
      aResponse = [204, {}];
      break;
    default:
      break;
  }

  return aResponse;
}

/**
 * Builds a response to batch requests.
 * Unwraps batch request, gets a response for each individual part and
 * constructs a fitting batch response.
 * @param {Object} oXhr - the Sinon fake XMLHttpRequest
 * @returns {Array} an array with the response information needed by Sinon's respond() function
 */
function handleBatchRequest(oXhr: XhrLike): [number, Record<string, string>, string] {
  let aResponse: any;
  let sResponseBody = "";
  // First line of the body (outer boundary). Use safe match to get first line.
  const outerMatch = oXhr.requestBody.match(/^[^\r\n]*/);
  const sOuterBoundary = outerMatch ? outerMatch[0] : "";
  let sInnerBoundary: string | undefined;
  let sPartBoundary: string | undefined;
  // The individual requests
  const aOuterParts = oXhr.requestBody.split(sOuterBoundary).slice(1, -1);
  let aParts: string[] = [];
  let aMatches: RegExpMatchArray | null;
  let sHeader: string;

  if (aOuterParts.length === 0) {
    // fallback: try to split by common batch boundary patterns
    aParts = oXhr.requestBody.split(/--batch/).slice(1);
  } else {
    aMatches = aOuterParts[0].match(/multipart\/mixed;boundary=(.+)/);
    // If this request has several change sets, then we need to handle the inner and outer
    // boundaries (change sets have an additional boundary)
    if (aMatches && aMatches.length > 0) {
      sInnerBoundary = aMatches[1];
      aParts = aOuterParts[0].split("--" + sInnerBoundary).slice(1, -1);
    } else {
      aParts = aOuterParts;
    }
  }

  // If this request has several change sets, then the response must start with the outer
  // boundary and content header
  if (sInnerBoundary) {
    sPartBoundary = "--" + sInnerBoundary;
    sResponseBody += sOuterBoundary + "\r\n"
      + "Content-Type: multipart/mixed; boundary=" + sInnerBoundary + "\r\n\r\n";
  } else {
    sPartBoundary = sOuterBoundary;
  }

  aParts.forEach(function (sPart: string, iIndex: number) {
    // Construct the batch response body out of the single batch request parts. The RegExp
    // looks for a request body at the end of the string, framed by two line breaks.
    // Use [\s\S] to match any chars across lines.
    const aMatches0 = sPart.match(/(GET|DELETE|PATCH|POST) (\S+)(?:[\s\S]+?)\r?\n([\s\S]*)\r?\n$/);
    if (!aMatches0) {
      return;
    }
    const method = aMatches0[1];
    const relativeUrl = aMatches0[2];
    const requestBody = aMatches0[3] || "";

    const aPartResponse = handleDirectRequest({
      method: method,
      url: getBaseUrl(oXhr.url) + relativeUrl,
      requestBody: requestBody
    });

    sResponseBody += sPartBoundary + "\r\n"
      + "Content-Type: application/http\r\n";
    // If there are several change sets, we need to add a Content ID header
    if (sInnerBoundary) {
      sResponseBody += "Content-ID:" + iIndex + ".0\r\n";
    }
    sResponseBody += "\r\nHTTP/1.1 " + aPartResponse[0] + "\r\n";
    // Add any headers from the request - unless this response is 204 (no content)
    if (aPartResponse[1] && aPartResponse[0] !== 204) {
      for (sHeader in aPartResponse[1]) {
        if (Object.prototype.hasOwnProperty.call(aPartResponse[1], sHeader)) {
          sResponseBody += sHeader + ": " + aPartResponse[1][sHeader] + "\r\n";
        }
      }
    }
    sResponseBody += "\r\n";

    if (aPartResponse[2]) {
      sResponseBody += aPartResponse[2];
    }
    sResponseBody += "\r\n";
  });

  // Check if we need to add the inner boundary again at the end
  if (sInnerBoundary) {
    sResponseBody += "--" + sInnerBoundary + "--\r\n";
  }
  // Add a final boundary to the batch response body
  sResponseBody += sOuterBoundary + "--";

  // Build the final batch response
  aResponse = [
    200,
    {
      "Content-Type": "multipart/mixed;boundary=" + (sOuterBoundary ? sOuterBoundary.slice(2) : ""),
      "OData-Version": "2.0"
    },
    sResponseBody
  ];

  return aResponse;
}

/**
 * Handles any type of intercepted request and sends a fake response.
 * Logs the request and response to the console.
 * Manages batch requests.
 * @param {Object} oXhr - the Sinon fake XMLHttpRequest
 */
function handleAllRequests(oXhr: XhrLike): void {
  let aResponse: any;

  // Log the request
  Log.info(
    "Mockserver: Received " + oXhr.method + " request to URL " + oXhr.url,
    (oXhr.requestBody ? "Request body is:\n" + oXhr.requestBody : "No request body.")
    + "\n",
    sLogComponent
  );

  if (oXhr.method === "POST" && /\$batch/.test(oXhr.url)) {
    aResponse = handleBatchRequest(oXhr);
  } else {
    aResponse = handleDirectRequest(oXhr);
  }

  // respond (some handlers may return undefined)
  if (Array.isArray(aResponse) && aResponse.length >= 3) {
    oXhr.respond(aResponse[0], aResponse[1], aResponse[2]);
  } else {
    // fallback: 204 no content
    oXhr.respond(204, {}, "");
  }

  // Log the response
  Log.info(
    "Mockserver: Sent response with return code " + (Array.isArray(aResponse) ? aResponse[0] : 204),
    ("Response headers: " + JSON.stringify(Array.isArray(aResponse) ? aResponse[1] : {}) + "\n\nResponse body:\n"
      + (Array.isArray(aResponse) ? aResponse[2] : "")) + "\n",
    sLogComponent
  );
}
