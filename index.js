import * as core from "@actions/core";
import * as fs from "fs";
import { ofetch } from "ofetch";

const endpoint = "https://port.hive.beabee.io/api"; // core.getInput('endpoint')+"/api";
const stack_name = "faktenforum-dev"; // core.getInput('stack_name');
const file_path = undefined; //core.getInput('file_path');
const prune = true; //core.getBooleanInput('prune');
const pullImage = true; //core.getBooleanInput('pull');
const headers = {
  "x-api-key": "ptr_QZ6PnxFfnR0QaUqoWur3VtxcjASNOfPT2gdlMeJbND8=", //core.getInput('access_token'),
  "Content-Type": "application/json",
};

function upsertVariables(list, variables) {
  variables.forEach((variable) => {
    const index = list.findIndex((v) => v.name === variable.name);
    if (index !== -1) {
      list[index].value = variable.value;
    } else {
      list.push(variable);
    }
  });
}

async function fetchStacks() {
  core.debug(`Fetching stacks from ${endpoint}/stacks`);
  const response = await ofetch(`${endpoint}/stacks`, {
    headers: headers,
  });
  core.debug(`Response: ${JSON.stringify(response, null, 3)}`);
  return response;
}

async function fetchStackFile(id) {
  core.debug(`Fetching stack file from ${endpoint}/stacks/${id}/file`);
  const response = await ofetch(`${endpoint}/stacks/${id}/file`, {
    headers: headers,
  });
  core.debug(`Response: ${JSON.stringify(response, null, 3)}`);
  return response;
}

async function redeployStack(id, endpointId, basicVars) {
  let basicContent = "";
  core.debug("Reading stack file content");
  if (file_path) {
    try {
      basicContent = fs.readFileSync(file_path, "utf8");
    } catch (error) {
      throw Error("This stack is not a file stack");
    }
  } else {
    const stackFileResponse = await fetchStackFile(id);
    basicContent = stackFileResponse.StackFileContent;
  }
  core.debug("Stack file content: " + basicContent);

  upsertVariables(basicVars, [
    {
      name: "PORTAMI_ACTIVE",
      value: "true",
    },
    {
      name: "PORTAMI_VERSION",
      value: "v1.3",
    },
    {
      name: "PORTAMI_UPDATED_AT",
      value: new Date().toISOString(),
    },
  ]);

  const url = new URL(`${endpoint}/stacks/${id}`);
  url.search = new URLSearchParams({ endpointId }).toString();
  const redeployData = {
    prune: prune,
    pullImage: pullImage,
    stackFileContent: basicContent,
    env: basicVars,
  };

  core.debug(
    `Updating stack ${id} from ${endpoint}/stacks/${id}, body: ${JSON.stringify(
      redeployData,
      null,
      3
    )}`
  );

  const response = await ofetch(url, {
    method: "PUT",
    headers: headers,
    body: redeployData,
  });
  return response;
}

async function main() {
  try {
    const stacks = await fetchStacks();
    const stack = stacks.find((item) => item.Name === stack_name);
    if (!stack) {
      throw Error(`Error: Stack name '${stack_name}' not found.`);
    }
    const deployResponse = await redeployStack(
      stack.Id,
      stack.EndpointId,
      stack.Env
    );
    core.debug(`Response: ${JSON.stringify(deployResponse, null, 3)}`);
  } catch (error) {
    core.error(error);
  }
}

main();
