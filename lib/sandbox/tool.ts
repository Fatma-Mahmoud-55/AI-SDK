import { anthropic } from "@ai-sdk/anthropic";
import { Sandbox } from "@e2b/desktop";
import { getDesktop } from "./utils";

export const resolution = { x: 1024, y: 768 };

const wait = async (seconds: number) => {
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};

export const computerTool = (sandboxId: string) =>
  anthropic.tools.computer_20250124({
    displayWidthPx: resolution.x,
    displayHeightPx: resolution.y,
    displayNumber: 1,
    execute: async ({
      action,
      coordinate,
      text,
      duration,
      scroll_amount,
      scroll_direction,
      start_coordinate,
    }) => {
      const sandbox: Sandbox = await getDesktop(sandboxId);

      switch (action) {
        case "screenshot": {
          const screenshot = await sandbox.screenshot();
          const base64Data = Buffer.from(screenshot).toString("base64");
          return {
            type: "image" as const,
            data: base64Data,
          };
        }

        case "wait": {
          if (!duration) throw new Error("Duration required for wait action");
          const actualDuration = Math.min(duration, 2);
          await wait(actualDuration);
          return {
            type: "text" as const,
            text: `Waited for ${actualDuration} seconds`,
          };
        }

        case "left_click": {
          if (!coordinate)
            throw new Error("Coordinate required for left click action");
          const [x, y] = coordinate;
          await sandbox.leftClick(x, y);
          return {
            type: "text" as const,
            text: `Left clicked at ${x}, ${y}`,
          };
        }

        case "double_click": {
          if (!coordinate)
            throw new Error("Coordinate required for double click action");
          const [x, y] = coordinate;
          await sandbox.doubleClick(x, y);
          return {
            type: "text" as const,
            text: `Double clicked at ${x}, ${y}`,
          };
        }

        case "right_click": {
          if (!coordinate)
            throw new Error("Coordinate required for right click action");
          const [x, y] = coordinate;
          await sandbox.rightClick(x, y);
          return {
            type: "text" as const,
            text: `Right clicked at ${x}, ${y}`,
          };
        }

        case "mouse_move": {
          if (!coordinate)
            throw new Error("Coordinate required for mouse move action");
          const [x, y] = coordinate;
          await sandbox.moveMouse(x, y);
          return {
            type: "text" as const,
            text: `Moved mouse to ${x}, ${y}`,
          };
        }

        case "type": {
          if (!text) throw new Error("Text required for type action");
          await sandbox.type(text);
          return {
            type: "text" as const,
            text: `Typed: ${text}`,
          };
        }

        case "key": {
          if (!text) throw new Error("Key required for key action");
          await sandbox.key(text);
          return {
            type: "text" as const,
            text: `Pressed key: ${text}`,
          };
        }

        case "scroll": {
          if (!coordinate)
            throw new Error("Coordinate required for scroll action");
          if (!scroll_direction)
            throw new Error("Scroll direction required for scroll action");
          if (!scroll_amount)
            throw new Error("Scroll amount required for scroll action");

          const [x, y] = coordinate;
          const direction =
            scroll_direction === "up" ? "up" : 
            scroll_direction === "down" ? "down" :
            scroll_direction === "left" ? "left" : "right";

          await sandbox.scroll(x, y, direction, scroll_amount);
          return {
            type: "text" as const,
            text: `Scrolled ${scroll_direction} by ${scroll_amount} at ${x}, ${y}`,
          };
        }

        case "left_click_drag": {
          if (!start_coordinate || !coordinate)
            throw new Error("Coordinates required for drag action");
          const [startX, startY] = start_coordinate;
          const [endX, endY] = coordinate;
          await sandbox.drag(startX, startY, endX, endY);
          return {
            type: "text" as const,
            text: `Dragged from ${startX}, ${startY} to ${endX}, ${endY}`,
          };
        }

        default:
          throw new Error(`Unsupported action: ${action}`);
      }
    },

    experimental_toToolResultContent(result) {
      if (typeof result === "string") {
        return [{ type: "text", text: result }];
      }
      if (result.type === "image" && result.data) {
        return [
          {
            type: "image",
            data: result.data,
            mimeType: "image/png",
          },
        ];
      }
      if (result.type === "text" && result.text) {
        return [{ type: "text", text: result.text }];
      }
      throw new Error("Invalid result format");
    },
  });

export const bashTool = (sandboxId?: string) =>
  anthropic.tools.bash_20250124({
    execute: async ({ command }) => {
      const sandbox: Sandbox = await getDesktop(sandboxId);

      try {
        const result = await sandbox.commands.run(command);
        return (
          result.stdout ||
          result.stderr ||
          "(Command executed successfully with no output)"
        );
      } catch (error) {
        console.error("Bash command failed:", error);
        if (error instanceof Error) {
          return `Error executing command: ${error.message}`;
        }
        return `Error executing command: ${String(error)}`;
      }
    },
  });