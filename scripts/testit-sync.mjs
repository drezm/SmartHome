import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: path.join(root, ".env") });
loadEnv({ path: path.join(root, ".env.local"), override: true });
const manifest = JSON.parse(await fs.readFile(path.join(root, "testit/manifest.json"), "utf8"));
const config = {
  url: requireEnv("TMS_URL").replace(/\/$/, ""),
  token: requireEnv("TMS_TOKEN"),
  projectId: requireEnv("TMS_PROJECT_ID")
};

const section = await ensureSection(manifest.section);
const workItems = new Map();

for (const testCase of manifest.manualCases) {
  const workItem = await ensureWorkItem(section.id, testCase);
  workItems.set(testCase.externalId, workItem);
}

for (const autoTest of manifest.autoTests) {
  const created = await ensureAutoTest(autoTest);
  const linkedIds = autoTest.workItemExternalIds.map((externalId) => workItems.get(externalId)?.id).filter(Boolean);
  if (linkedIds.length > 0) {
    for (const id of linkedIds) {
      await request("POST", `/api/v2/autoTests/${created.id}/workItems`, { id });
    }
  }
}

console.log(`Test IT sync complete: ${manifest.manualCases.length} manual cases, ${manifest.autoTests.length} autotests.`);

async function ensureSection(name) {
  const sections = extractItems(await request("GET", `/api/v2/projects/${config.projectId}/sections`));
  const existing = sections.find((item) => item.name === name);
  if (existing) {
    return existing;
  }

  const root = sections.find((item) => item.parentId === null);
  if (!root) {
    throw new Error("Root Test IT section was not found");
  }

  return request("POST", "/api/v2/sections", { projectId: config.projectId, parentId: root.id, name });
}

async function ensureWorkItem(sectionId, testCase) {
  const existing = extractItems(await request("GET", `/api/v2/sections/${sectionId}/workItems`)).find((item) => item.name === testCase.title);
  if (existing) {
    return existing;
  }
  return request("POST", "/api/v2/workItems", {
    projectId: config.projectId,
    sectionId,
    name: testCase.title,
    entityTypeName: "TestCases",
    description: testCase.description,
    duration: 60_000,
    state: "Ready",
    priority: "Medium",
    attributes: {},
    tags: [],
    preconditionSteps: [],
    steps: testCase.steps,
    postconditionSteps: [],
    links: []
  });
}

async function ensureAutoTest(autoTest) {
  const existing = extractItems(await request("GET", "/api/v2/autoTests")).find(
    (item) => item.projectId === config.projectId && item.externalId === autoTest.externalId
  );
  if (existing) {
    return existing;
  }
  return request("POST", "/api/v2/autoTests", {
    projectId: config.projectId,
    externalId: autoTest.externalId,
    name: autoTest.title,
    namespace: autoTest.namespace,
    classname: autoTest.namespace,
    title: autoTest.title,
    links: [{ title: "Source", url: sourceUrl(autoTest.source), type: "Repository", hasInfo: false }]
  });
}

function sourceUrl(source) {
  return process.env.TMS_SOURCE_BASE_URL ? `${process.env.TMS_SOURCE_BASE_URL.replace(/\/$/, "")}/${source}` : source;
}

async function request(method, route, body) {
  const response = await fetch(`${config.url}${route}`, {
    method,
    headers: {
      Authorization: `PrivateToken ${config.token}`,
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${method} ${route} failed with ${response.status}: ${detail}`);
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function extractItems(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return value?.items ?? value?.data ?? [];
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
