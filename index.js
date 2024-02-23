import * as core from "@actions/core";
import * as fs from "fs";
import { ofetch } from "ofetch";

const endpoint = core.getInput("endpoint") + "/api";
const stack_name = core.getInput("stack_name");
const file_path = core.getInput("file_path");
const prune = core.getBooleanInput("prune");
const pullImage = core.getBooleanInput("pull");
const headers = {
  "x-api-key": core.getInput("access_token"),
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

  return response;
}

async function fetchStackFile(id) {
  core.debug(`Fetching stack file from ${endpoint}/stacks/${id}/file`);
  const response = await ofetch(`${endpoint}/stacks/${id}/file`, {
    headers: headers,
  });

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
  core.debug("Stack file content length: " + basicContent.length);

  upsertVariables(basicVars, [
    {
      name: "PORTAMI_ACTIVE",
      value: "true",
    },
    {
      name: "PORTAMI_VERSION",
      value: "v1.4",
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

  core.debug(`Updating stack ${id} from ${endpoint}/stacks/${id}`);

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
  } catch (error) {
    core.error(error);
    core.setFailed(error.message);
  }
}

main();
