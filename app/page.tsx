"use client";

import { PreviewMessage } from "@/components/message";
import { getDesktopURL } from "@/lib/sandbox/utils";
import { useScrollToBottom } from "@/lib/use-scroll-to-bottom";
import { useChat } from "@ai-sdk/react";
import { useEffect, useState } from "react";
import { Input } from "@/components/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DeployButton, ProjectInfo } from "@/components/project-info";
import { AISDKLogo } from "@/components/icons";
import { PromptSuggestions } from "@/components/prompt-suggestions";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ABORTED } from "@/lib/utils";

export default function Chat() {
  // Create separate refs for mobile and desktop to ensure both scroll properly
  const [desktopContainerRef, desktopEndRef] = useScrollToBottom();
  const [mobileContainerRef, mobileEndRef] = useScrollToBottom();

  const [isInitializing, setIsInitializing] = useState(true);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [sandboxId, setSandboxId] = useState<string | null>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    stop: stopGeneration,
    append,
    setMessages,
  } = useChat({
    api: "/api/chat",
    id: sandboxId ?? undefined,
    body: {
      sandboxId,
    },
    maxSteps: 30,
    onError: (error) => {
      console.error(error);
      toast.error("There was an error", {
        description: error.message || "Please try again later.",
        richColors: true,
        position: "top-center",
      });
    },
    onResponse: (response) => {
      if (!response.ok) {
        console.error("API response error:", response.status, response.statusText);
      }
    },
  });

  const stop = () => {
    stopGeneration();

    const lastMessage = messages.at(-1);
    const lastMessageLastPart = lastMessage?.parts.at(-1);
    if (
      lastMessage?.role === "assistant" &&
      lastMessageLastPart?.type === "tool-invocation"
    ) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          ...lastMessage,
          parts: [
            ...lastMessage.parts.slice(0, -1),
            {
              ...lastMessageLastPart,
              toolInvocation: {
                ...lastMessageLastPart.toolInvocation,
                state: "result",
                result: ABORTED,
              },
            },
          ],
        },
      ]);
    }
  };

  const isLoading = status !== "ready";

  const refreshDesktop = async () => {
    try {
      setIsInitializing(true);
      const { streamUrl, id } = await getDesktopURL(sandboxId || undefined);
      setStreamUrl(streamUrl);
      setSandboxId(id);
    } catch (err) {
      console.error("Failed to refresh desktop:", err);
      toast.error("Failed to refresh desktop", {
        description: err instanceof Error ? err.message : "Please try again",
        richColors: true,
        position: "top-center",
      });
    } finally {
      setIsInitializing(false);
    }
  };

  // Kill desktop on page close
  useEffect(() => {
    if (!sandboxId) return;

    // Function to kill the desktop - just one method to reduce duplicates
    const killDesktop = () => {
      if (!sandboxId) return;

      // Use sendBeacon which is best supported across browsers
      navigator.sendBeacon(
        `/api/kill-desktop?sandboxId=${encodeURIComponent(sandboxId)}`,
      );
    };

    // Detect iOS / Safari
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // Choose exactly ONE event handler based on the browser
    if (isIOS || isSafari) {
      // For Safari on iOS, use pagehide which is most reliable
      window.addEventListener("pagehide", killDesktop);

      return () => {
        window.removeEventListener("pagehide", killDesktop);
        // Also kill desktop when component unmounts
        killDesktop();
      };
    } else {
      // For all other browsers, use beforeunload
      window.addEventListener("beforeunload", killDesktop);

      return () => {
        window.removeEventListener("beforeunload", killDesktop);
        // Also kill desktop when component unmounts
        killDesktop();
      };
    }
  }, [sandboxId]);

  useEffect(() => {
    // Initialize desktop and get stream URL when the component mounts
    const init = async () => {
      try {
        setIsInitializing(true);

        // Use the provided ID or create a new one
        const { streamUrl, id } = await getDesktopURL(sandboxId ?? undefined);

        setStreamUrl(streamUrl);
        setSandboxId(id);
      } catch (err) {
        console.error("Failed to initialize desktop:", err);
        toast.error("Failed to initialize desktop", {
          description: err instanceof Error ? err.message : "Please try again",
          richColors: true,
          position: "top-center",
        });
      } finally {
        setIsInitializing(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sanitize messages to ensure error parts have string values
  const sanitizedMessages = messages.map((message) => {
    // Create a deep copy of the message
    const sanitizedMessage = { ...message };
    
    if (sanitizedMessage.parts && Array.isArray(sanitizedMessage.parts)) {
      sanitizedMessage.parts = sanitizedMessage.parts.map((part) => {
        // Handle error parts
        if (part && part.type === "error") {
          // Clone the error part
          const sanitizedPart = { ...part };
          
          // Ensure error property is a string
          if (sanitizedPart.error !== undefined && typeof sanitizedPart.error !== "string") {
            // Convert error object to string message
            if (sanitizedPart.error instanceof Error) {
              sanitizedPart.error = sanitizedPart.error.message;
            } else if (typeof sanitizedPart.error === "object") {
              sanitizedPart.error = sanitizedPart.error.message || JSON.stringify(sanitizedPart.error);
            } else {
              sanitizedPart.error = String(sanitizedPart.error);
            }
          }
          
          return sanitizedPart;
        }
        
        // Handle tool-invocation parts that might have errors
        if (part && part.type === "tool-invocation" && part.toolInvocation) {
          const sanitizedPart = { ...part };
          
          // Check if tool invocation has an error result
          if (sanitizedPart.toolInvocation.state === "result" && 
              sanitizedPart.toolInvocation.result && 
              typeof sanitizedPart.toolInvocation.result !== "string" &&
              sanitizedPart.toolInvocation.result !== ABORTED) {
            
            // Convert error result to string
            if (sanitizedPart.toolInvocation.result instanceof Error) {
              sanitizedPart.toolInvocation.result = sanitizedPart.toolInvocation.result.message;
            } else if (typeof sanitizedPart.toolInvocation.result === "object") {
              sanitizedPart.toolInvocation.result = 
                sanitizedPart.toolInvocation.result.message || 
                JSON.stringify(sanitizedPart.toolInvocation.result);
            }
          }
          
          return sanitizedPart;
        }
        
        return part;
      });
    }
    
    return sanitizedMessage;
  });

  return (
    <div className="flex h-dvh relative">
      {/* Mobile/tablet banner */}
      <div className="flex items-center justify-center fixed left-1/2 -translate-x-1/2 top-5 shadow-md text-xs mx-auto rounded-lg h-8 w-fit bg-blue-600 text-white px-3 py-2 text-left z-50 xl:hidden">
        <span>Headless mode</span>
      </div>

      {/* Resizable Panels */}
      <div className="w-full hidden xl:block">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Desktop Stream Panel */}
          <ResizablePanel
            defaultSize={70}
            minSize={40}
            className="bg-black relative items-center justify-center"
          >
            {streamUrl ? (
              <>
                <iframe
                  src={streamUrl}
                  className="w-full h-full"
                  style={{
                    transformOrigin: "center",
                    width: "100%",
                    height: "100%",
                  }}
                  allow="autoplay"
                />
                <Button
                  onClick={refreshDesktop}
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white px-3 py-1 rounded text-sm z-10"
                  disabled={isInitializing}
                >
                  {isInitializing ? "Creating desktop..." : "New desktop"}
                </Button>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-white">
                {isInitializing
                  ? "Initializing desktop..."
                  : "Loading stream..."}
              </div>
            )}
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Chat Interface Panel */}
          <ResizablePanel
            defaultSize={30}
            minSize={25}
            className="flex flex-col border-l border-zinc-200"
          >
            <div className="bg-white py-4 px-4 flex justify-between items-center">
              <AISDKLogo />
              <DeployButton />
            </div>

            <div
              className="flex-1 space-y-6 py-4 overflow-y-auto px-4"
              ref={desktopContainerRef}
            >
              {sanitizedMessages.length === 0 ? <ProjectInfo /> : null}
              {sanitizedMessages.map((message, i) => (
                <PreviewMessage
                  message={message}
                  key={message.id}
                  isLoading={isLoading}
                  status={status}
                  isLatestMessage={i === sanitizedMessages.length - 1}
                />
              ))}
              <div ref={desktopEndRef} className="pb-2" />
            </div>

            {sanitizedMessages.length === 0 && (
              <PromptSuggestions
                disabled={isInitializing}
                submitPrompt={(prompt: string) =>
                  append({ role: "user", content: prompt })
                }
              />
            )}
            <div className="bg-white">
              <form onSubmit={handleSubmit} className="p-4">
                <Input
                  handleInputChange={handleInputChange}
                  input={input}
                  isInitializing={isInitializing}
                  isLoading={isLoading}
                  status={status}
                  stop={stop}
                />
              </form>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Mobile View (Chat Only) */}
      <div className="w-full xl:hidden flex flex-col">
        <div className="bg-white py-4 px-4 flex justify-between items-center">
          <AISDKLogo />
          <DeployButton />
        </div>

        <div
          className="flex-1 space-y-6 py-4 overflow-y-auto px-4"
          ref={mobileContainerRef}
        >
          {sanitizedMessages.length === 0 ? <ProjectInfo /> : null}
          {sanitizedMessages.map((message, i) => (
            <PreviewMessage
              message={message}
              key={message.id}
              isLoading={isLoading}
              status={status}
              isLatestMessage={i === sanitizedMessages.length - 1}
            />
          ))}
          <div ref={mobileEndRef} className="pb-2" />
        </div>

        {sanitizedMessages.length === 0 && (
          <PromptSuggestions
            disabled={isInitializing}
            submitPrompt={(prompt: string) =>
              append({ role: "user", content: prompt })
            }
          />
        )}
        <div className="bg-white">
          <form onSubmit={handleSubmit} className="p-4">
            <Input
              handleInputChange={handleInputChange}
              input={input}
              isInitializing={isInitializing}
              isLoading={isLoading}
              status={status}
              stop={stop}
            />
          </form>
        </div>
      </div>
    </div>
  );
}