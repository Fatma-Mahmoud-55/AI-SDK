"use server";

import { Sandbox } from "@e2b/desktop";

export const getDesktop = async (id?: string): Promise<Sandbox> => {
  try {
    if (id) {
      try {
        const sandbox = await Sandbox.connect(id);
        return sandbox;
      } catch {
        // sandbox expired or not found — create a new one
      }
    }

    const sandbox = await Sandbox.create({
      timeoutMs: 300000,
      resolution: [1024, 768],
      dpi: 96,
    });

    return sandbox;
  } catch (error) {
    console.error("Error in getDesktop:", error);
    throw error;
  }
};

export const getDesktopURL = async (id?: string) => {
  try {
    const sandbox = await getDesktop(id);

    // Start the stream before getting the URL
    await sandbox.stream.start();
    const streamUrl = sandbox.stream.getUrl();

    return { streamUrl, id: sandbox.sandboxId };
  } catch (error) {
    console.error("Error in getDesktopURL:", error);
    throw error;
  }
};

export const killDesktop = async (id: string) => {
  try {
    const sandbox = await Sandbox.connect(id);
    await sandbox.stream.stop(); // stop stream before killing
    await sandbox.kill();
  } catch (error) {
    console.error("Error killing desktop:", error);
  }
};