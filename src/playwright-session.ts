import * as fs from "fs";
import type { ChromiumBrowser, ChromiumBrowserContext, Page } from "playwright";

type InitializeRecorderResponse = {
  page: Page;
  context: ChromiumBrowserContext;
};

/**
 * Bootstraps session recording on top of the open browser connection.
 * Session recording will be saved to a file defined by `sessionFilePath` argument.
 * Once bootstrapped, this function will return a new BrowserContext & Page.
 * @param browser ChromiumBrowser Browser instance.
 * @param [sessionFilePath] [OPTIONAL] Path where session recoeding file should be saved.
 * Defaults to `${process.cwd()}/playwright-events-${new Date().toISOString()}.ldjson`.
 * @param contextOpts [OPTIONAL] Options that can be passed to `browser.newContext` call, used when creating new BrowserContext.
 */
export default async function initializeRecorder(
  browser: ChromiumBrowser,
  sessionFilePath?: string,
  contextOpts: any = undefined
): Promise<InitializeRecorderResponse> {
  let writer: fs.WriteStream;

  if (sessionFilePath) {
    writer = fs.createWriteStream(`${sessionFilePath}.ldjson`);
  } else {
    writer = fs.createWriteStream(
      `${process.cwd()}/playwright-session-events-${new Date().toISOString()}.ldjson`
    );
  }

  const br: any = browser;
  const originalObj = br._connection._transport;

  const wsOnMessageProxyHandler = {
    apply(target: Function, thisArg: any, argumentsList: any[]): any {
      writer.write(
        `{"direction": "receive", "value": ${JSON.stringify(
          argumentsList[0]
        )}, "timestamp": ${Date.now()}}\n`
      );

      return Reflect.apply(target, thisArg, argumentsList);
    },
  };

  const wsSendProxyHandler = {
    apply(target: Function, thisArg: any, argumentsList: any[]): any {
      writer.write(
        `{"direction": "send", "value": ${JSON.stringify(
          argumentsList[0]
        )}, "timestamp": ${Date.now()}}\n`
      );

      return Reflect.apply(target, thisArg, argumentsList);
    },
  };

  originalObj.onmessage = new Proxy(
    originalObj.onmessage,
    wsOnMessageProxyHandler
  );
  originalObj.send = new Proxy(originalObj.send, wsSendProxyHandler);

  const context = await browser.newContext(contextOpts);

  let actionId = 0;

  function generateFnProxyHandler(
    label: string,
    origTarget: any,
    writer: fs.WriteStream
  ) {
    return {
      apply(target: Function, thisArg: any, argumentsList: any[]) {
        const thisActionId = ++actionId;
        const stack = new Error().stack;
        const calleePath = stack?.split(" at ").slice(2)[0].trim();
        const [url, line, column] = (calleePath || "").split(":");
        const callee = {
          functionName: label,
          arguments: argumentsList,
          url,
          line,
          column,
          actionId: thisActionId,
        };
        writer.write(
          `{"direction": "action_start", "value": ${JSON.stringify(
            callee
          )}, "timestamp": ${Date.now()}}\n`
        );

        function promiseHandler(q: any) {
          const response = {
            functionName: label,
            arguments: argumentsList,
            url,
            line,
            column,
            actionId: thisActionId,
          };

          writer.write(
            `{"direction": "action_end", "value": ${JSON.stringify(
              response
            )}, "timestamp": ${Date.now()}}\n`
          );

          return q;
        }

        const result = Reflect.apply(target, origTarget, argumentsList);

        return Promise.resolve(result).then(promiseHandler, promiseHandler);
      },
    };
  }

  function generateObjectProxyHandler(label: string) {
    return {
      get(target: any, name: string): any {
        if (typeof target[name] === "function") {
          return new Proxy(
            target[name],
            generateFnProxyHandler(`${label}.${name}`, target, writer)
          );
        }

        return target[name];
      },
    };
  }

  const newPageProxyHandler = {
    apply(target: Function, thisArg: any, argumentsList: any[]): any {
      return Reflect.apply(target, thisArg, argumentsList).then((q: Page) => {
        return new Proxy(q, generateObjectProxyHandler("Page"));
      });
    },
  };

  const page = await context.newPage();

  const client = await context.newCDPSession(page);
  client.on("Page.screencastFrame", () => {});
  client.on("DOM.setChildNodes", async (result) => {
    const nodeIds = getAllNodeIds({
      nodeId: result.parentId,
      children: result.nodes,
    });
    for (const nodeId of nodeIds) {
      await client
        .send("DOM.getBoxModel", {
          nodeId: nodeId,
        })
        .catch(() => {});
    }
  });
  client.on("DOM.documentUpdated", async () => {
    const result = await client.send("DOM.getDocument");
    await client.send("DOM.requestChildNodes", {
      nodeId: result.root.nodeId,
      depth: -1,
      pierce: true,
    });

    const nodeIds = getAllNodeIds(result.root);
    for (const nodeId of nodeIds) {
      await client
        .send("DOM.getBoxModel", {
          nodeId: nodeId,
        })
        .catch(() => {});
    }
  });

  client.on("Network.responseReceived", async (payload) => {
    await client
      .send("Network.getResponseBody", {
        requestId: payload.requestId,
      })
      .catch(() => {});
  });

  await client.send("Page.getResourceTree");
  await client.send("DOM.enable");
  await client.send("CSS.enable");
  await client.send("Console.enable");
  await client.send("Overlay.enable");
  await client.send("Network.enable");
  await client.send("Overlay.setShowViewportSizeOnResize", { show: true });
  await client.send("Page.startScreencast");

  return {
    page: new Proxy(page, generateObjectProxyHandler("Page")),
    context,
  };
}

function getAllNodeIds(node: any, nodeIds: number[] = []) {
  nodeIds.push(node.nodeId);

  if (node.children) {
    for (const childNode of node.children) {
      getAllNodeIds(childNode, nodeIds);
    }
  }

  return nodeIds;
}
